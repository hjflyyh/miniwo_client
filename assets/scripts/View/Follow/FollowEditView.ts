import { _decorator, Component, Node } from 'cc';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('FollowEditView')
export class FollowEditView extends Component {
    start() {

    }

    onClickFriend(){
        AppConst.PanelManager.openView("res/View/Follow/FollowFriendChoose")
    }

    onClickImg(){
        AppConst.PanelManager.openView("res/View/Follow/FollowImgChoose")
    }

    onClickReward(){

    }
}


