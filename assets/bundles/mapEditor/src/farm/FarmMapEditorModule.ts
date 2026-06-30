import { Node, Sprite } from 'cc';
import { FarmMapBackgroundLayer } from './FarmMapBackgroundLayer';

/** 场景 mapBg 节点上的草地 Sprite：农场分包底图加载时需关闭，离开时恢复 */
export function setMapBgGrassSpriteVisible(mapBgNode: Node | null | undefined, visible: boolean): void {
    if (!mapBgNode?.isValid) return;
    const sp = mapBgNode.getComponent(Sprite);
    if (sp) {
        sp.enabled = visible;
    }
}

export interface FarmMapEditorStartOptions {
    disMapContainer: Node;
    mapBgNode: Node | null;
    mapPixelWidth: number;
    mapPixelHeight: number;
}

/**
 * mapGameType===0 时农场专属编辑器逻辑聚合入口。
 * 分包底图、mapBg 草地显隐等固定需求放在此处；后续扩展（相机默认值、遮罩等）可继续挂在本模块。
 */
export class FarmMapEditorModule {
    private readonly background = new FarmMapBackgroundLayer();

    onEditorStart(opts: FarmMapEditorStartOptions): void {
        setMapBgGrassSpriteVisible(opts.mapBgNode, false);
        this.background.setup(opts.disMapContainer, opts.mapPixelWidth, opts.mapPixelHeight);
    }

    whenBackgroundReady(): Promise<void> {
        return this.background.whenReady();
    }

    dispose(mapBgNode: Node | null | undefined): void {
        this.background.dispose();
        setMapBgGrassSpriteVisible(mapBgNode, true);
    }
}
