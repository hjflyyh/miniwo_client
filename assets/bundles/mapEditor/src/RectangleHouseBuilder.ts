import { Vec2 } from 'cc';

export interface RectangleHouseCandidate {
    id: string;
    width: number;
    height: number;
    topLeft: Vec2;
    topRight: Vec2;
    bottomLeft: Vec2;
    bottomRight: Vec2;
    cells: Vec2[];
}

export interface RectangleHouseBuildOptions {
    /**
     * Pending floor points. Usually from buildFloorPoints.
     */
    floorPoints: Vec2[];
    /**
     * Min rectangle width in grid cells.
     * Default: 8
     */
    minWidth?: number;
    /**
     * Min rectangle height in grid cells.
     * Default: 10
     */
    minHeight?: number;
    /**
     * Optional map data checker. If provided, candidate must pass this checker.
     * Return true means pass.
     */
    passExtraCheck?: (cell: Vec2) => boolean;
}

export interface RectangleHouseBuildResult {
    built: RectangleHouseCandidate[];
    consumedKeys: Set<string>;
}

/**
 * New rectangle house builder (independent from old checkBuildHouse logic).
 *
 * Key differences vs old logic:
 * - Uses strict 4-neighbour grouping to avoid diagonal merge issues
 * - Never early-returns all candidates because one group fails
 * - Supports custom min size; defaults to width>=8 and height>=10
 */
export class RectangleHouseBuilder {
    public static collectBuildableRectangles(options: RectangleHouseBuildOptions): RectangleHouseCandidate[] {
        const points = options.floorPoints ?? [];
        const minWidth = options.minWidth ?? 8;
        const minHeight = options.minHeight ?? 10;
        const passExtraCheck = options.passExtraCheck;

        if (points.length === 0) {
            return [];
        }

        const keyOf = (p: Vec2): string => `${p.x},${p.y}`;
        const pointMap = new Map<string, Vec2>();
        for (let i = 0; i < points.length; i++) {
            pointMap.set(keyOf(points[i]), points[i]);
        }

        const groups = this.groupBy4Neighbour(pointMap);
        const candidates: RectangleHouseCandidate[] = [];

        for (let gi = 0; gi < groups.length; gi++) {
            const group = groups[gi];
            if (group.length < minWidth * minHeight) {
                EventSystem.send("ShowTips", `房屋建造失败：宽至少${minWidth}格，高至少${minHeight}格`)
                continue;
            }

            const rect = this.tryBuildRectangleCandidate(group, minWidth, minHeight);
            if (!rect) {
                continue;
            }

            if (passExtraCheck) {
                let ok = true;
                for (let i = 0; i < rect.cells.length; i++) {
                    if (!passExtraCheck(rect.cells[i])) {
                        ok = false;
                        break;
                    }
                }
                if (!ok) {
                    continue;
                }
            }

            candidates.push(rect);
        }

        return candidates;
    }

    private static groupBy4Neighbour(pointMap: Map<string, Vec2>): Vec2[][] {
        const visited = new Set<string>();
        const groups: Vec2[][] = [];
        const dirs = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];

        pointMap.forEach((seed, key) => {
            if (visited.has(key)) {
                return;
            }

            const queue: Vec2[] = [seed];
            visited.add(key);
            const group: Vec2[] = [];

            while (queue.length > 0) {
                const cur = queue.shift()!;
                group.push(cur);

                for (let i = 0; i < dirs.length; i++) {
                    const nx = cur.x + dirs[i][0];
                    const ny = cur.y + dirs[i][1];
                    const nk = `${nx},${ny}`;
                    if (visited.has(nk)) {
                        continue;
                    }
                    const next = pointMap.get(nk);
                    if (!next) {
                        continue;
                    }
                    visited.add(nk);
                    queue.push(next);
                }
            }

            groups.push(group);
        });

        return groups;
    }

    private static tryBuildRectangleCandidate(
        group: Vec2[],
        minWidth: number,
        minHeight: number,
    ): RectangleHouseCandidate | null {
        let minX = group[0].x;
        let maxX = group[0].x;
        let minY = group[0].y;
        let maxY = group[0].y;

        const set = new Set<string>();
        for (let i = 0; i < group.length; i++) {
            const p = group[i];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
            set.add(`${p.x},${p.y}`);
        }

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        if (width < minWidth || height < minHeight) {
            EventSystem.send("ShowTips", `房屋建造失败：宽至少${minWidth}格，高至少${minHeight}格`)
            return null;
        }

        // Must be a full rectangle (no holes/missing cells).
        if (group.length !== width * height) {
            return null;
        }

        const cells: Vec2[] = [];
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                if (!set.has(`${x},${y}`)) {
                    return null;
                }
                cells.push(new Vec2(x, y));
            }
        }

        return {
            id: `rect_${minX}_${minY}_${maxX}_${maxY}`,
            width,
            height,
            topLeft: new Vec2(minX, minY),
            topRight: new Vec2(maxX, minY),
            bottomLeft: new Vec2(minX, maxY),
            bottomRight: new Vec2(maxX, maxY),
            cells,
        };
    }
}

