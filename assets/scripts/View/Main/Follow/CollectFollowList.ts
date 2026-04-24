import { _decorator, Component, math, Node } from 'cc';
import { AppConst } from '../../../AppConst';

const { ccclass, property } = _decorator;

@ccclass('CollectFollowList')
export class CollectFollowList extends Component {
    start() {
        this.httpRequest()
        this.refreshData()
    }

    refreshData() {
    }

    httpRequest() {
        AppConst.SocialHttpManager.sendGetHttp("favoriteTimelineList", {})
    }

    OnClickClose(){
       AppConst.PanelManager.CloseView(this)
    }

}


