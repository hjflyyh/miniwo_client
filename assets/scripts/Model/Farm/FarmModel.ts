import { AppConst } from '../../AppConst';
import { MapModel } from '../MapModel';
import { GameFarmNode } from '../../View/Game/GameFarmNode';
import { nakamaRpc } from '../../Utils/NakamaRpc';
import {
    FARM_EVENT_DATA_UPDATED,
    FARM_EVENT_WEATHER_UPDATED,
    FARM_MATCH_OPCODE_DATA,
    FARM_PLOT_FUNCTION_HIDE_OTHERS,
    FarmDataResponse,
    FarmPlotPhase,
    FarmPlotDto,
    FarmPlotState,
    isFarmBuffActive,
    isPlotGrowing,
    isPlotHarvestable,
    nowUnixSec,
    getPlotGrowRemainSec,
    resolveFarmPlotPhase,
    WeatherDataResponse,
    WeatherSnapshot,
    weatherTypeName,
    FARM_MATCH_OPCODE_DATA_HARVEST,
} from './FarmTypes';

/** 天气刷新失败后重试间隔（毫秒） */
const WEATHER_RETRY_MS = 5000;

/**
 * 农场 Model：进图拉取 weather_data + farm_data；天气 end_time 到期自动刷新。
 */
export class FarmModel {
    private static _instance: FarmModel | null = null;

    private active = false;
    private weather: WeatherSnapshot | null = null;
    private plots = new Map<number, FarmPlotState>();
    private enterPromise: Promise<void> | null = null;
    private weatherRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    private farmRefreshTimer: ReturnType<typeof setTimeout> | null = null;

    public static getInstance(): FarmModel {
        if (!this._instance) {
            this._instance = new FarmModel();
        }
        return this._instance;
    }

    public init(): void {
        EventSystem.addListent('OnMatchData', this.onMatchData, this);
    }

    /**
     * 处理服务端主动推送的农田数据（Match op_code=4 或含 farms 的业务体）。
     * payload 格式与 farm_water / farm_data 成功响应一致：{ success, farms }。
     */
    public applyFarmPushPayload(payload: unknown, source = 'farm_push'): void {
        if (!this.active) {
            return;
        }
        const body = this.normalizeFarmPushBody(payload);
        if (!body?.success || !Array.isArray(body.farms)) {
            console.log(`[FarmModel] ${source} → 忽略无效农田推送`, payload);
            return;
        }
        console.log(`[FarmModel] ${source} → 收到农田推送，${body.farms.length} 块地`);
        this.applyFarms(body.farms, source);
    }

    private normalizeFarmPushBody(payload: unknown): FarmDataResponse | null {
        if (payload == null) {
            return null;
        }
        let raw: unknown = payload;
        if (typeof raw === 'string') {
            try {
                raw = JSON.parse(raw);
            } catch {
                return null;
            }
        }
        if (typeof raw !== 'object' || raw === null) {
            return null;
        }
        const obj = raw as Record<string, unknown>;
        if (obj.farms != null || obj.success != null) {
            return obj as unknown as FarmDataResponse;
        }
        const content = obj.content;
        if (typeof content === 'string') {
            try {
                return JSON.parse(content) as FarmDataResponse;
            } catch {
                return null;
            }
        }
        if (content && typeof content === 'object') {
            return content as unknown as FarmDataResponse;
        }
        return null;
    }

    private onMatchData(data: { opCode?: number; payload?: unknown }) {
        if (!this.active || !MapModel.getInstance().isFarmMapGameType()) {
            return;
        }
        if (Number(data?.opCode) !== FARM_MATCH_OPCODE_DATA && Number(data?.opCode) !== FARM_MATCH_OPCODE_DATA_HARVEST) {
            return;
        }
        this.applyFarmPushPayload(data?.payload, 'match:farm_water');
    }

    public isActive(): boolean {
        return this.active;
    }

    public getWeather(): WeatherSnapshot | null {
        return this.weather;
    }

    public getFarmCount(): number {
        if (this.plots.size > 0) {
            return this.plots.size;
        }
        return 5;
    }

    public getPlot(farmId: number): FarmPlotState | null {
        return this.plots.get(farmId) ?? null;
    }

    public getAllPlots(): FarmPlotState[] {
        return Array.from(this.plots.values()).sort((a, b) => a.farm_id - b.farm_id);
    }

    public getPhase(farmId: number, nowSec = this.nowUnixSec()): FarmPlotPhase {
        return resolveFarmPlotPhase(this.getPlot(farmId), nowSec);
    }

