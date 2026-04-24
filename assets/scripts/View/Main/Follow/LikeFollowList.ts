import { _decorator, Component, math, Node } from 'cc';
import { AppConst } from '../../../AppConst';

const { ccclass, property } = _decorator;

@ccclass('LikeFollowList')
export class LikeFollowList extends Component {
    start() {
        this.httpRequest()
        this.refreshData()
    }

    refreshData() {
    }

    httpRequest() {
        AppConst.SocialHttpManager.sendGetHttp("likedTimelineList", {})
    }

    OnClickClose(){
       AppConst.PanelManager.CloseView(this)
    }

}


