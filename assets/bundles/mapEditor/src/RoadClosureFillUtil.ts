import { Vec2 } from 'cc';

export interface PlaceholderCell {
    _type: number;
    empty: boolean;
    _tileType: number;
    cfgId: number;
}

export interface ComputeFillOptions {
    mapWidth: number;
    mapHeight: number;
    placeholderTilemap: Map<string, PlaceholderCell>;
    cfgId: number;
    /**
     * Seed cell of the latest painted road.
     * When provided, algorithm only analyzes the connected component
     * of this road type that contains seed.
     */
    seed?: Vec2;
    /**
     * Extra padding around component bounding box.
     * Default: 1
     */
    padding?: number;
}

export class RoadClosureFillUtil {
    /**
     * Compute inner empty cells enclosed by the same road type.
     * The algorithm uses 4-neighbour flood fill from bounding-box border.
     */
    public static computeEnclosedEmptyCells(options: ComputeFillOptions): Vec2[] {
        const mapWidth = options.mapWidth;
        const mapHeight = options.mapHeight;
        const map = options.placeholderTilemap;
        const cfgId = options.cfgId;
        const padding = options.padding ?? 1;

        if (mapWidth <= 0 || mapHeight <= 0) {
            return [];
        }

        const inBounds = (x: number, y: number): boolean => {
            return x >= 0 && x < mapWidth && y >= 0 && y < mapHeight;
        };

        const keyOf = (x: number, y: number): string => `${x},${y}`;

        const getCell = (x: number, y: number): PlaceholderCell | undefined => {
            return map.get(keyOf(x, y));
        };

        const isWall = (x: number, y: number): boolean => {
            const cell = getCell(x, y);
            return !!cell && !cell.empty && cell.cfgId === cfgId;
        };

        const isFillableEmpty = (x: number, y: number): boolean => {
            const cell = getCell(x, y);
            return !!cell && cell.empty;
        };

        const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];

        let minX = mapWidth - 1;
        let maxX = 0;
        let minY = mapHeight - 1;
        let maxY = 0;
        let hasWall = false;

        // If seed exists and belongs to roadType wall, only analyze that connected component.
        if (options.seed && inBounds(options.seed.x, options.seed.y) && isWall(options.seed.x, options.seed.y)) {
            const queue: Vec2[] = [new Vec2(options.seed.x, options.seed.y)];
            const visited = new Set<string>([keyOf(options.seed.x, options.seed.y)]);

            while (queue.length > 0) {
                const cur = queue.shift()!;
                hasWall = true;
                if (cur.x < minX) minX = cur.x;
                if (cur.x > maxX) maxX = cur.x;
                if (cur.y < minY) minY = cur.y;
                if (cur.y > maxY) maxY = cur.y;

                for (const d of dirs) {
                    const nx = cur.x + d[0];
                    const ny = cur.y + d[1];
                    if (!inBounds(nx, ny)) continue;
                    if (!isWall(nx, ny)) continue;
                    const k = keyOf(nx, ny);
                    if (visited.has(k)) continue;
                    visited.add(k);
                    queue.push(new Vec2(nx, ny));
                }
            }
        } else {
            // Fallback: analyze all walls of this roadType in full map.
            for (let x = 0; x < mapWidth; x++) {
                for (let y = 0; y < mapHeight; y++) {
                    if (!isWall(x, y)) continue;
                    hasWall = true;
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (!hasWall) {
            return [];
        }

        // Expand local analyze area.
        minX = Math.max(0, minX - padding);
        maxX = Math.min(mapWidth - 1, maxX + padding);
        minY = Math.max(0, minY - padding);
        maxY = Math.min(mapHeight - 1, maxY + padding);

        // Mark outside-reachable area (non-wall) using flood fill from local border.
        const reachable = new Set<string>();
        const floodQueue: Vec2[] = [];
        const pushIfReachable = (x: number, y: number) => {
            if (x < minX || x > maxX || y < minY || y > maxY) return;
            if (isWall(x, y)) return;
            const k = keyOf(x, y);
            if (reachable.has(k)) return;
            reachable.add(k);
            floodQueue.push(new Vec2(x, y));
        };

        for (let x = minX; x <= maxX; x++) {
            pushIfReachable(x, minY);
            pushIfReachable(x, maxY);
        }
        for (let y = minY; y <= maxY; y++) {
            pushIfReachable(minX, y);
            pushIfReachable(maxX, y);
        }

        while (floodQueue.length > 0) {
            const cur = floodQueue.shift()!;
            for (const d of dirs) {
                const nx = cur.x + d[0];
                const ny = cur.y + d[1];
                if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
                if (isWall(nx, ny)) continue;
                const k = keyOf(nx, ny);
                if (reachable.has(k)) continue;
                reachable.add(k);
                floodQueue.push(new Vec2(nx, ny));
            }
        }

        // Non-wall and non-reachable cells are enclosed by same road type.
        // Only return truly empty cells to avoid overwriting other tile types.
        const fillCells: Vec2[] = [];
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                if (isWall(x, y)) continue;
                const k = keyOf(x, y);
                if (reachable.has(k)) continue;
                if (!isFillableEmpty(x, y)) continue;
                fillCells.push(new Vec2(x, y));
            }
        }

        return fillCells;
    }

    /**
     * Apply enclosed-cell fill result into placeholder tilemap.
     * Rendering/update is intentionally not handled here.
     */
    public static applyFillResult(
        placeholderTilemap: Map<string, PlaceholderCell>,
        roadType: number,
        cells: Vec2[],
        cfgId: number,
    ): void {
        for (let i = 0; i < cells.length; i++) {
            const p = cells[i];
            placeholderTilemap.set(`${p.x},${p.y}`, {
                _type: 2,
                empty: false,
                _tileType: roadType,
                cfgId,
            });
        }
    }
}

/**
 * Convenience function if you prefer function-style call.
 */
export function computeSameTypeClosedFillCells(options: ComputeFillOptions): Vec2[] {
    return RoadClosureFillUtil.computeEnclosedEmptyCells(options);
}

