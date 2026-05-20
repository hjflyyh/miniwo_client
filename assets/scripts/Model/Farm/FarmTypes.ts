/** 天气数据更新（Model 拉取成功后广播） */
export const FARM_EVENT_WEATHER_UPDATED = 'FarmWeatherUpdated';

/** 地块数据更新（farm_data / grow / water / get 成功后广播） */
export const FARM_EVENT_DATA_UPDATED = 'FarmDataUpdated';

export interface FarmBuff {
    buff_type: number;
    start: number;
    end: number;
    mul: number;
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

export function resolveFarmPlotPhase(plot: FarmPlotState | null, nowSec = nowUnixSec()): FarmPlotPhase {
    if (!plot || !plot.seed) {
        return FarmPlotPhase.Idle;
    }
    if (plot.grow_remain <= 0) {
        return FarmPlotPhase.Planted;
    }
    const matureAt = plot.syncedAt + plot.grow_remain;
    if (nowSec >= matureAt) {
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
