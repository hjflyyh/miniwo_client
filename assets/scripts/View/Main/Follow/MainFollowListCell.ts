import { _decorator, Component, Label, Node, PageView, Sprite, UITransform } from 'cc';
import { AppConst } from '../../../AppConst';
import { SocialModel } from '../../../Model/SocialModel';
import { RoleModel } from '../../../Model/RoleModel';
import InfiniteCell from '../../../../plugin/InfiniteList/InfiniteCell';
const { ccclass, property } = _decorator;

@ccclass('MainFollowListCell')
export class MainFollowListCell extends InfiniteCell {
    UpdateContent(data: any): void {
        this.onRrefresh(data)
    }
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
    @property(Label)
    public nikeName: Label = null

    private postAt
    private postID
    private userID
    private isLike: boolean = false
    private likeCount: number = 0

    @property(Node)
    otherNode : Node

    @property(UITransform)
    bgTransform : UITransform

    @property(Node)
    imgNode : Node

    start() {
        EventSystem.addListent("postLikeConfirmBack", this.postLikeConfirmBack, this)
        EventSystem.addListent("followBack", this.setFollow, this)
        EventSystem.addListent("userListCache", this.setNikeName, this)
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
        this.isFollow.node.active = false
        this.setFollow()
        this.setNikeName()
        this.imgSp.spriteFrame = null
        let imageUrl = data?.ImageURL && JSON.parse(data?.ImageURL || "[]")
        if (imageUrl && imageUrl.length > 0) {
            let journalImg = AppConst.JournalManager.journalImgs.find((i) => i.type == "localImg" && i.id == imageUrl[0]["id"])
            if (journalImg) {
                this.imgSp.spriteFrame = AppConst.JournalManager.imgSprite[journalImg["localImgIndex"]]
            }

            this.imgNode.active = true
            this.otherNode.y = -531.741

            this.bgTransform.height = 1052
        }else{
            this.imgNode.active = false
            this.bgTransform.height = 390
            this.otherNode.y = 160.675
        }

        this.setBtnByIsLike()
    }

    OnClickCell() {
        let post = SocialModel.getInstance().postData[this.postID]
        if (!post) {
            console.log("post not found:", this.postID)
            return
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

     postLikeConfirmBack({ postID, isLike, changeCount }) {
        if (postID != this.postID) {
            return
        }
        this.isLike = isLike    
        this.likeCount = this.likeCount + changeCount
        this.setBtnByIsLike()
    }

    setFollow() {
        if (this.userID != RoleModel.getInstance().playerId) {
            this.isFollow.node.active = true
            this.isFollow.string = SocialModel.getInstance().followList.indexOf(this.userID) !== -1 ? "unfollow" : "follow"
        }
    }

    setNikeName() {
        this.nikeName.string = SocialModel.getInstance().userListCache[this.userID]?.nick_name
    }

    setBtnByIsLike() {
        this.onLike.active = this.isLike
        this.offLike.active = !this.isLike
        this.likeNum.string = Math.max(0, this.likeCount).toString()
    }
}


