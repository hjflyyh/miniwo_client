import { assetManager, AssetManager, Prefab, SpriteFrame } from 'cc';
import { AppConst } from '../../../../scripts/AppConst';
import { FARM_BG_HD_TILE_DIR, FARM_BG_TILE_COLS, FARM_BG_TILE_ROWS, FARM_BG_USE_HD } from './FarmMapConstants';

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

    const tileDir = FARM_BG_USE_HD ? FARM_BG_HD_TILE_DIR : 'maps/farm/bg';
    for (let r = 0; r < FARM_BG_TILE_ROWS; r++) {
        for (let c = 0; c < FARM_BG_TILE_COLS; c++) {
            const serial = r * FARM_BG_TILE_COLS + c + 1;
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


