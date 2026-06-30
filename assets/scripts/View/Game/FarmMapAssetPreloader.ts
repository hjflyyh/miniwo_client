import { assetManager, AssetManager, Prefab, SpriteFrame } from "cc";
import { AppConst } from "../../AppConst";

/**
 * 进入农场地图(mapGameType===0)前预加载 mapEditor 分包内农场资源，避免进图后底图/农田 prefab 逐张闪现。
 */
export class FarmMapAssetPreloader {
    public static preload(onProgress?: (ratio: number) => void): Promise<void> {
        const paths = collectFarmAssetPaths();
        if (paths.length <= 0) {
            onProgress?.(1);
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const run = (bundle: AssetManager.Bundle) => {
                let done = 0;
                const total = paths.length;
                const report = () => {
                    done++;
                    onProgress?.(Math.min(1, done / total));
                };

                const batchSize = 8;
                const runBatch = async (start: number) => {
                    if (start >= total) {
                        onProgress?.(1);
                        resolve();
                        return;
                    }
                    const end = Math.min(start + batchSize, total);
                    const tasks: Promise<void>[] = [];
                    for (let i = start; i < end; i++) {
                        tasks.push(
                            loadBundlePath(bundle, paths[i]).then(report)
                        );
                    }
                    await Promise.all(tasks);
                    await runBatch(end);
                };

                void runBatch(0).catch((e) => reject(e));
            };

            const existing = assetManager.getBundle('mapEditor');
            if (existing) {
                run(existing);
                return;
            }
            assetManager.loadBundle('mapEditor', (err, bundle) => {
                if (err || !bundle) {
                    reject(err ?? new Error('loadBundle mapEditor failed'));
                    return;
                }
                run(bundle);
            });
        });
    }
}

function collectFarmAssetPaths(): string[] {
    const paths: string[] = [];
    const seen = new Set<string>();

    const add = (path: string) => {
        const p = (path ?? '').trim();
        if (!p || seen.has(p)) {
            return;
        }
        seen.add(p);
        paths.push(p);
    };

    const tileDir = "maps/farm/bgHD"
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 10; c++) {
            const serial = r * 10 + c + 1;
            add(`${tileDir}/${farmBgSliceName(serial)}/spriteFrame`);
        }
    }

    const mapEdit = AppConst.JSONManager?.getItemAll?.('mapEdit') as Record<string, any> | null;
    if (mapEdit) {
        for (const id in mapEdit) {
            const row = mapEdit[id] || {};
            const resource = row.resource != null ? String(row.resource) : '';
            if (!resource.startsWith('maps/farm/')) {
                continue;
            }
            const isPrefab = Number(row.is_prefab) === 1;
            if (isPrefab) {
                add(resource);
            } else {
                add(`${resource}/spriteFrame`);
            }
        }
    }

    return paths;
}

function farmBgSliceName(serial: number): string {
    const n = Math.floor(serial);
    if (n <= 0) {
        return 'resized_bg_01';
    }
    if (n < 100) {
        const s = String(n);
        return `resized_bg_${s.length < 2 ? '0' + s : s}`;
    }
    return `resized_bg_${n}`;
}

function loadBundlePath(
    bundle: AssetManager.Bundle,
    path: string
): Promise<void> {
    return new Promise((resolve) => {
        const trySprite = () => {
            bundle.load(path, SpriteFrame, (err) => {
                if (!err) {
                    resolve();
                    return;
                }
                if (path.endsWith('/spriteFrame')) {
                    const base = path.slice(0, -'/spriteFrame'.length);
                    bundle.load(base, SpriteFrame, () => resolve());
                    return;
                }
                bundle.load(path, Prefab, () => resolve());
            });
        };
        trySprite();
    });
}