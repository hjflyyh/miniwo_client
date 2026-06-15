import { _decorator, Component, Label } from 'cc';
import { BagModel } from '../../Model/BagModel';
const { ccclass, property } = _decorator;

@ccclass('ShowItemNode')
export class ShowItemNode extends Component {
    @property(Label)
    showLabel: Label = null;

    @property
    itemId: number = 0;

    start() {
        EventSystem.addListent("BagUpdate", this.refreshNode, this);
        this.refreshNode();
    }

    refreshNode() {
        if (!this.showLabel) {
            return;
        }
        if (this.itemId <= 0) {
            this.showLabel.string = "0";
            return;
        }
        const count = BagModel.getInstance().getItemCount(this.itemId);
        this.showLabel.string = `${count}`;
    }
}
