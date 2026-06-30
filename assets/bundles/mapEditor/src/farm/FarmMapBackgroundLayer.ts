import { assetManager, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import {
    FARM_BG_HD_TILE_DIR,
    FARM_BG_TILE_COLS,
    FARM_BG_TILE_ROWS,
    FARM_BG_USE_HD,
    farmBgDesignColWidth,
    farmBgDesignRowHeight,
    farmBgMosaicPixelHeight,
    farmBgMosaicPixelWidth,
} from './FarmMapConstants';

/** 标准 SD 底图目录 */
const FARM_BG_SD_TILE_DIR = 'maps/farm/bg';

type FarmBgCellSize = { w: number; h: number };

/**
 * 农场分包底图拼接层（仅由 FarmMapEditorModule 在 mapGameType===0 时使用）。
 * SD / HD 均加载 resized_bg_XX 逐张拼接；HD 切片更大，reflow 后根节点 scale 自动缩小至 mapPixel 范围。
 */
export class FarmMapBackgroundLayer {
    private root: Node | null = null;
    private readyDone = false;
    private readyResolve: (() => void) | null = null;
    private readyPromise: Promise<void> = Promise.resolve();

    /** 底图 mosaic 全部切片加载并拼接完成（失败也会 resolve，避免 Loading 卡死） */
    whenReady(): Promise<void> {
        return this.readyPromise;
    }

    private resetReadyPromise(): void {
        this.readyDone = false;
        this.readyPromise = new Promise((resolve) => {
            this.readyResolve = () => {
                if (this.readyDone) {
                    return;
                }
                this.readyDone = true;
                resolve();
            };
        });
    }

    private markReady(): void {
        this.readyResolve?.();
    }

    dispose(): void {
        this.markReady();
        if (this.root?.isValid) {
            this.root.destroy();
            this.root = null;
        }
    }

    /**
     * @param disMapContainer 地图显示容器；在其父节点下 index 0 插入底图层并对齐位置与 layer。
     */
    setup(disMapContainer: Node, mapPixelW: number, mapPixelH: number): void {
        this.dispose();
        this.resetReadyPromise();
        const parent = disMapContainer.parent;
        if (!parent) {
            this.markReady();
            return;
        }

        const tileDir = FARM_BG_USE_HD ? FARM_BG_HD_TILE_DIR : FARM_BG_SD_TILE_DIR;

        assetManager.loadBundle('mapEditor', (err, bundle) => {
            if (err || !bundle) {
                console.warn('[FarmMapBackgroundLayer] loadBundle failed', err);
                this.markReady();
                return;
            }
            this.setupMosaicFromTiles(disMapContainer, parent, mapPixelW, mapPixelH, bundle, tileDir);
        });
    }

    private insertRoot(disMapContainer: Node, parent: Node, mosaicW: number, mosaicH: number, mapPixelW: number, mapPixelH: number): Node {
        const root = new Node('FarmBgLayer');
        root.layer = disMapContainer.layer;
        const rootUi = root.addComponent(UITransform);
        rootUi.setContentSize(mosaicW, mosaicH);
        rootUi.setAnchorPoint(0.5, 0.5);
        root.setPosition(disMapContainer.position);
        root.setScale(mapPixelW / mosaicW, mapPixelH / mosaicH, 1);
        parent.insertChild(root, 0);
        this.root = root;
        return root;
    }

    private setupMosaicFromTiles(
        disMapContainer: Node,
        parent: Node,
        mapPixelW: number,
        mapPixelH: number,
        bundle: import('cc').AssetManager.Bundle,
        tileDir: string,
    ): void {
        const cols = FARM_BG_TILE_COLS;
        const rows = FARM_BG_TILE_ROWS;

        let initW = 0;
        let initH = 0;
        for (let c = 0; c < cols; c++) initW += farmBgDesignColWidth(c);
        for (let r = 0; r < rows; r++) initH += farmBgDesignRowHeight(r);

        const root = this.insertRoot(disMapContainer, parent, initW, initH, mapPixelW, mapPixelH);
        const rootUi = root.getComponent(UITransform)!;

        const sizes: (FarmBgCellSize | null)[][] = [];
        const tileNodes: (Node | null)[][] = [];
        for (let r = 0; r < rows; r++) {
            sizes[r] = [];
            tileNodes[r] = [];
            for (let c = 0; c < cols; c++) {
                sizes[r][c] = null;
                tileNodes[r][c] = null;
            }
        }

        const columnLayoutW = (c: number): number => {
            let mw = 0;
            for (let rr = 0; rr < rows; rr++) {
                const s = sizes[rr][c];
                if (s) mw = Math.max(mw, s.w);
            }
            return mw > 0 ? mw : farmBgDesignColWidth(c);
        };

        const rowLayoutH = (r: number): number => {
            let mh = 0;
            for (let cc = 0; cc < cols; cc++) {
                const s = sizes[r][cc];
                if (s) mh = Math.max(mh, s.h);
            }
            return mh > 0 ? mh : farmBgDesignRowHeight(r);
        };

        const reflowMosaic = (): void => {
            if (!this.root?.isValid) {
                return;
            }
            const colW: number[] = [];
            for (let c = 0; c < cols; c++) {
                colW[c] = columnLayoutW(c);
            }
            const rowH: number[] = [];
            for (let r = 0; r < rows; r++) {
                rowH[r] = rowLayoutH(r);
            }
            let lw = 0;
            for (const w of colW) lw += w;
            let lh = 0;
            for (const h of rowH) lh += h;
            if (lw <= 0 || lh <= 0) {
                return;
            }
            rootUi.setContentSize(lw, lh);
            root.setScale(mapPixelW / lw, mapPixelH / lh, 1);

            let yAcc = 0;
            for (let r = 0; r < rows; r++) {
                let xAcc = 0;
                for (let c = 0; c < cols; c++) {
                    const node = tileNodes[r][c];
                    if (node?.isValid) {
                        node.setPosition(-lw / 2 + xAcc, lh / 2 - yAcc, 0);
                    }
                    xAcc += colW[c];
                }
                yAcc += rowH[r];
            }
        };

        const readSpritePixelSize = (sf: SpriteFrame): FarmBgCellSize => {
            const ow = sf.originalSize?.width ?? 0;
            const oh = sf.originalSize?.height ?? 0;
            const rw = sf.width || 0;
            const rh = sf.height || 0;
            const w = ow > 0 ? ow : rw > 0 ? rw : 0;
            const h = oh > 0 ? oh : rh > 0 ? rh : 0;
            return { w, h };
        };

        const attachSprite = (sf: SpriteFrame | null, assetBase: string, r: number, c: number) => {
            if (!sf || !this.root?.isValid) {
                return;
            }
            let { w, h } = readSpritePixelSize(sf);
            if (w <= 0 || h <= 0) {
                w = farmBgDesignColWidth(c);
                h = farmBgDesignRowHeight(r);
            }
            sizes[r][c] = { w, h };

            const tileNode = new Node(assetBase);
            tileNode.layer = root.layer;
            const sp = tileNode.addComponent(Sprite);
            sp.type = Sprite.Type.SIMPLE;
            sp.spriteFrame = sf;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            const ui = tileNode.getComponent(UITransform) ?? tileNode.addComponent(UITransform);
            ui.setContentSize(w, h);
            ui.setAnchorPoint(0, 1);

            tileNodes[r][c] = tileNode;
            root.addChild(tileNode);
            reflowMosaic();
        };

        let loaded = 0;
        const total = cols * rows;
        const onTileDone = () => {
            loaded++;
            if (loaded >= total) {
                console.log('[FarmMapBackgroundLayer] mosaic ready', {
                    tileDir,
                    hd: FARM_BG_USE_HD,
                    layout: `${rootUi.contentSize.width}x${rootUi.contentSize.height}`,
                    mapPixel: `${mapPixelW}x${mapPixelH}`,
                    scale: root.scale,
                });
                this.markReady();
            }
        };

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const serial = r * cols + c + 1;
                const assetBase = `${tileDir}/${farmBgSliceName(serial)}`;

                bundle.load(`${assetBase}/spriteFrame`, SpriteFrame, (e1, sf1) => {
                    if (!e1 && sf1) {
                        attachSprite(sf1, assetBase, r, c);
                        onTileDone();
                        return;
                    }
                    bundle.load(assetBase, SpriteFrame, (e2, sf2) => {
                        if (sf2) {
                            attachSprite(sf2, assetBase, r, c);
                        } else {
                            console.warn('[FarmMapBackgroundLayer] missing tile', assetBase, e1, e2);
                        }
                        onTileDone();
                    });
                });
            }
        }
    }
}

/** 资源名 resized_bg_XX；serial 从 1 起对应 resized_bg_01… */
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