    /** 与地块倒计时一致的时间源（优先 WebSocket 服务端时间） */
    public getNowUnixSec(): number {
        return this.nowUnixSec();
    }

    public isPlotHarvestableById(farmId: number, nowSec = this.nowUnixSec()): boolean {
        return isPlotHarvestable(this.getPlot(farmId), nowSec);
    }

    /** Planting 本地倒计时归零或全局定时器到期：刷新为 PlantingEnd */
    public notifyGrowCountdownEnded(farmId?: number): void {
        if (!this.active) {
            return;
        }
        const nowSec = this.nowUnixSec();
        const id = farmId != null ? Math.floor(Number(farmId) || 0) : 0;
        if (id > 0 && !isPlotHarvestable(this.getPlot(id), nowSec)) {
            return;
        }
        EventSystem.send(FARM_PLOT_FUNCTION_HIDE_OTHERS, {});
        this.applyLocalGrowExpiredPlots(nowSec);
        GameFarmNode.syncAllInScene();
    }

    /** 当前可收获的 farm_id 列表 */
    public getHarvestableFarmIds(nowSec = this.nowUnixSec()): number[] {
        const ids: number[] = [];
        this.plots.forEach((plot) => {
            if (isPlotHarvestable(plot, nowSec)) {
                ids.push(plot.farm_id);
            }
        });
        return ids.sort((a, b) => a - b);
    }

    /** 是否存在仍在生长倒计时的地块 */
    public hasGrowingPlots(nowSec = this.nowUnixSec()): boolean {
        let found = false;
        this.plots.forEach((plot) => {
            if (isPlotGrowing(plot, nowSec)) {
                found = true;
            }
        });
        return found;
    }

    /** 进入农场：并行请求天气与全部地块 */
    public async enterFarm(): Promise<void> {
        if (this.enterPromise) {
            return this.enterPromise;
        }
        this.active = true;
        console.log('[FarmModel] enterFarm → 开始请求 weather_data + farm_data');
        this.enterPromise = this.refreshAll()
            .then(() => {
                console.log('[FarmModel] enterFarm → 农场数据加载完成');
                this.onPlotsDataSynced('enterFarm');
            })
            .catch((e) => {
                console.log('[FarmModel] enterFarm → 加载未完成', e?.message ?? e);
            })
            .finally(() => {
                this.enterPromise = null;
            });
        return this.enterPromise;
    }

    public leaveFarm(): void {
        this.active = false;
        this.enterPromise = null;
        this.clearWeatherRefreshTimer();
        this.clearFarmRefreshTimer();
        this.weather = null;
        this.plots.clear();
        console.log('[FarmModel] leaveFarm');
    }

    /** 地块成熟结束 Unix 秒（grow_remain） */
    public getPlotNextUpdateAtSec(farmId: number): number | null {
        const plot = this.getPlot(farmId);
        const end = getPlotGrowRemainSec(plot);
        return end > 0 ? end : null;
    }

    public async refreshAll(): Promise<void> {
        await Promise.all([this.refreshWeather(), this.refreshFarms()]);
    }

    public async refreshWeather(): Promise<void> {
        let res: WeatherDataResponse | null = null;
        try {
            res = await nakamaRpc<WeatherDataResponse>('weather_data', {});
        } catch (e: any) {
            console.log('[FarmModel] weather_data 请求异常', e?.message ?? e);
            this.scheduleWeatherRetry();
            return;
        }

        if (!res || res.success === false) {
            console.log('[FarmModel] weather_data 业务失败', res?.message ?? 'unknown');
            this.scheduleWeatherRetry();
            return;
        }

        console.log('[FarmModel] weather_data 原始响应:\n', JSON.stringify(res, null, 2));
        if (!this.applyWeather(res)) {
            console.log('[FarmModel] weather_data 返回字段不完整，跳过更新');
            this.scheduleWeatherRetry();
            return;
        }
        this.logWeatherSnapshot();
        this.scheduleNextWeatherRefresh();
    }

