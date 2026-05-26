import { _decorator, Component, Label, Node, resources, Sprite, SpriteFrame } from 'cc';
import { PrefabLoad } from '../../Utils/PrefabLoad';
const { ccclass, property } = _decorator;

@ccclass('GameSendRewardCell')
export class GameSendRewardCell extends Component {
    @property(Label)
    itemNum: Label = null;

    @property(Sprite)
    itemIcon: Sprite = null;

    @property(PrefabLoad)
    rewardTarget: PrefabLoad = null;

    start() {

    }

    public setData(data: { id: number; name_cn?: string; name_en?: string; favorability?: number | string }) {
        const itemId = Number(data?.id);
        const favorability = Number(data?.favorability ?? 0);
        const displayName = String(data?.name_cn || data?.name_en || itemId || '');

        this.loadItemIcon(itemId);
    }

    public setItemNum(quantity: number) {
        const count = Math.max(0, Number.isFinite(Number(quantity)) ? Number(quantity) : 0);
        if (this.itemNum) {
            this.itemNum.string = `x${count}`;
        }
    }
    
    private loadItemIcon(itemId: number) {
        if (!this.itemIcon || !Number.isFinite(itemId) || itemId <= 0) return;
        this.rewardTarget.url = `UITexture/itemIcon/${itemId}/spriteFrame`;
        // resources.load(`UITexture/itemIcon/${itemId}/spriteFrame`, SpriteFrame, (err, sf) => {
        //     if (!err && sf && this.itemIcon?.isValid) {
        //         this.itemIcon.spriteFrame = sf;
        //         return;
        //     }
        //     resources.load(`common/image/item_${itemId}/spriteFrame`, SpriteFrame, (err2, sf2) => {
        //         if (!err2 && sf2 && this.itemIcon?.isValid) {
        //             this.itemIcon.spriteFrame = sf2;
        //         }
        //     });
        // });
    }
}

