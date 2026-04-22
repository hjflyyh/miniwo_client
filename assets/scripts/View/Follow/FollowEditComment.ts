import { _decorator, Component, EditBox, Node } from 'cc';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('FollowEditComment')
export class FollowEditComment extends Component {
    @property(EditBox)
    commentNode: EditBox = null

    onClickComment() {
        if (this.commentNode.string) {
            let param = this.node["_openParam"]
            AppConst.SocialHttpManager.sendPostHttp("commentTimeline", {
                postID: param?.postID,
                postAt: param?.postAt,
                topID: param?.topID,
                parentID: param?.commentID,
                content: this.commentNode.string,
            })
        }
        AppConst.PanelManager.CloseView(this)
    }
}