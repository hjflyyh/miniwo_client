import { FARM_BG_LAYOUT_GRID } from '../../../../scripts/Utils/FarmBgTileGrid';

/** mapGameType===0 农场模式下的逻辑格子数量 */
export const FARM_MAP_GRID_WIDTH = 303 / 2;
export const FARM_MAP_GRID_HEIGHT = 262 /2;

/** 农场底图横向块数（resized_bg_01～一行 10 块，换行递增；共 90 张 → 10×9） */
export const FARM_BG_TILE_COLS = 10;

/** 农场底图纵向块数（与 resized_bg 共 90 张一致） */
export const FARM_BG_TILE_ROWS = 9;

/**
 * 最右列裁切块宽度（像素）。当前 `maps/farm/bg/resized_bg_*0.png`（10、20…90）实测为 113。
 * 与 {@link FARM_BG_LAYOUT_GRID} 一起参与 {@link farmBgMosaicPixelWidth} 累加。
 */
export const FARM_BG_RIGHT_COL_PIXEL_W = 113;

/**
 * 最下行裁切块高度（像素）。当前底行（81～90）实测为 52。
 * 与 {@link FARM_BG_LAYOUT_GRID} 一起参与 {@link farmBgMosaicPixelHeight} 累加。
 */
export const FARM_BG_BOTTOM_ROW_PIXEL_H = 52;

/** 拼接布局中第 col 列（0-based）的设计宽度，与对应 PNG 一致 */
export function farmBgDesignColWidth(col: number): number {
    return col === FARM_BG_TILE_COLS - 1 ? FARM_BG_RIGHT_COL_PIXEL_W : FARM_BG_LAYOUT_GRID;
}

/** 拼接布局中第 row 行（0-based）的设计高度，与对应 PNG 一致 */
export function farmBgDesignRowHeight(row: number): number {
    return row === FARM_BG_TILE_ROWS - 1 ? FARM_BG_BOTTOM_ROW_PIXEL_H : FARM_BG_LAYOUT_GRID;
}

/** 底图拼接外接宽 = 各列设计宽度之和 */
export function farmBgMosaicPixelWidth(): number {
    let w = 0;
    for (let c = 0; c < FARM_BG_TILE_COLS; c++) {
        w += farmBgDesignColWidth(c);
    }
    return w;
}

/** 底图拼接外接高 = 各行设计高度之和 */
export function farmBgMosaicPixelHeight(): number {
    let h = 0;
    for (let r = 0; r < FARM_BG_TILE_ROWS; r++) {
        h += farmBgDesignRowHeight(r);
    }
    return h;
}

/** 第 col 列左缘相对拼接区域左上角的 x（向右为正） */
export function farmBgTileLeftFromMosaicOrigin(col: number): number {
    let x = 0;
    for (let i = 0; i < col; i++) {
        x += farmBgDesignColWidth(i);
    }
    return x;
}

/** 第 row 行上缘相对拼接区域左上角的 y（向下为正） */
export function farmBgTileTopFromMosaicOrigin(row: number): number {
    let y = 0;
    for (let j = 0; j < row; j++) {
        y += farmBgDesignRowHeight(j);
    }
    return y;
}
