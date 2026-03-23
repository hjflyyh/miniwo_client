import { _decorator, Component, instantiate, Label, Node, RichText } from 'cc';
import { AppConst } from '../../../AppConst';
import { Utils } from '../../../Utils/Utils';
import { SocialModel } from '../../../Model/SocialModel';
const { ccclass, property } = _decorator;

@ccclass('FollowCommentCell')
export class FollowCommentCell extends Component {

    public postID: number
    public postAt: string
    public commentID: number
    public topID: number
    public commentData: any

    @property(Node)
    private onLike: Node = null

    @property(Node)
    private offLike: Node = null

    @property(Label)
    likeNum: Label = null

    @property(Label)
    commentAt: Label = null

    @property(RichText)
    commentContent: RichText = null

    private isLike: boolean = false
    private likeCount: number = 0

    start() {
        EventSystem.addListent("commentLikeConfirmBack", this.commentLikeConfirmBack, this)
    }

    refreshCommentCell() {
        if (!this.commentData) {
            console.error("commentData is null")
            return
        }
        this.commentContent.string = this.commentData.Content
        this.commentAt.string = Utils.getDateFromStr(this.commentData.CreatedAt)
        this.likeCount = this.commentData?.LikeCount || 0
        if (SocialModel.getInstance().commentPostID == this.postID) {
            this.isLike = SocialModel.getInstance().commentIDs.indexOf(this.commentID) !== -1
            this.setBtnByIsLike()
        }
    }

    OnClickComment() {
        AppConst.PanelManager.openView("res/View/Follow/FollowEditComment", {
            postID: this.postID,
            postAt: this.postAt,
            topID: this.topID,
            commentID: this.commentID,
        })
    }

    OnClickLike() {
        AppConst.SocialHttpManager.sendPostHttp(this.isLike ? "unlikeTimeline" : "likeTimeline", {
            postID: this.postID,
            postAt: this.postAt,
            commentID: this.commentID,
        })
    }

    commentLikeConfirmBack({ postID, commentID }) {
        if (postID != this.postID || commentID != this.commentID) {
            return
        }
        this.isLike = !this.isLike
        this.likeCount = this.isLike ? this.likeCount + 1 : this.likeCount - 1
        this.setBtnByIsLike()
    }

    setBtnByIsLike() {
        this.onLike.active = this.isLike
        this.offLike.active = !this.isLike
        this.likeNum.string = Math.max(0, this.likeCount).toString()
    }
}