    /** 在指定地块播种（farm_grow，仅写入种子，需再浇水才开始生长） */
    public async grow(farmId: number, seed: string): Promise<{ ok: boolean; message?: string }> {
        if (!this.active) {
            return { ok: false, message: '未在农场中' };
        }
        const id = Number(farmId);
        const seedId = String(seed ?? '').trim();
        if (!Number.isFinite(id) || id <= 0 || !seedId) {
            return { ok: false, message: 'invalid params' };
        }

        let res: FarmDataResponse | null = null;
        try {
            res = await nakamaRpc<FarmDataResponse>('farm_grow', {
                farm_id: id,
                seed: seedId,
            });
        } catch (e: any) {
            console.log('[FarmModel] farm_grow 请求异常', e?.message ?? e);
            return { ok: false, message: e?.message ?? '请求失败' };
        }

        if (!res || res.success === false) {
            console.log('[FarmModel] farm_grow 业务失败', res?.message ?? 'unknown');
            return { ok: false, message: res?.message ?? '种植失败' };
        }

        if (Array.isArray(res.farms)) {
            this.applyFarms(res.farms);
        }
        console.log('[FarmModel] farm_grow 成功', { farm_id: id, seed: seedId });
        return { ok: true };
    }

    /** 浇水并开始生长（farm_water） */
    public async water(farmId: number): Promise<{ ok: boolean; message?: string }> {
        if (!this.active) {
            return { ok: false, message: '未在农场中' };
        }
        const id = Number(farmId);
        if (!Number.isFinite(id) || id <= 0) {
            return { ok: false, message: 'invalid params' };
        }

        let res: FarmDataResponse | null = null;
        try {
            res = await nakamaRpc<FarmDataResponse>('farm_water', { farm_id: id });
        } catch (e: any) {
            console.log('[FarmModel] farm_water 请求异常', e?.message ?? e);
            return { ok: false, message: e?.message ?? '请求失败' };
        }

        if (!res || res.success === false) {
            console.log('[FarmModel] farm_water 业务失败', res?.message ?? 'unknown');
            return { ok: false, message: res?.message ?? '浇水失败' };
        }

        if (Array.isArray(res.farms)) {
            this.applyFarms(res.farms);
        }
        console.log('[FarmModel] farm_water 成功', { farm_id: id });
        return { ok: true };
    }

    /** 施肥（farm_fertilization） */
    public async fertilize(
        farmId: number,
        itemId: number
    ): Promise<{ ok: boolean; message?: string }> {
        if (!this.active) {
            return { ok: false, message: '未在农场中' };
        }
        const id = Number(farmId);
        const iid = Math.floor(Number(itemId) || 0);
        if (!Number.isFinite(id) || id <= 0 || iid <= 0) {
            return { ok: false, message: 'invalid params' };
        }

        let res: FarmDataResponse | null = null;
        try {
            res = await nakamaRpc<FarmDataResponse>('farm_fertilization', {
                farm_id: id,
                item_id: iid,
            });
        } catch (e: any) {
            console.log('[FarmModel] farm_fertilization 请求异常', e?.message ?? e);
            return { ok: false, message: e?.message ?? '请求失败' };
        }

        if (!res || res.success === false) {
            console.log('[FarmModel] farm_fertilization 业务失败', res?.message ?? 'unknown');
            return { ok: false, message: res?.message ?? '施肥失败' };
        }

        if (Array.isArray(res.farms)) {
            this.applyFarms(res.farms);
        }
        console.log('[FarmModel] farm_fertilization 成功', { farm_id: id, item_id: iid });
        return { ok: true };
    }

    /** 成熟地块收获（farm_get） */
    public async harvest(farmId: number): Promise<{ ok: boolean; message?: string }> {
        if (!this.active) {
            return { ok: false, message: '未在农场中' };
        }
        const id = Number(farmId);
        if (!Number.isFinite(id) || id <= 0) {
            return { ok: false, message: 'invalid params' };
        }
        if (!this.isPlotHarvestableById(id)) {
            return { ok: false, message: '作物尚未成熟' };
        }

        let res: FarmDataResponse | null = null;
        try {
            res = await nakamaRpc<FarmDataResponse>('farm_get', { farm_id: id });
        } catch (e: any) {
            console.log('[FarmModel] farm_get 请求异常', e?.message ?? e);
            return { ok: false, message: e?.message ?? '请求失败' };
        }

        if (!res || res.success === false) {
            console.log('[FarmModel] farm_get 业务失败', res?.message ?? 'unknown');
            return { ok: false, message: res?.message ?? '收获失败' };
        }

        if (Array.isArray(res.farms)) {
            this.applyFarms(res.farms);
        }
        console.log('[FarmModel] farm_get 成功', { farm_id: id });
        return { ok: true };
    }

