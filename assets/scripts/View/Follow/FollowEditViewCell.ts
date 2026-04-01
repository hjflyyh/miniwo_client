import { _decorator, Component, instantiate, Label, Node, RichText } from 'cc';
import { SocialModel } from '../../Model/SocialModel';
import { BagModel } from '../../Model/BagModel';

const { ccclass, property } = _decorator;

@ccclass('FollowEditViewCell')
export class FollowEditViewCell extends Component {

    public itemID: number

    @property(Label)
    itemNum: Label = null
    @property(Node)
    jia: Node
    @property(Node)
    jian: Node

    start() {

    }

    refreshEditViewCell() {
        this.jia.active = false
        this.jian.active = false
        this.itemNum.string = "0"
        this.itemNum.node.active = false
    }

    onClickJia() {
        let itemsCache = SocialModel.getInstance().itemsCache
        let maxEggCount = BagModel.getInstance().getMaxEggCount()
        const sum = Object.keys(itemsCache).reduce((t, k) => t + itemsCache[k], 0);
        if (sum >= maxEggCount) {
            return
        }

        let num = (+(this.itemNum.string) + 1)
        let allowedRewards = BagModel.getInstance().getSlotAllowedRewards()
        let item = allowedRewards.find((item) => item["item_id"] == this.itemID)
        if (item) {
            num = Math.min(num, item["count"])
        }

        itemsCache[this.itemID] = num
        this.itemNum.string = num.toString()
    }

    onClickJian() {
        let num = (Math.max(0, +(this.itemNum.string) - 1))
        SocialModel.getInstance().itemsCache[this.itemID] = num
        this.itemNum.string = num.toString()
    }

    onClickChoose() {
        this.itemNum.node.active = true
        this.jia.active = true
        this.jian.active = true
    }
}