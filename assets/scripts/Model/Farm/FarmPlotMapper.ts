/** 与 GameFarmNode.FARM_PLOT_COUNT 一致：每块大田 36 格（tudi1～tudi36） */
export const FARM_PLOTS_PER_FIELD = 36;

/** 新手区 tudiPrefab0：farmIndex = -1 */
export const FARM_STARTER_FIELD_INDEX = -1;

/** 新手区格子 plotIndex 0～6 → farm_id 1～7 */
export const FARM_STARTER_PLOT_COUNT = 7;

/** 大田 farmIndex 0 的起始 farm_id（plotIndex 0 → 7） */
export const FARM_MAIN_FIELD_BASE_ID = 7;

/** 大田分区数量：farmIndex 0～3（tudiPrefab1～4） */
export const FARM_MAIN_FIELD_COUNT = 4;

/**
 * 场景农田点击坐标 → 服务端 farm_id。
 *
 * - farmIndex -1（tudiPrefab0）：块内 plotIndex 0～6 → farm_id 1～7
 * - farmIndex 0～3（tudiPrefab1～4）：farm_id = 7 + farmIndex * 36 + plotIndex
 *
 * plotIndex：节点名 tudi{n} → n - 1（见 GameFarmNode.parsePlotIndex）
 */
export function toServerFarmId(
    farmIndex: number,
    plotIndex: number,
    _farmCount: number
): number | null {
    const fi = Math.floor(Number(farmIndex));
    const pi = Math.floor(Number(plotIndex));
    if (!Number.isFinite(pi) || pi < 0) {
        return null;
    }

    if (fi === FARM_STARTER_FIELD_INDEX) {
        if (pi >= FARM_STARTER_PLOT_COUNT) {
            return null;
        }
        return pi + 1;
    }

    if (fi < 0 || fi >= FARM_MAIN_FIELD_COUNT) {
        return null;
    }
    if (pi >= FARM_PLOTS_PER_FIELD) {
        return null;
    }

    return FARM_MAIN_FIELD_BASE_ID + fi * FARM_PLOTS_PER_FIELD + pi;
}
