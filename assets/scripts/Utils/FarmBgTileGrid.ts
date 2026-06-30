import { ImageAsset, Rect, Size, SpriteFrame, Texture2D, Vec2, assetManager } from 'cc';

/** farm/bg 大地图分块边长（像素）。离线导出多张 PNG 见项目 tools/split_image_to_1024.py */
export const FARM_BG_TILE_SIZE = 1024;

/**
 * 农场底图拼接步长（像素），必须与分包内「整格」PNG 边长一致（当前 maps/farm/bg 整格为 256×256）。
 * 若重新导出底图尺寸，请同步改 {@link FarmMapConstants} 中边缘块宽高与本常量。
 * 拼接在本地底图坐标内完成，再由 FarmMapBackgroundLayer 根节点整体缩放铺满地图像素范围。
 */
export const FARM_BG_LAYOUT_GRID = 256;

export interface TileSliceItem {
    row: number;
    col: number;
    /** 拼接布局中的显示宽（与旧版 resized_bg 网格一致） */
    width: number;
    /** 拼接布局中的显示高 */
    height: number;
    spriteFrame: SpriteFrame;
}

/** 农场底图 10×9 马赛克网格描述（与 FarmMapConstants 中设计尺寸一致） */
export interface FarmBgMosaicGridSpec {
    cols: number;
    rows: number;
    designMosaicWidth: number;
    designMosaicHeight: number;
    colWidth: (col: number) => number;
    rowHeight: (row: number) => number;
    colLeft: (col: number) => number;
    rowTop: (row: number) => number;
}

/**
 * 按与 resized_bg 相同的马赛克网格，从 HD 整图纹理切块（非固定 1024 网格）。
 * 布局尺寸用设计宽/高，保证与 FARM_BG_USE_HD=false 时画面一致。
 */
export function sliceTextureToMosaicGrid(texture: Texture2D, spec: FarmBgMosaicGridSpec): TileSliceItem[] {
    const tw = texture.width;
    const th = texture.height;
    if (tw <= 0 || th <= 0 || spec.designMosaicWidth <= 0 || spec.designMosaicHeight <= 0) {
        return [];
    }

    const scaleX = tw / spec.designMosaicWidth;
    const scaleY = th / spec.designMosaicHeight;
    const out: TileSliceItem[] = [];

    for (let row = 0; row < spec.rows; row++) {
        for (let col = 0; col < spec.cols; col++) {
            const x0Design = spec.colLeft(col);
            const y0Design = spec.rowTop(row);
            const wDesign = spec.colWidth(col);
            const hDesign = spec.rowHeight(row);

            const x = Math.round(x0Design * scaleX);
            const yTop = Math.round(y0Design * scaleY);
            const w = Math.max(1, Math.round(wDesign * scaleX));
            const h = Math.max(1, Math.round(hDesign * scaleY));
            const yBl = th - yTop - h;
            const rect = new Rect(x, yBl, w, h);

            const sf = new SpriteFrame();
            sf.texture = texture;
            sf.rect = rect;
            sf.originalSize = new Size(wDesign, hDesign);
            sf.offset = new Vec2(0, 0);
            sf.packable = false;

            out.push({ row, col, width: wDesign, height: hDesign, spriteFrame: sf });
        }
    }
    return out;
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
 * 从 mapEditor 分包加载底图纹理（不切片）。
 */
export function loadFarmBgTexture(
    assetPath: string,
    done: (err: Error | null, texture: Texture2D | null, ownsTexture: boolean) => void,
): void {
    const tryLoadFromBundle = (bundle: import('cc').AssetManager.Bundle) => {
        bundle.load(assetPath, ImageAsset, (err, img) => {
            if (!err && img?.width > 0) {
                const tex = new Texture2D();
                tex.image = img;
                done(null, tex, true);
                return;
            }
            bundle.load(`${assetPath}/spriteFrame`, SpriteFrame, (err2, sf) => {
                if (!err2 && sf?.texture) {
                    done(null, sf.texture as Texture2D, false);
                    return;
                }
                bundle.load(assetPath, SpriteFrame, (err3, sf2) => {
                    if (!err3 && sf2?.texture) {
                        done(null, sf2.texture as Texture2D, false);
                        return;
                    }
                    done(err || err2 || err3 || new Error(`${assetPath} 加载失败`), null, false);
                });
            });
        });
    };

    assetManager.loadBundle('mapEditor', (err, bundle) => {
        if (err || !bundle) {
            done(err || new Error('mapEditor bundle 加载失败'), null, false);
            return;
        }
        tryLoadFromBundle(bundle);
    });
}

/**
 * 从 mapEditor 分包加载指定路径底图，按 1024×1024 切成多块 SpriteFrame。
 */
export function loadFarmBgTextureTiles(
    assetPath: string,
    done: (err: Error | null, result: FarmBgTilesLoadResult | null) => void,
): void {
    loadFarmBgTexture(assetPath, (err, texture, ownsTexture) => {
        if (err || !texture) {
            done(err ?? new Error(`${assetPath} 加载失败`), null);
            return;
        }
        const tiles = sliceTextureToTiles(texture, FARM_BG_TILE_SIZE, FARM_BG_TILE_SIZE);
        const tw = texture.width;
        const th = texture.height;
        const cols = Math.ceil(tw / FARM_BG_TILE_SIZE);
        const rows = Math.ceil(th / FARM_BG_TILE_SIZE);
        done(null, { texture, ownsTexture, tiles, cols, rows });
    });
}

/**
 * 加载 HD 整图，并按与 resized_bg 相同的马赛克网格切片。
 */
export function loadFarmBgMosaicTexture(
    assetPath: string,
    spec: FarmBgMosaicGridSpec,
    done: (err: Error | null, result: FarmBgTilesLoadResult | null) => void,
): void {
    loadFarmBgTexture(assetPath, (err, texture, ownsTexture) => {
        if (err || !texture) {
            done(err ?? new Error(`${assetPath} 加载失败`), null);
            return;
        }
        const tiles = sliceTextureToMosaicGrid(texture, spec);
        done(null, {
            texture,
            ownsTexture,
            tiles,
            cols: spec.cols,
            rows: spec.rows,
        });
    });
}

/**
 * 从 mapEditor 分包加载 `maps/farm/bg`，按 1024×1024 切成多块 SpriteFrame。
 * 使用前需已加载 bundle，或直接由本函数内部 loadBundle。
 */
export function loadFarmBgTiles1024(
    done: (err: Error | null, result: FarmBgTilesLoadResult | null) => void,
): void {
    loadFarmBgTextureTiles('maps/farm/bg', done);
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