    public async refreshFarms(): Promise<void> {
        let res: FarmDataResponse | null = null;
        try {
            res = await nakamaRpc<FarmDataResponse>('farm_data', {});
        } catch (e: any) {
            console.log('[FarmModel] farm_data 请求异常', e?.message ?? e);
            return;
        }

        if (!res || res.success === false) {
            console.log('[FarmModel] farm_data 业务失败', res?.message ?? 'unknown');
            return;
        }

        console.log('[FarmModel] farm_data 原始响应:\n', JSON.stringify(res, null, 2));
        if (!Array.isArray(res.farms)) {
            console.log('[FarmModel] farm_data 返回缺少 farms 数组');
            return;
        }
        this.applyFarms(res.farms);
        this.logFarmSnapshot();
    }

    private applyWeather(res: WeatherDataResponse): boolean {
        if (res.weather == null || res.end_time == null) {
            return false;
        }
        this.weather = {
            weather: Number(res.weather),
            end_time: Number(res.end_time),
        };
        EventSystem.send(FARM_EVENT_WEATHER_UPDATED, this.weather);
        return true;
    }

    private applyFarms(farms: FarmPlotDto[], source = 'applyFarms'): void {
        const syncedAt = this.nowUnixSec();
        this.plots.clear();
        for (let i = 0; i < farms.length; i++) {
            const dto = farms[i];
            const farmId = Number(dto.farm_id);
            if (!Number.isFinite(farmId) || farmId <= 0) {
                continue;
            }
            const growRemain = Math.max(0, Number(dto.grow_remain) || 0);
            this.plots.set(farmId, {
                farm_id: farmId,
                seed: String(dto.seed ?? ''),
                buff: dto.buff ?? null,
                grow_remain: growRemain,
                syncedAt,
            });
        }
        EventSystem.send(FARM_EVENT_DATA_UPDATED, this.getAllPlots());
        this.onPlotsDataSynced(source);
    }

    /**
     * 地块数据同步后：处理已到期、进图判断可收获、刷新场景；有倒计时则启动一次生长定时器。
     */
    private onPlotsDataSynced(source: string): void {
        const nowSec = this.nowUnixSec();
        this.applyLocalGrowExpiredPlots(nowSec);

        const harvestable = this.getHarvestableFarmIds(nowSec);
        if (harvestable.length > 0) {
            console.log(`[FarmModel] ${source} → 可收获地块 farm_id=`, harvestable);
        } else {
            console.log(`[FarmModel] ${source} → 无可收获地块`);
        }

        GameFarmNode.syncAllInScene();
        this.scheduleGrowCountdown();
    }

    private logFarmSnapshot(): void {
        const plots = this.getAllPlots();
        console.log('[FarmModel] 地块快照:', plots.map((p) => ({
            farm_id: p.farm_id,
            seed: p.seed || '(空)',
            grow_remain: p.grow_remain,
            phase: resolveFarmPlotPhase(p),
            buff_count: p.buff?.length ?? 0,
        })));
        console.log('[FarmModel] 地块快照 JSON:\n', JSON.stringify(plots, null, 2));
    }

    private nowUnixSec(): number {
        const wsNow = AppConst.WebSocketManager?.getServerTimestampMs?.();
        if (Number.isFinite(wsNow) && wsNow > 0) {
            return Math.floor(wsNow / 1000);
        }
        return nowUnixSec();
    }

    private clearWeatherRefreshTimer(): void {
        if (this.weatherRefreshTimer != null) {
            clearTimeout(this.weatherRefreshTimer);
            this.weatherRefreshTimer = null;
        }
    }

    private clearFarmRefreshTimer(): void {
        if (this.farmRefreshTimer != null) {
            clearTimeout(this.farmRefreshTimer);
            this.farmRefreshTimer = null;
        }
    }

    /** 仍在生长中的地块（未到期）下一次成熟时刻 */
    private computeNextFarmGrowEndAtSec(): number | null {
        const nowSec = this.nowUnixSec();
        let next: number | null = null;
        this.plots.forEach((plot) => {
            const endAt = getPlotGrowRemainSec(plot);
            if (endAt <= 0 || !plot.seed) {
                return;
            }
            if (endAt <= nowSec) {
                return;
            }
            if (next == null || endAt < next) {
                next = endAt;
            }
        });
        return next;
    }

    /** 成熟时间已到：仅本地刷新阶段/UI，不请求 farm_data */
    private applyLocalGrowExpiredPlots(nowSec = this.nowUnixSec()): boolean {
        let changed = false;
        this.plots.forEach((plot) => {
            const end = getPlotGrowRemainSec(plot);
            if (end <= 0 || !plot.seed) {
                return;
            }
            if (nowSec >= end) {
                changed = true;
            }
        });
        if (changed) {
            EventSystem.send(FARM_EVENT_DATA_UPDATED, this.getAllPlots());
        }
        return changed;
    }

