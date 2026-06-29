import { _decorator, Color, Component, Label, Node, resources, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GongfangTuzhiItem')
export class GongfangTuzhiItem extends Component {
    @property(Label)
    showNum: Label = null;

    @property(Sprite)
    icon: Sprite = null;

    @property(Node)
    emptyNode: Node = null;

    private itemId = 0;

    public refreshEmpty() {
        this.itemId = 0;
        if (this.emptyNode) {
            this.emptyNode.active = true;
        }
        if (this.icon?.node) {
            this.icon.node.active = false;
        }
        if (this.showNum) {
            this.showNum.string = '';
        }
    }

    public refreshMaterial(itemId: number, needCount: number, ownedCount: number) {
        this.itemId = itemId;
        if (this.emptyNode) {
            this.emptyNode.active = false;
        }
        if (this.icon?.node) {
            this.icon.node.active = true;
        }
        if (this.showNum) {
            this.showNum.string = `${ownedCount}/${needCount}`;
            this.showNum.color = ownedCount >= needCount ? Color.WHITE : new Color(255, 107, 107, 255);
        }
        this.loadItemIcon(itemId);
    }

    private loadItemIcon(itemId: number) {
        if (!this.icon?.isValid || !Number.isFinite(itemId) || itemId <= 0) {
            return;
        }
        resources.load(`UITexture/itemIcon/${itemId}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (!err && sf && this.icon?.isValid) {
                this.icon.spriteFrame = sf;
                return;
            }
            resources.load(`common/image/item_${itemId}/spriteFrame`, SpriteFrame, (err2, sf2) => {
                if (!err2 && sf2 && this.icon?.isValid) {
                    this.icon.spriteFrame = sf2;
                }
            });
        });
    }
}
