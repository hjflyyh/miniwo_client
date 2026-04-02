import { _decorator, Component, Label, Node, PageView, Sprite } from 'cc';
import { AppConst } from '../../../AppConst';
import { SocialModel } from '../../../Model/SocialModel';
const { ccclass, property } = _decorator;

@ccclass('MainFollowListCell')
export class MainFollowListCell extends Component {
    @property(Label)
    public content: Label = null
    @property(Label)
    public title: Label = null
    @property(Label)
    public likeNum: Label = null
    @property(Label)
    public commentNum: Label = null
    @property(Node)
    public onLike: Node = null
    @property(Node)
    public offLike: Node = null
    @property(Sprite)
    public imgSp: Sprite;

    private postAt
    private postID
    private isLike: boolean = false
    private likeCount: number = 0

    start() {
        EventSystem.addListent("postLikeConfirmBack", this.postLikeConfirmBack, this)
    }

    public onRrefresh(data) {
        this.content.string = data?.Content
        this.title.string = data?.Title
        this.likeCount = data?.LikeCount || 0
        this.commentNum.string = data?.CommentCount
        this.postAt = data?.CreatedAt
        this.postID = data?.ID
        this.isLike = SocialModel.getInstance().postLikeList.indexOf(this.postID) !== -1
        let imageUrl = JSON.parse(data?.ImageURL || "")
        if (imageUrl.length > 0) {
            let journalImg = AppConst.JournalManager.journalImgs.find((i) => i.type == "localImg" && i.id == imageUrl[0]["id"])
            this.imgSp.spriteFrame = AppConst.JournalManager.imgSprite[journalImg["localImgIndex"]]
        }

        this.setBtnByIsLike()
    }

    OnClickCell() {
        AppConst.PanelManager.openView("res/View/Follow/FollowView", {
            postID: this.postID,
            postAt: this.postAt,
        })
    }

    OnClickLike() {
        AppConst.SocialHttpManager.sendPostHttp(this.isLike ? "unlikeTimeline" : "likeTimeline", {
            postID: this.postID,
            postAt: this.postAt,
        })
    }

    postLikeConfirmBack(postID) {
        if (postID != this.postID) {
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


