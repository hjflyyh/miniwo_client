import { AppConst } from '../../AppConst';
import { nakamaRpc } from '../../Utils/NakamaRpc';
import {
    FARM_EVENT_DATA_UPDATED,
    FARM_EVENT_WEATHER_UPDATED,
    FarmDataResponse,
    FarmPlotPhase,
    FarmPlotDto,
    FarmPlotState,
    nowUnixSec,
    resolveFarmPlotPhase,
    WeatherDataResponse,
    WeatherSnapshot,
    weatherTypeName,
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

    public init(): void {}

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

    /** 地块下次应刷新 farm_data 的 Unix 秒（syncedAt + grow_remain） */
    public getPlotNextUpdateAtSec(farmId: number): number | null {
        const plot = this.getPlot(farmId);
        if (!plot || plot.grow_remain <= 0) {
            return null;
        }
        return plot.syncedAt + plot.grow_remain;
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
        this.scheduleNextFarmRefresh();
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

    private applyFarms(farms: FarmPlotDto[]): void {
        const syncedAt = this.nowUnixSec();
        this.plots.clear();
        for (let i = 0; i < farms.length; i++) {
            const dto = farms[i];
            const farmId = Number(dto.farm_id);
            if (!Number.isFinite(farmId) || farmId <= 0) {
                continue;
            }
            this.plots.set(farmId, {
                farm_id: farmId,
                seed: String(dto.seed ?? ''),
                buff: dto.buff ?? null,
                grow_remain: Math.max(0, Number(dto.grow_remain) || 0),
                syncedAt,
            });
        }
        EventSystem.send(FARM_EVENT_DATA_UPDATED, this.getAllPlots());
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

    private computeNextFarmRefreshAtSec(): number | null {
        const nowSec = this.nowUnixSec();
        let next: number | null = null;
        this.plots.forEach((plot) => {
            if (plot.grow_remain <= 0) {
                return;
            }
            const at = plot.syncedAt + plot.grow_remain;
            if (at <= nowSec) {
                next = nowSec;
                return;
            }
            if (next == null || at < next) {
                next = at;
            }
        });
        return next;
    }

    private scheduleNextFarmRefresh(): void {
        this.clearFarmRefreshTimer();
        if (!this.active) {
            return;
        }

        const at = this.computeNextFarmRefreshAtSec();
        if (at == null) {
            return;
        }

        const nowSec = this.nowUnixSec();
        if (at <= nowSec) {
            console.log('[FarmModel] 地块 grow_remain 已到期，立即刷新 farm_data');
            void this.onFarmTimerFire();
            return;
        }

        const delayMs = Math.max(500, (at - nowSec) * 1000 + 200);
        console.log(`[FarmModel] 已安排农田刷新，${at - nowSec}s 后触发`);
        this.farmRefreshTimer = setTimeout(() => {
            void this.onFarmTimerFire();
        }, delayMs);
    }

    private async onFarmTimerFire(): Promise<void> {
        if (!this.active) {
            return;
        }
        console.log('[FarmModel] 定时触发 → 刷新 farm_data');
        await this.refreshFarms();
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
