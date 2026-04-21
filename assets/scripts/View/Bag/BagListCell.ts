import { _decorator, Component, instantiate, Label, math, Node, Size } from 'cc';
import { YXCollectionView } from '../../../plugin/list-3x/yx-collection-view';
import { CardModel } from '../../Model/CardModel';
import { CustomGridFlowLayout } from '../../../plugin/list-3x/custom-grid-flow-layout';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
const { ccclass, property } = _decorator;

@ccclass('BagListCell')
export class BagListCell extends Component { 
    @property(Label)
    bagInfo: Label = null

    @property(Label)
    bagNum: Label

    start() {

    }

    setBagId(bag_data) {
        console.log("'BagListCell'BagId'" , bag_data)
        this.bagInfo.string = bag_data.item_id
        this.bagNum.string = bag_data.count > 0 ? "X" + bag_data.count : ""
    }


}