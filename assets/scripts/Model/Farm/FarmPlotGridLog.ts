import { Node, UITransform, Vec2, Vec3 } from 'cc';
import { MapEditor } from '../../../bundles/mapEditor/src/MapEditor';
import { GameFarmNode, FARM_PLOT_COUNT } from '../../View/Game/GameFarmNode';
import { MapModel } from '../MapModel';
import {
    FARM_MAIN_FIELD_COUNT,
    FARM_PLOTS_PER_FIELD,
    toServerFarmId,
} from './FarmPlotMapper';

/** 大田 4×36 格 */
export const FARM_PLOT_TOTAL = FARM_MAIN_FIELD_COUNT * FARM_PLOTS_PER_FIELD;

/** @deprecated 请用 toServerFarmId；与 FarmPlotMapper 一致 */
export const FARM_FIELD_COUNT = FARM_MAIN_FIELD_COUNT;

export type FarmNearestGridEntry = {
    /** 与服务端 farm_id 一致：farmIndex 0 起 plotIndex 0 → 1 */
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

/** 与 toServerFarmId 一致，供旧引用 */
export function toGlobalPlotId(farmIndex: number, plotIndexInField: number): number {
    return toServerFarmId(farmIndex, plotIndexInField, FARM_PLOT_TOTAL) ?? 0;
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
        const farmIndex = Number.isFinite(Number(farmNode.farmIndex))
            ? Number(farmNode.farmIndex)
            : 0;
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

function pushPlotNearestGridEntries(
    farms: FarmNearestGridEntry[],
    plotByKey: Map<string, { node: Node; farmIndex: number; plotIndexInField: number }>,
    map: MapEditor,
    farmIndex: number,
    plotCountInField: number
) {
    for (let plotIndexInField = 0; plotIndexInField < plotCountInField; plotIndexInField++) {
        const plotIndex = toServerFarmId(farmIndex, plotIndexInField, FARM_PLOT_TOTAL);
        if (plotIndex == null) {
            continue;
        }
        const hit = plotByKey.get(plotKey(farmIndex, plotIndexInField));

        if (!hit) {
            farms.push({
                plot_index: plotIndex,
                nearest_grid: null,
            });
            continue;
        }

        const local = worldToMapLocal(hit.node.worldPosition, map);
        const nearest = local ? findNearestGridInMap(local, map) : null;

        farms.push({
            plot_index: plotIndex,
            nearest_grid: nearest,
        });
    }
}

/** 大田：plot_index 为服务端 farm_id */
export function buildFarmsNearestGridJson(map: MapEditor): FarmsNearestGridJson {
    const plotByKey = collectAllFieldPlotNodes(map);
    const farms: FarmNearestGridEntry[] = [];

    for (let farmIndex = 0; farmIndex < FARM_MAIN_FIELD_COUNT; farmIndex++) {
        pushPlotNearestGridEntries(farms, plotByKey, map, farmIndex, FARM_PLOTS_PER_FIELD);
    }

    farms.sort((a, b) => a.plot_index - b.plot_index);
    return { farms };
}

export function logFarmPlotGridsOnSave(map: MapEditor): void {
    const json = buildFarmsNearestGridJson(map);
    const found = json.farms.filter((f) => f.nearest_grid != null).length;
    console.log(
        `[FarmPlotGrid] farms 共 ${json.farms.length} 条（farmIndex 0 起 farm_id=1，plot_index 与服务端 farm_id 一致），场景命中 ${found} 条`
    );
    console.log(JSON.stringify(json, null, 2));
}
