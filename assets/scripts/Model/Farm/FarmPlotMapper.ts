/** 与 GameFarmNode.FARM_PLOT_COUNT 一致：每块大田 36 格（tudi1～tudi36） */
export const FARM_PLOTS_PER_FIELD = 36;

/** 已废弃的新手区 tudiPrefab0，场景内应屏蔽 */
export const FARM_DISABLED_FIELD_INDEX = -1;

/** 大田分区数量：farmIndex 0～3（tudiPrefab1～4） */
export const FARM_MAIN_FIELD_COUNT = 4;

/**
 * 场景农田点击坐标 → 服务端 farm_id。
 *
 * - farmIndex -1（tudiPrefab0）：已屏蔽，返回 null
 * - farmIndex 0～3（tudiPrefab1～4）：farm_id = farmIndex * 36 + plotIndex + 1
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

    if (fi === FARM_DISABLED_FIELD_INDEX) {
        return null;
    }

    if (fi < 0 || fi >= FARM_MAIN_FIELD_COUNT) {
        return null;
    }
    if (pi >= FARM_PLOTS_PER_FIELD) {
        return null;
    }

    return fi * FARM_PLOTS_PER_FIELD + pi + 1;
}