    /** 下一次 buff 结束时刻（仅统计当前仍生效的 buff） */
    private computeNextBuffEndAtSec(): number | null {
        const nowSec = this.nowUnixSec();
        let next: number | null = null;
        this.plots.forEach((plot) => {
            if (!plot.buff?.length) {
                return;
            }
            for (let i = 0; i < plot.buff.length; i++) {
                const b = plot.buff[i];
                if (!isFarmBuffActive(b, nowSec)) {
                    continue;
                }
                const end = Math.floor(Number(b.end) || 0);
                if (end <= nowSec) {
                    continue;
                }
                if (next == null || end < next) {
                    next = end;
                }
            }
        });
        return next;
    }

    /** 生长到期 / buff 到期时刷新地块 UI */
    private scheduleGrowCountdown(): void {
        this.clearFarmRefreshTimer();
        if (!this.active) {
            return;
        }

        const nowSec = this.nowUnixSec();
        const growAt = this.computeNextFarmGrowEndAtSec();
        const buffAt = this.computeNextBuffEndAtSec();
        const candidates: number[] = [];
        if (growAt != null && growAt > nowSec) {
            candidates.push(growAt);
        }
        if (buffAt != null && buffAt > nowSec) {
            candidates.push(buffAt);
        }
        if (!candidates.length) {
            return;
        }

        const at = Math.min(...candidates);
        const delayMs = Math.max(500, (at - nowSec) * 1000 + 200);
        const kind = at === buffAt && at !== growAt ? 'buff' : at === growAt && at !== buffAt ? 'grow' : 'grow+buff';
        console.log(
            `[FarmModel] 农田 UI 定时 ${at - nowSec}s 后刷新（${kind}，at=${at}）`,
        );
        this.farmRefreshTimer = setTimeout(() => {
            this.onFarmUiTimerFire();
        }, delayMs);
    }

    private onFarmUiTimerFire(): void {
        this.clearFarmRefreshTimer();
        if (!this.active) {
            return;
        }
        const nowSec = this.nowUnixSec();
        console.log('[FarmModel] 农田 UI 定时到期 → 刷新土地');
        this.applyLocalGrowExpiredPlots(nowSec);
        EventSystem.send(FARM_EVENT_DATA_UPDATED, this.getAllPlots());
        GameFarmNode.syncAllInScene();
        const harvestable = this.getHarvestableFarmIds(nowSec);
        if (harvestable.length > 0) {
            console.log('[FarmModel] 到期后可收获地块 farm_id=', harvestable);
        }
        this.scheduleGrowCountdown();
    }

    private scheduleNextWeatherRefresh(): void {
        this.clearWeatherRefreshTimer();
        if (!this.active || !this.weather?.end_time) {
            return;
        }

        const nowSec = this.nowUnixSec();
        const endTime = this.weather.end_time;
        if (endTime <= nowSec) {
            console.log('[FarmModel] 天气时段已结束，立即刷新 weather_data');
            void this.onWeatherTimerFire();
            return;
        }

        const delayMs = Math.max(500, (endTime - nowSec) * 1000 + 200);
        console.log(
            `[FarmModel] 已安排天气刷新，${endTime - nowSec}s 后触发（end_time=${endTime}）`
        );
        this.weatherRefreshTimer = setTimeout(() => {
            void this.onWeatherTimerFire();
        }, delayMs);
    }

    private scheduleWeatherRetry(): void {
        if (!this.active) {
            return;
        }
        this.clearWeatherRefreshTimer();
        console.log(`[FarmModel] ${WEATHER_RETRY_MS / 1000}s 后重试 weather_data`);
        this.weatherRefreshTimer = setTimeout(() => {
            void this.onWeatherTimerFire();
        }, WEATHER_RETRY_MS);
    }

    private async onWeatherTimerFire(): Promise<void> {
        if (!this.active) {
            return;
        }
        console.log('[FarmModel] 定时触发 → 刷新 weather_data');
        await this.refreshWeather();
    }

    private logWeatherSnapshot(): void {
        if (!this.weather) {
            console.log('[FarmModel] 天气快照为空');
            return;
        }
        const w = this.weather;
        const endDate = new Date(w.end_time * 1000).toLocaleString();
        console.log('[FarmModel] 天气快照解析:', {
            weatherType: w.weather,
            weatherName: weatherTypeName(w.weather),
            end_time: w.end_time,
            end_time_local: endDate,
        });
        console.log('[FarmModel] 天气快照 JSON:\n', JSON.stringify(w, null, 2));
    }
}
