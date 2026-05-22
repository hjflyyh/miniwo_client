import { Node, UITransform, Vec2, Vec3 } from 'cc';
import { MapEditor } from '../../../bundles/mapEditor/src/MapEditor';
import { GameFarmNode, FARM_PLOT_COUNT } from '../../View/Game/GameFarmNode';
import { MapModel } from '../MapModel';

/** 场景里大田分区数量（tudiPrefab1～4） */
export const FARM_FIELD_COUNT = 4;

/** 4 块大田 × 36 子格 */
export const FARM_PLOT_TOTAL = FARM_FIELD_COUNT * FARM_PLOT_COUNT;

export type FarmNearestGridEntry = {
    /** 全局地块编号 1～144：第 n 块大田 + 块内第 m 格 → (n-1)*36 + m */
    plot_index: number;
    nearest_grid: {
        x: number;
        y: number;
    } | null;
};

export type FarmsNearestGridJson = {
    farms: FarmNearestGridEntry[];
};

function plotKey(farmIndex: number, plotIndexInField: number): string {
    return `${farmIndex},${plotIndexInField}`;
}

/** 大田 farmIndex(0～3) + 块内格 plotIndexInField(0～35) → 全局 id 1～144 */
export function toGlobalPlotId(farmIndex: number, plotIndexInField: number): number {
    return farmIndex * FARM_PLOT_COUNT + plotIndexInField + 1;
}

function parseTudiPlotIndex(nodeName: string): number {
    const match = /^tudi(\d+)$/.exec(nodeName);
    if (!match) {
        return -1;
    }
    const n = Number(match[1]);
    if (!Number.isFinite(n) || n < 1 || n > FARM_PLOT_COUNT) {
        return -1;
    }
    return n - 1;
}

function findNearestGridInMap(localPos: Vec3, map: MapEditor): { x: number; y: number } | null {
    const mapUi = map.mapContainer?.getComponent(UITransform);
    if (!mapUi) {
        return null;
    }

    const width = Math.max(1, Math.floor(map.mapWidth));
    const height = Math.max(1, Math.floor(map.mapHeight));
    const mapModel = MapModel.getInstance();

    let bestX = 0;
    let bestY = 0;
    let bestDist = Infinity;

    for (let gx = 0; gx < width; gx++) {
        for (let gy = 0; gy < height; gy++) {
            const center = mapModel.gridToWorld(new Vec2(gx, gy), null, map);
            const dx = localPos.x - center.x;
            const dy = localPos.y - center.y;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
                bestDist = dist;
                bestX = gx;
                bestY = gy;
            }
        }
    }

    if (!Number.isFinite(bestDist)) {
        return null;
    }
    return { x: bestX, y: bestY };
}

function worldToMapLocal(world: Vec3, map: MapEditor): Vec3 | null {
    const mapUi = map.mapContainer?.getComponent(UITransform);
    if (!mapUi) {
        return null;
    }
    return mapUi.convertToNodeSpaceAR(world);
}

function collectAllFieldPlotNodes(
    map: MapEditor
): Map<string, { node: Node; farmIndex: number; plotIndexInField: number }> {
    const byKey = new Map<string, { node: Node; farmIndex: number; plotIndexInField: number }>();
    const farmNodes = map.node.getComponentsInChildren(GameFarmNode);

    for (let n = 0; n < farmNodes.length; n++) {
        const farmNode = farmNodes[n];
        const farmIndex = Number(farmNode.farmIndex) || 0;
        const children = farmNode.node.children;

        for (let i = 0; i < children.length; i++) {
            const plotNode = children[i];
            const plotIndexInField = parseTudiPlotIndex(plotNode.name);
            if (plotIndexInField < 0) {
                continue;
            }
            byKey.set(plotKey(farmIndex, plotIndexInField), {
                node: plotNode,
                farmIndex,
                plotIndexInField,
            });
        }
    }

    return byKey;
}

/** 144 条：plot_index 为 1～144，每格一个最近地图 grid */
export function buildFarmsNearestGridJson(map: MapEditor): FarmsNearestGridJson {
    const plotByKey = collectAllFieldPlotNodes(map);
    const farms: FarmNearestGridEntry[] = [];

    for (let farmIndex = 0; farmIndex < FARM_FIELD_COUNT; farmIndex++) {
        for (let plotIndexInField = 0; plotIndexInField < FARM_PLOT_COUNT; plotIndexInField++) {
            const globalPlotId = toGlobalPlotId(farmIndex, plotIndexInField);
            const hit = plotByKey.get(plotKey(farmIndex, plotIndexInField));

            if (!hit) {
                farms.push({
                    plot_index: globalPlotId,
                    nearest_grid: null,
                });
                continue;
            }

            const local = worldToMapLocal(hit.node.worldPosition, map);
            const nearest = local ? findNearestGridInMap(local, map) : null;

            farms.push({
                plot_index: globalPlotId,
                nearest_grid: nearest,
            });
        }
    }

    return { farms };
}

export function logFarmPlotGridsOnSave(map: MapEditor): void {
    const json = buildFarmsNearestGridJson(map);
    const found = json.farms.filter((f) => f.nearest_grid != null).length;
    console.log(
        `[FarmPlotGrid] farms 共 ${json.farms.length} 条（plot_index 1～${FARM_PLOT_TOTAL}），场景命中 ${found} 条`
    );
    console.log(JSON.stringify(json, null, 2));
}
