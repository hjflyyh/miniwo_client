import { _decorator, Component, EditBox, Node, Sprite, SpriteFrame } from 'cc';
import { AppConst } from '../../AppConst';
import { FollowEditableGroup } from './FollowEditableGroup';
const { ccclass, property } = _decorator;

@ccclass('FollowImgSetting')
export class FollowImgSetting extends Component {
    public openData = {};

    @property(Sprite)
    public imgSp: Sprite;

    @property(Node)
    public editImgTmp: Node;

    @property(Node)
    public dragLimitNode: Node | null = null;

    start() {
        this.openData = this.node['_openParam'];

        let frame: SpriteFrame | null = null;
        for (let i = 0; i < AppConst.JournalManager.journalImgs.length; i++) {
            if (
                AppConst.JournalManager.journalImgs[i]['id'] == this.openData['id'] &&
                AppConst.JournalManager.journalImgs[i]['type'] == this.openData['type']
            ) {
                frame = AppConst.JournalManager.imgSprite[AppConst.JournalManager.journalImgs[i]['localImgIndex']];
                this.imgSp.spriteFrame = frame;
                break;
            }
        }

        this._initEditableNodes(frame);
    }

    protected onDestroy(): void {
        EventSystem.send("OnSaveFollowSettingImg" , this.openData)
    }

    private _findChildByNameRecursive(root: Node, name: string): Node | null {
        const direct = root.getChildByName(name);
        if (direct) return direct;
        for (let i = 0; i < root.children.length; i++) {
            const found = this._findChildByNameRecursive(root.children[i], name);
            if (found) return found;
        }
        return null;
    }

    private _collectByPrefix(root: Node, prefix: string, out: Node[]) {
        if (root.name.startsWith(prefix)) {
            out.push(root);
        }
        for (let i = 0; i < root.children.length; i++) {
            this._collectByPrefix(root.children[i], prefix, out);
        }
    }

    private _initEditableNodes(frame: SpriteFrame | null) {
        const limitNode = this.dragLimitNode ?? this._findChildByNameRecursive(this.node, 'editNode');

        const imgNodes: Node[] = [];
        this._collectByPrefix(this.node, 'editImg', imgNodes);
        for (let i = 0; i < imgNodes.length; i++) {
            const comp = imgNodes[i].getComponent(FollowEditableGroup) ?? imgNodes[i].addComponent(FollowEditableGroup);
            comp.setDragLimitNode(limitNode);
            comp.init({
                type: 'editImg',
                spriteFrame: frame,
            });
        }

        const boxNodes: Node[] = [];
        this._collectByPrefix(this.node, 'editBox', boxNodes);
        for (let i = 0; i < boxNodes.length; i++) {
            const comp = boxNodes[i].getComponent(FollowEditableGroup) ?? boxNodes[i].addComponent(FollowEditableGroup);
            comp.setDragLimitNode(limitNode);
            const text = boxNodes[i].getChildByName('tmpEditBox')?.getComponent(EditBox)?.string ?? '';
            comp.init({
                type: 'editBox',
                text,
            });
        }
    }

    onClickBg(){
    }
}
