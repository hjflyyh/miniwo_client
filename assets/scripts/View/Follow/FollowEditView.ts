import { _decorator, Component, EditBox, Node } from 'cc';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('FollowEditView')
export class FollowEditView extends Component {
    @property(EditBox)
    titleNode: EditBox = null

    @property(EditBox)
    contentNode: EditBox = null

    start() {
        EventSystem.addListent("followEditBack", this.back, this)
    }

    onClickFriend() {
        AppConst.PanelManager.openView("res/View/Follow/FollowFriendChoose")
    }

    onClickImg() {
        AppConst.PanelManager.openView("res/View/Follow/FollowImgChoose")
    }

    onClickReward() {

    }

    onClickSave() {

    }

    onClickPost() {
        AppConst.SocialHttpManager.sendPostHttp("postTimeline", {
            content: this.contentNode.string,
            title: this.titleNode.string
        })
    }

    onClickDelete() {

    }

    back() {
        AppConst.PanelManager.CloseView(this)
    }
}


