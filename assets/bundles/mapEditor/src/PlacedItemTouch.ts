import { _decorator, Component, EventTouch, Node, UITransform } from 'cc';
import { ActionStatus, MapManager } from './MapManager';
import { MapEditor } from './MapEditor';

const { ccclass } = _decorator;

export type PlacedItemTouchMeta = {
    tileType: string;
    configId: string;
    belong?: string;
    decorKey?: string;
    mapItemKey?: string;
    grid?: string;
};

/**
 * 已摆放图片道具触摸（实验功能）。
 * 整文件 + MapEditor.bindPlacedItemTouch 可一并删除回退。
 */
@ccclass('PlacedItemTouch')
export class PlacedItemTouch extends Component {
    private meta: PlacedItemTouchMeta | null = null;
    private touchNode: Node | null = null;

    public setup(meta: PlacedItemTouchMeta): void {
        this.meta = meta;
        this.bindTouchTarget(this.resolveTouchTarget());
    }

    onDestroy() {
        this.unbindTouch();
    }

    private resolveTouchTarget(): Node {
        // 根节点有 map_size 的 UITransform，刚放下时比子 Sprite 更可靠
        return this.node;
    }

    private bindTouchTarget(node: Node) {
        this.unbindTouch();
        this.touchNode = node;
        if (!node.getComponent(UITransform)) {
            node.addComponent(UITransform);
        }
        node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    private unbindTouch() {
        if (this.touchNode?.isValid) {
            this.touchNode.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        }
        this.touchNode = null;
    }

    private onTouchEnd(event: EventTouch) {
        const status = MapManager.GetInstance().actionStatus;
        if (status !== ActionStatus.Back && status !== ActionStatus.Move) {
            return;
        }
        if (!this.meta) {
            return;
        }

        event.propagationStopped = true;
        const editor = MapManager.GetInstance().getMapEditor() as MapEditor | null;
        editor?.handlePlacedItemTouch(this.node, this.meta);
    }
}