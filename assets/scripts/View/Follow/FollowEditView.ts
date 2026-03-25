import { _decorator, Component, EditBox, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { SocialModel } from '../../Model/SocialModel';
const { ccclass, property } = _decorator;

@ccclass('FollowEditView')
export class FollowEditView extends Component {
    @property(EditBox)
    titleNode: EditBox = null

    @property(EditBox)
    contentNode: EditBox = null

    start() {
        EventSystem.addListent("followEditBack", this.back, this)
        const draftData = SocialModel.getInstance().draftData
        if (draftData) {
            this.titleNode.string = draftData.title || ""
            this.contentNode.string = draftData.content || ""
        }
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
       AppConst.SocialHttpManager.sendPostHttp("updateDraft", {
            content: this.contentNode.string,
            title: this.titleNode.string,
            // imageUrl:  todo 图片url
        })
    }

    onClickPost() {
        AppConst.SocialHttpManager.sendPostHttp("postTimeline", {
            content: this.contentNode.string,
            title: this.titleNode.string
        })
    }

    onClickDelete() {
        this.contentNode.string = ""
        this.titleNode.string = ""
        // todo imageUrl
        AppConst.SocialHttpManager.sendPostHttp("updateDraft", {
            content:  "",
            title:  "",
            imageUrl:  "",
        })
    }

    back() {
        AppConst.PanelManager.CloseView(this)
    }
}


