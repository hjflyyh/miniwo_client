import { _decorator, Component, Label, Node, Sprite } from 'cc';
import InfiniteCell from '../../../plugin/InfiniteList/InfiniteCell';
import { SocialModel } from '../../Model/SocialModel';
import { AppConst } from '../../AppConst';
import { Utils } from '../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('UserCenterShareCell')
export class UserCenterShareCell extends InfiniteCell {

    @property(Node)
    cell2Node: Node = null

    @property(Label)
    titleNode: Label = null

    @property(Label)
    contentNode: Label = null

    @property(Label)
    postLikeLable: Label = null

    @property(Node)
    public onLike: Node = null

    @property(Node)
    public offLike: Node = null

    @property(Sprite)
    public imgSp: Sprite;

    @property(Label)
    titleNode2: Label = null

    @property(Label)
    contentNode2: Label = null

    @property(Label)
    postLikeLable2: Label = null

    @property(Node)
    public onLike2: Node = null

    @property(Node)
    public offLike2: Node = null

    @property(Sprite)
    public imgSp2: Sprite;

    private index: number = 0

    UpdateContent(index: number): void {
        this.index = index
        if (SocialModel.getInstance().getPostDataByPostList(index * 2)) {
            const post = SocialModel.getInstance().getPostDataByPostList(index * 2)
            this.titleNode.string = post?.Title || ""
            this.contentNode.string = post?.Content || ""
            this.postLikeLable.string = Math.max(0, post?.LikeCount || 0).toString()
            const isLike = SocialModel.getInstance().postLikeList.indexOf(post?.ID) !== -1
            this.onLike.active = isLike
            this.offLike.active = !isLike

            this.imgSp.spriteFrame = null
            let imageUrl = post?.ImageURL && JSON.parse(post?.ImageURL || "[]")
            if (imageUrl && imageUrl.length > 0) {
                let journalImg = AppConst.JournalManager.journalImgs.find((i) => i.type == "modelImg" && i.id == imageUrl[0]["id"])
                if (journalImg) {
                    // this.imgSp.spriteFrame = AppConst.JournalManager.imgSprite[journalImg["localImgIndex"]]
                    Utils.loadCover(imageUrl[0]["model_url"] , this.imgSp)
                }
                            // if(imageUrl[0]["type"] == "modelImg"){
                            //     Utils.loadCover(imageUrl[0]["model_url"] , this.imgSp)
                            // }
            }
        }
        if (SocialModel.getInstance().getPostDataByPostList(index * 2 + 1)) {
            this.cell2Node.active = true
            const post2 = SocialModel.getInstance().getPostDataByPostList(index * 2 + 1)
            this.titleNode2.string = post2?.Title || ""
            this.contentNode2.string = post2?.Content || ""
            this.postLikeLable2.string = Math.max(0, post2?.LikeCount || 0).toString()
            const isLike2 = SocialModel.getInstance().postLikeList.indexOf(post2?.ID) !== -1
            this.onLike2.active = isLike2
            this.offLike2.active = !isLike2
            this.imgSp2.spriteFrame = null
            let imageUrl2 = post2?.ImageURL && JSON.parse(post2?.ImageURL || "[]")
            if (imageUrl2 && imageUrl2.length > 0) {
                let journalImg2 = AppConst.JournalManager.journalImgs.find((i) => i.type == "localImg" && i.id == imageUrl2[0]["id"])
                if (journalImg2) {
                    this.imgSp2.spriteFrame = AppConst.JournalManager.imgSprite[journalImg2["localImgIndex"]]
                }
            }
        } else {
            this.cell2Node.active = false
        }

    }
    start() {

    }

    OnClickCell() {
        const post = SocialModel.getInstance().getPostDataByPostList(this.index * 2)
        if (post) {
            AppConst.PanelManager.openView("res/View/Follow/FollowView", {
                postID: post.ID,
                postAt: post.CreatedAt,
                data: post,
            })
        }
    }

    OnClickCell2() {
        const post = SocialModel.getInstance().getPostDataByPostList(this.index * 2 + 1)
        if (post) {
            AppConst.PanelManager.openView("res/View/Follow/FollowView", {
                postID: post.ID,
                postAt: post.CreatedAt,
                data: post,
            })
        }
    }
}


