import { _decorator, Component, Label, Node } from 'cc';
import { BagModel } from '../Model/BagModel';
const { ccclass, property } = _decorator;

@ccclass('ShowItem')
export class ShowItem extends Component {
    @property
    itemId: number = 0

    @property(Label)
    showNum: Label = null

    start() {
        EventSystem.addListent("BagUpdate", this.refreshShowItem, this)
        this.refreshShowItem();
    }
    
    refreshShowItem() {
        if (!this.showNum) {
            return
        }
        if (this.itemId <= 0) {
            this.showNum.string = "0"
            return
        }
        const count = BagModel.getInstance().getItemCount(this.itemId)
        this.showNum.string = `${count}`
    }
}

