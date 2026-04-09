import { _decorator, Label, Node, UITransform } from 'cc';
import InfiniteCell from 'db://assets/plugin/InfiniteList/InfiniteCell';
const { ccclass, property } = _decorator;

@ccclass('ChatListCell')
export class ChatListCell extends InfiniteCell {
    @property(Node)
    public myNode: Node | null = null;

    @property(Node)
    public otherNode: Node | null = null;

    private myBaseY = 0;
    private otherBaseY = 0;

    onLoad() {
        this.myNode = this.myNode || this.node.getChildByName('my');
        this.otherNode = this.otherNode || this.node.getChildByName('other');
        this.myBaseY = this.myNode ? this.myNode.position.y : 0;
        this.otherBaseY = this.otherNode ? this.otherNode.position.y : 0;
    }

    private getBubbleLabel(isSelf: boolean): Label | null {
        const holder = isSelf ? this.myNode : this.otherNode;
        const labelNode = holder?.getChildByName('Sprite')?.getChildByName('Label');
        return labelNode?.getComponent(Label) ?? null;
    }

    /** 设置文本并按“超过2行”上移 30 像素 */
    public setMessageText(text: string, isSelf: boolean) {
        const my = this.myNode;
        const other = this.otherNode;

        if (my) {
            my.active = isSelf;
            my.setPosition(my.position.x, this.myBaseY, my.position.z);
        }
        if (other) {
            other.active = !isSelf;
            other.setPosition(other.position.x, this.otherBaseY, other.position.z);
        }

        const lb = this.getBubbleLabel(isSelf);
        if (!lb) return;
        lb.string = text || '';
        lb.updateRenderData(true);

        const ut = lb.node.getComponent(UITransform);
        const textH = ut?.contentSize?.height ?? 0;
        const lineHeight = Math.max(1, lb.lineHeight || 1);
        const lineCount = Math.max(1, Math.ceil(textH / lineHeight));
        const dy = lineCount > 2 ? 30 : 0;

        // 需求：超过2行时，my/other 节点上移 30（复用前已恢复 baseY）
        if (dy !== 0) {
            if (my) my.setPosition(my.position.x, this.myBaseY + dy, my.position.z);
            if (other) other.setPosition(other.position.x, this.otherBaseY + dy, other.position.z);
        }
    }

    UpdateContent(data: any): void {
        // data: { kind:'msg', msg: PrivateMsg }
        const msg = data?.msg;
        const isSelf = msg?.role === 'self';
        const text = msg?.text != null ? String(msg.text) : '';
        this.setMessageText(text, isSelf);
    }
}

