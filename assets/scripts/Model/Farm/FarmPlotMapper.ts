/**
 * 场景农田点击坐标 → 服务端 farm_id 映射。
 *
 * plotIndex: tudi1→0 … tudi36→35（GameFarmNode 解析）
 * farmIndex: 场景分区 0～3（tudiPrefab1～4）
 *
 * 暂定：仅 farmIndex===0 的前 farmCount 块地有效，farm_id = plotIndex + 1。
 */
export function toServerFarmId(
    farmIndex: number,
    plotIndex: number,
    farmCount: number
): number | null {
    if (farmIndex !== 0) {
        return null;
    }
    const count = Number.isFinite(farmCount) && farmCount > 0 ? Math.floor(farmCount) : 5;
    if (plotIndex < 0 || plotIndex >= count) {
        return null;
    }
    return plotIndex + 1;
}
