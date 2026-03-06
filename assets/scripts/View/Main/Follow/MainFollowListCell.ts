import { _decorator, Component, Node } from 'cc';
import { AppConst } from '../../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('MainFollowListCell')
export class MainFollowListCell extends Component {
    start() {

    }

    OnClickCell(){
        AppConst.PanelManager.openView("res/View/Follow/FollowView")
    }
}


