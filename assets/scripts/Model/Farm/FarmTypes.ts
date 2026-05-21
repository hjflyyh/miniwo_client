/** 天气数据更新（Model 拉取成功后广播） */
export const FARM_EVENT_WEATHER_UPDATED = 'FarmWeatherUpdated';

/** 地块数据更新（farm_data / grow / water / get / Match 推送成功后广播） */
export const FARM_EVENT_DATA_UPDATED = 'FarmDataUpdated';

/** 展开地块 function 面板前广播：除 except 外全部收起（Planting / PlantingEnd 监听） */
export const FARM_PLOT_FUNCTION_HIDE_OTHERS = 'FarmPlotFunctionHideOthers';

export interface FarmPlotFunctionHidePayload {
    except?: import('cc').Component | null;
}

/** 地图 Match 推送 op_code：农田数据更新（payload 与 farm_water 成功响应一致） */
export const FARM_MATCH_OPCODE_DATA = 4;
export const FARM_MATCH_OPCODE_DATA_HARVEST = 5;

export interface FarmBuff {
    buff_type: number;
    start: number;
    end: number;
    mul: number;
}

/** 与服务端 BuffType 枚举一致 */
export enum FarmBuffType {
    WeatherSun = 0,
    WeatherRain = 1,
    WeatherWind = 2,
    WeatherSnow = 3,
    SeasonBuff = 4,
    WeatherAttrBuff = 5,
    SeedBuff = 6,
    DroughtBuff = 7,
    NPCPlantBuff = 8,
    PestBuff = 9,
}

/** 贴图显示优先级：灾害类优先于天气/种子 */
const FARM_BUFF_UI_PRIORITY: number[] = [
    FarmBuffType.PestBuff,
    FarmBuffType.DroughtBuff,
    FarmBuffType.NPCPlantBuff,
    FarmBuffType.SeedBuff,
    FarmBuffType.WeatherAttrBuff,
    FarmBuffType.SeasonBuff,
    FarmBuffType.WeatherSnow,
    FarmBuffType.WeatherWind,
    FarmBuffType.WeatherRain,
    FarmBuffType.WeatherSun,
];

export function isFarmBuffActive(buff: FarmBuff | null, nowSec = nowUnixSec()): boolean {
    if (!buff) {
        return false;
    }
    const start = Math.floor(Number(buff.start) || 0);
    const end = Math.floor(Number(buff.end) || 0);
    if (nowSec < start) {
        return false;
    }
    if (end <= 0) {
        return true;
    }
    return nowSec <= end;
}

/** 当前时刻仍生效的 buff 列表 */
export function getActiveFarmBuffs(plot: FarmPlotState | null, nowSec = nowUnixSec()): FarmBuff[] {
    if (!plot?.buff?.length) {
        return [];
    }
    const list: FarmBuff[] = [];
    for (let i = 0; i < plot.buff.length; i++) {
        const b = plot.buff[i];
        if (isFarmBuffActive(b, nowSec)) {
            list.push(b);
        }
    }
    return list;
}

export function sortFarmBuffsForDisplay(buffs: FarmBuff[]): FarmBuff[] {
    return [...buffs].sort((a, b) => {
        const ta = Math.floor(Number(a.buff_type) || 0);
        const tb = Math.floor(Number(b.buff_type) || 0);
        const pa = FARM_BUFF_UI_PRIORITY.indexOf(ta);
        const pb = FARM_BUFF_UI_PRIORITY.indexOf(tb);
        const ia = pa < 0 ? 999 : pa;
        const ib = pb < 0 ? 999 : pb;
        return ia - ib;
    });
}

/** 用于地块 UI 展示的单条 buff（按优先级取一条） */
export function pickFarmBuffForDisplay(plot: FarmPlotState | null, nowSec = nowUnixSec()): FarmBuff | null {
    const sorted = sortFarmBuffsForDisplay(getActiveFarmBuffs(plot, nowSec));
    return sorted.length > 0 ? sorted[0] : null;
}

export interface FarmPlotDto {
    farm_id: number;
    seed: string;
    buff: FarmBuff[] | null;
    grow_remain: number;
}

export interface FarmPlotState extends FarmPlotDto {
    /** 最近一次同步时的 Unix 秒 */
    syncedAt: number;
}

export interface FarmDataResponse {
    success: boolean;
    message?: string;
    farms?: FarmPlotDto[];
}

export enum FarmPlotPhase {
    Idle,
    Planted,
    Growing,
    Mature,
}

export function nowUnixSec(): number {
    return Math.floor(Date.now() / 1000);
}

export function isPlotSeedEmpty(plot: FarmPlotState | null): boolean {
    return !plot || !String(plot.seed ?? '').trim();
}

/** 服务端 grow_remain：成熟结束 Unix 秒；0 表示未浇水 */
export function getPlotGrowRemainSec(plot: FarmPlotState | null): number {
    return Math.max(0, Number(plot?.grow_remain) || 0);
}

/** 是否已到 grow_remain、可收获 */
export function isPlotHarvestable(plot: FarmPlotState | null, nowSec = nowUnixSec()): boolean {
    if (!plot || !String(plot.seed ?? '').trim()) {
        return false;
    }
    const end = getPlotGrowRemainSec(plot);
    return end > 0 && nowSec >= end;
}

/** 是否在生长倒计时中（grow_remain > 0 且未到结束时间） */
export function isPlotGrowing(plot: FarmPlotState | null, nowSec = nowUnixSec()): boolean {
    if (!plot || !String(plot.seed ?? '').trim()) {
        return false;
    }
    const end = getPlotGrowRemainSec(plot);
    return end > 0 && nowSec < end;
}

/** 生长倒计时已结束、可收获 */
export function plotNeedsPlantingEndOverlay(plot: FarmPlotState | null, nowSec = nowUnixSec()): boolean {
    return isPlotHarvestable(plot, nowSec);
}

/** 已播种未浇水：有 seed 且 grow_remain 为 0 */
export function plotNeedsWaterOverlay(plot: FarmPlotState | null): boolean {
    if (!plot) {
        return false;
    }
    const seed = String(plot.seed ?? '').trim();
    if (!seed) {
        return false;
    }
    return getPlotGrowRemainSec(plot) === 0;
}

export function resolveFarmPlotPhase(plot: FarmPlotState | null, nowSec = nowUnixSec()): FarmPlotPhase {
    if (!plot || !String(plot.seed ?? '').trim()) {
        return FarmPlotPhase.Idle;
    }
    const end = getPlotGrowRemainSec(plot);
    if (end <= 0) {
        return FarmPlotPhase.Planted;
    }
    if (nowSec >= end) {
        return FarmPlotPhase.Mature;
    }
    return FarmPlotPhase.Growing;
}

export interface WeatherInfoDto {
    has_weed: number;
    has_light: number;
}

export interface WeatherDataDto {
    daily_season: number;
    farm_count: number;
    info: WeatherInfoDto;
    user_id: string;
    update_at: number;
}

export interface WeatherSnapshot {
    /** 0晴 1雨 2风 3雪 */
    weather: number;
    /** 当前天气段结束 Unix 秒 */
    end_time: number;
}

export interface WeatherDataResponse {
    success: boolean;
    message?: string;
    data?: WeatherDataDto;
    weather?: number;
    end_time?: number;
}

const WEATHER_NAMES = ['晴', '雨', '风', '雪'];

export function weatherTypeName(type: number): string {
    return WEATHER_NAMES[type] ?? `天气${type}`;
}
