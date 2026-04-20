import { _decorator, Component, Label, Node, PageView, Sprite } from 'cc';
import { AppConst } from '../../../AppConst';
import { SocialModel } from '../../../Model/SocialModel';
import { RoleModel } from '../../../Model/RoleModel';
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
    @property(Label)
    public isFollow: Label = null

    private postAt
    private postID
    private userID
    private isLike: boolean = false
    private likeCount: number = 0

    start() {
        EventSystem.addListent("postLikeConfirmBack", this.postLikeConfirmBack, this)
        EventSystem.addListent("followBack", this.setFollow, this)
    }

    public onRrefresh(data) {
        this.userID = data?.UserID
        this.content.string = data?.Content
        this.title.string = data?.Title
        this.likeCount = data?.LikeCount || 0
        this.commentNum.string = data?.CommentCount
        this.postAt = data?.CreatedAt
        this.postID = data?.ID
        this.isLike = SocialModel.getInstance().postLikeList.indexOf(this.postID) !== -1
        this.isFollow.string = "myself"
        this.setFollow()

        this.imgSp.spriteFrame = null
        let imageUrl = data?.ImageURL && JSON.parse(data?.ImageURL || "[]")
        if (imageUrl && imageUrl.length > 0) {
            let journalImg = AppConst.JournalManager.journalImgs.find((i) => i.type == "localImg" && i.id == imageUrl[0]["id"])
            if (journalImg) {
                this.imgSp.spriteFrame = AppConst.JournalManager.imgSprite[journalImg["localImgIndex"]]
            }
        }

        this.setBtnByIsLike()
    }

    OnClickCell() {
        let post = SocialModel.getInstance().otherPostList.find(item => item.ID == this.postID)
        if (!post) {
            const randomPostList = SocialModel.getInstance().randomPostList
            post = randomPostList.find(item => item.ID == this.postID)
        }
        AppConst.PanelManager.openView("res/View/Follow/FollowView", {
            postID: this.postID,
            postAt: this.postAt,
            data: post,
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

    setFollow() {
        if (this.userID != RoleModel.getInstance().playerId) {
            this.isFollow.string = SocialModel.getInstance().followList.indexOf(this.userID) !== -1 ? "unfollow" : "follow"
        }
    }

    setBtnByIsLike() {
        this.onLike.active = this.isLike
        this.offLike.active = !this.isLike
        this.likeNum.string = Math.max(0, this.likeCount).toString()
    }
}


