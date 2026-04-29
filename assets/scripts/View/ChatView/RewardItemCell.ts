import { _decorator, Component, Label, resources, Sprite, SpriteFrame , Node} from 'cc';
const { ccclass, property } = _decorator;

@ccclass('RewardItemCell')
export class RewardItemCell extends Component {
    @property(Label)
    itemName: Label = null;

    @property(Label)
    itemNum: Label = null;

    @property(Sprite)
    itemIcon: Sprite = null;

    @property(Node)
    chooseNode : Node = null;

    public setData(data: { id: number; name_cn?: string; name_en?: string; favorability?: number | string }) {
        this.ensureRefs();
        const itemId = Number(data?.id);
        const favorability = Number(data?.favorability ?? 0);
        const displayName = String(data?.name_cn || data?.name_en || itemId || '');

        if (this.itemName) {
            this.itemName.string = displayName + " " + `+${Number.isFinite(favorability) ? favorability : 0}`;
        }
        
        this.loadItemIcon(itemId);
    }

    public setItemNum(quantity: number) {
        this.ensureRefs();
        const count = Math.max(0, Number.isFinite(Number(quantity)) ? Number(quantity) : 0);
        if (this.itemNum) {
            this.itemNum.string = `x${count}`;
        }
    }

    public setSelected(choose: boolean) {
        if (this.chooseNode) {
            this.chooseNode.active = choose;
        }
    }

    private ensureRefs() {
        const root = this.node.getChildByName('Sprite') ?? this.node;
        // if (this.itemName) {
        //     this.itemName.string = displayName + " " + `+${Number.isFinite(favorability) ? favorability : 0}`;
        // }
        
        if (!this.itemIcon) {
            this.itemIcon = root.getChildByName('icon')?.getComponent(Sprite) ?? null;
        }
    }

    private loadItemIcon(itemId: number) {
        if (!this.itemIcon || !Number.isFinite(itemId) || itemId <= 0) return;
        resources.load(`UITexture/itemIcon/${itemId}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (!err && sf && this.itemIcon?.isValid) {
                this.itemIcon.spriteFrame = sf;
                return;
            }
            resources.load(`common/image/item_${itemId}/spriteFrame`, SpriteFrame, (err2, sf2) => {
                if (!err2 && sf2 && this.itemIcon?.isValid) {
                    this.itemIcon.spriteFrame = sf2;
                }
            });
        });
    }
}

