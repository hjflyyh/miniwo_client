import { ImageAsset, Rect, Size, SpriteFrame, Texture2D, Vec2, assetManager } from 'cc';

/** farm/bg 大地图分块边长（像素）。离线导出多张 PNG 见项目 tools/split_image_to_1024.py */
export const FARM_BG_TILE_SIZE = 1024;

export interface TileSliceItem {
    row: number;
    col: number;
    /** 该块宽（边缘块可能 < 1024） */
    width: number;
    /** 该块高（边缘块可能 < 1024） */
    height: number;
    spriteFrame: SpriteFrame;
}

/**
 * 将整张纹理按固定像素网格切块（左→右为 col，上→下为 row）。
 * 纹理坐标：cc.Rect 左下角原点，y 向上。
 */
export function sliceTextureToTiles(texture: Texture2D, tileW: number, tileH: number): TileSliceItem[] {
    const tw = texture.width;
    const th = texture.height;
    if (tw <= 0 || th <= 0 || tileW <= 0 || tileH <= 0) return [];

    const cols = Math.ceil(tw / tileW);
    const rows = Math.ceil(th / tileH);
    const out: TileSliceItem[] = [];

    for (let row = 0; row < rows; row++) {
        const yTop = row * tileH;
        const h = Math.min(tileH, th - yTop);
        if (h <= 0) break;

        for (let col = 0; col < cols; col++) {
            const x = col * tileW;
            const w = Math.min(tileW, tw - x);
            if (w <= 0) break;

            const yBl = th - yTop - h;
            const rect = new Rect(x, yBl, w, h);

            const sf = new SpriteFrame();
            sf.texture = texture;
            sf.rect = rect;
            sf.originalSize = new Size(w, h);
            sf.offset = new Vec2(0, 0);
            sf.packable = false;

            out.push({ row, col, width: w, height: h, spriteFrame: sf });
        }
    }
    return out;
}

export interface FarmBgTilesLoadResult {
    texture: Texture2D;
    /** 为本加载创建的 Texture2D，用完需 destroy */
    ownsTexture: boolean;
    tiles: TileSliceItem[];
    cols: number;
    rows: number;
}

/**
 * 从 mapEditor 分包加载 `maps/farm/bg`，按 1024×1024 切成多块 SpriteFrame。
 * 使用前需已加载 bundle，或直接由本函数内部 loadBundle。
 */
export function loadFarmBgTiles1024(
    done: (err: Error | null, result: FarmBgTilesLoadResult | null) => void,
): void {
    const finish = (texture: Texture2D, ownsTexture: boolean) => {
        const tiles = sliceTextureToTiles(texture, FARM_BG_TILE_SIZE, FARM_BG_TILE_SIZE);
        const tw = texture.width;
        const th = texture.height;
        const cols = Math.ceil(tw / FARM_BG_TILE_SIZE);
        const rows = Math.ceil(th / FARM_BG_TILE_SIZE);
        done(null, { texture, ownsTexture, tiles, cols, rows });
    };

    const tryLoadFromBundle = (bundle: import('cc').AssetManager.Bundle) => {
        const path = 'maps/farm/bg';
        bundle.load(path, ImageAsset, (err, img) => {
            if (!err && img?.width > 0) {
                const tex = new Texture2D();
                tex.image = img;
                finish(tex, true);
                return;
            }
            bundle.load(`${path}/spriteFrame`, SpriteFrame, (err2, sf) => {
                if (!err2 && sf?.texture) {
                    finish(sf.texture as Texture2D, false);
                    return;
                }
                bundle.load(path, SpriteFrame, (err3, sf2) => {
                    if (!err3 && sf2?.texture) {
                        finish(sf2.texture as Texture2D, false);
                        return;
                    }
                    done(err || err2 || err3 || new Error('maps/farm/bg 加载失败'), null);
                });
            });
        });
    };

    assetManager.loadBundle('mapEditor', (err, bundle) => {
        if (err || !bundle) {
            done(err || new Error('mapEditor bundle 加载失败'), null);
            return;
        }
        tryLoadFromBundle(bundle);
    });
}

/** 释放 loadFarmBgTiles1024 且 ownsTexture 为 true 时创建的纹理，并销毁所有切片 SpriteFrame */
export function disposeFarmBgTiles(result: FarmBgTilesLoadResult | null): void {
    if (!result) return;
    for (const t of result.tiles) {
        if (t.spriteFrame?.isValid) t.spriteFrame.destroy();
    }
    result.tiles.length = 0;
    if (result.ownsTexture && result.texture?.isValid) {
        result.texture.destroy();
    }
}
