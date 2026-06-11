import { _decorator, Color, Component, instantiate, Label, math, Node, ProgressBar, resources, Size, Sprite, SpriteFrame } from 'cc';
import { YXCollectionView } from '../../../plugin/list-3x/yx-collection-view';
import { CardModel } from '../../Model/CardModel';
import { CustomGridFlowLayout } from '../../../plugin/list-3x/custom-grid-flow-layout';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
import { network } from '../../Model/RequestData';
import { AppConst } from '../../AppConst';
import { PrefabLoad } from '../../Utils/PrefabLoad';
import { BagModel } from '../../Model/BagModel';
import { getBasicSeedMatureSpriteResourcePath } from '../../Model/Farm/FarmSeedVisual';
import { RoleModel } from '../../Model/RoleModel';
import { UGCModel } from '../../Model/UGCModel';
const { ccclass, property } = _decorator;

@ccclass('VisitListTextCell')
export class VisitListTextCell extends Component {

    @property(Label)
    textLabel: Label = null
    
    start() {
    }
    
    setText(text: string) {
        this.textLabel.string = text
    }
}
