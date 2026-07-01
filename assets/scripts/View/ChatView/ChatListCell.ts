import { _decorator, Label, Node, Sprite, UITransform } from 'cc';
import InfiniteCell from 'db://assets/plugin/InfiniteList/InfiniteCell';
import { Utils } from '../../Utils/Utils';
import { applyMyBubbleLayout } from './ChatMyBubbleLayout';
const { ccclass, property } = _decorator;

@ccclass('ChatListCell')
export class ChatListCell extends InfiniteCell {
    @property(Node)
    public myNode: Node | null = null;

    @property(Node)
    public otherNode: Node | null = null;

    private myBaseY = 0;
    private otherBaseY = 0;

    @property(Sprite)
    private npcHead : Sprite;

    onLoad() {
        this.myNode = this.myNode || this.node.getChildByName('my');
        this.otherNode = this.otherNode || this.node.getChildByName('other');
        this.myBaseY = this.myNode ? this.myNode.position.y : 0;
        this.otherBaseY = this.otherNode ? this.otherNode.position.y : 0;
    }

    private getBubbleNodes(isSelf: boolean): {
        bubble: Node | null;
        label: Label | null;
    } {
        const holder = isSelf ? this.myNode : this.otherNode;
        const bubble = holder?.getChildByName('Sprite') ?? null;
        const label = bubble?.getChildByName('Label')?.getComponent(Label) ?? null;
        return { bubble, label };
    }

    /** 自己消息：底图宽高随文字；对方消息：保持 prefab 固定宽逻辑 */
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

        if (isSelf) {
            const { bubble, label } = this.getBubbleNodes(true);
            if (bubble && label && this.myNode) {
                applyMyBubbleLayout(this.myNode, bubble, label, text);
            }
            return;
        }

        const lb = this.getBubbleNodes(false).label;
        if (!lb) {
            return;
        }
        lb.string = text || '';
        lb.updateRenderData(true);

        const ut = lb.node.getComponent(UITransform);
        const textH = ut?.contentSize?.height ?? 0;
        const lineHeight = Math.max(1, lb.lineHeight || 1);
        const lineCount = Math.max(1, Math.ceil(textH / lineHeight));
        const dy = lineCount > 2 ? 30 : 0;

        if (dy !== 0 && other) {
            other.setPosition(other.position.x, this.otherBaseY + dy, other.position.z);
        }
    }

    UpdateContent(data: any): void {
        const msg = data?.msg;
        const isSelf = msg?.role === 'self';
        const text = msg?.text != null ? String(msg.text) : '';
        this.setMessageText(text, isSelf);

        const avatar = data?.npc_sprite_url != null
            ? String(data.npc_sprite_url)
            : (data?.npc_avatar != null ? String(data.npc_avatar) : '');
        if (!this.npcHead) return;
        if (isSelf || !avatar) {
            this.npcHead.spriteFrame = null;
            return;
        }
        Utils.loadCover(avatar, this.npcHead , 130 , 130);
    }

    onClickNpcHead(){
        
    }
}
