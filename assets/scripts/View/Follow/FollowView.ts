import { _decorator, Component, Node, EditBox, Label, instantiate, Prefab, Sprite, PageView, Layout } from 'cc';
import { AppConst } from '../../AppConst';
import { SocialModel } from '../../Model/SocialModel';
import { FollowComment } from '../Main/Follow/FollowComment';
import { Utils } from '../../Utils/Utils';
import { RoleModel } from '../../Model/RoleModel';
const { ccclass, property } = _decorator;

@ccclass('FollowView')
export class FollowView extends Component {
    @property(Label)
    titleNode: Label = null

    @property(Label)
    contentNode: Label = null

    @property(Node)
    commentRender: Node

    @property(Node)
    headRender: Node

    @property(Label)
    postAtLable: Label = null

    @property(Label)
    postLikeLable: Label = null

    @property(Label)
    postCommentLable: Label = null

    @property(Node)
    onLike: Node = null

    @property(Node)
    offLike: Node = null

    @property(Node)
    onCollect: Node = null

    @property(Node)
    offCollect: Node = null

    @property(Label)
    collectNumLable: Label = null

    @property(Node)
    eggRewardBtn: Node = null

    @property(EditBox)
    commentNode: EditBox = null

    @property(PageView)
    pageView: PageView = null!;

    @property(Node)
    pagePrefab: Node = null!; // 提前做一个空节点，带 Sprite 组件

    @property(Label)
    public isFollow: Label = null

    @property(Label)
    public nikeName: Label = null

    private isLike: boolean = false
    private likeCount: number = 0
    private collectCount: number = 0
    // 一级评论列表
    private commentRootList: any[] = []
    // 一级评论列表下级评论对象
    private commentListArr: {} = {}
    // 评论数据
    private commentList: {} = {}

    private postID: number
    private postAt: string
    private eggID: number
    private userID: string

    private followCommentList: {} = {}

    start() {
        EventSystem.addListent("postLikeConfirmBack", this.postLikeConfirmBack, this)
        EventSystem.addListent("commentListData", this.commentListData, this)
        EventSystem.addListent("topCommentListData", this.topCommentListData, this)
        EventSystem.addListent("followBack", this.setFollow, this)
        EventSystem.addListent("userListCache", this.setNikeName, this)
        EventSystem.addListent("postCollectConfirmBack", this.postCollectConfirmBack, this)
        let param = this.node["_openParam"]

        this.postID = param?.postID
        this.postAt = param?.postAt
        const post = param?.data
        if (!this.postID || !this.postAt || !post) {
            console.log("postID or postAt or data is empty")
            return
        }
        this.userID = post?.UserID
        this.setNikeName()
        this.isFollow.node.active = false
        this.setFollow()
        this.eggID = post?.EggID || 0
        AppConst.SocialHttpManager.sendGetHttp("firstCommentList", {
            postID: this.postID,
            postAt: this.postAt,
            eggID: this.eggID,
        })

        let imageURL = post?.ImageURL && JSON.parse(post?.ImageURL || "[]")
        if (imageURL && imageURL.length > 0) {
            const content = this.pageView.content;
            content.removeAllChildren();
            for (let i = 0; i < imageURL.length; i++) {
                let img = imageURL[i]
                const page = instantiate(this.pagePrefab);
                content.addChild(page);
                this.pageView.addPage(page)
                const imgSp = page.getChildByName("banner").getComponent(Sprite);
                if (imgSp) {
                    let journalImg = AppConst.JournalManager.journalImgs.find((i) => i.type == "modelImg" && i.id == img["id"])
                    
                    // let journalImg = AppConst.JournalManager.journalImgs.find((i) => i.type == "localImg" && i.id == img["id"])
                    if (journalImg) {
                        // imgSp.spriteFrame = AppConst.JournalManager.imgSprite[journalImg["localImgIndex"]]
                        Utils.loadCoverFitInsideParent(journalImg.model_url, imgSp)
                    }
                }
            }
        } else {
            this.pageView.node.active = false
        }

        this.contentNode.string = post?.Content || ""
        this.titleNode.string = post?.Title || ""
        this.postAtLable.string = Utils.getDateFromStr(post?.CreatedAt || "")
        this.commentRender.active = false
        this.postCommentLable.string = post?.CommentCount

        this.collectCount = post?.FavoriteCount
        this.setBtnByIsFavorite(SocialModel.getInstance().isFavorite)

        this.likeCount = post?.LikeCount || 0
        this.isLike = SocialModel.getInstance().postLikeList.indexOf(this.postID) !== -1
        this.setBtnByIsLike()
    }


    refreshCommentList() {
        this.commentRootList.forEach(topID => {
            const commentCell = instantiate(this.commentRender);
            const followcomment = commentCell.getComponent("FollowComment") as FollowComment;
            if (!this.followCommentList[topID]) {
                this.followCommentList[topID] = followcomment
                commentCell.active = true;
                this.headRender.addChild(commentCell);
            }
            const commentListArr = this.commentListArr[topID] || [];
            const data = [this.commentList[topID], ...commentListArr.map(item => this.commentList[item])];
            followcomment.topID = topID;
            followcomment.postID = this.postID;
            followcomment.postAt = this.postAt;
            followcomment.onRefresh(data);
        });
    }

    commentListData({ list, postID, postAt, egg }) {
        if (postID != this.postID || postAt != this.postAt) {
            console.log("commentListData: postID or postAt is not match")
            return
        }
        this.eggRewardBtn.active = egg == true
        this.addList(list)
        this.refreshCommentList()
        this.postCommentLable.string = this.commentRootList.length + ""
    }

    topCommentListData({ list, postID, postAt, topID }) {
        if (postID != this.postID || postAt != this.postAt) {
            console.log("topCommentListData: postID or postAt is not match")
            return
        }
        const followComment = this.followCommentList[topID] as FollowComment
        if (!followComment) {
            console.log("topCommentListData: followcomment is not found")
            return
        }
        followComment.onRefresh(list)
        this.addList(list)
    }

    addList(list) {
        list.forEach(item => {
            this.commentList[item.ID] = item;
            item.TopID == 0
                ? this.uniquePush(this.commentRootList, item.ID)
                : this.uniquePush((this.commentListArr[item.TopID] = this.commentListArr[item.TopID] || []), item.ID);
        });
    }

    OnClickLike() {
        AppConst.SocialHttpManager.sendPostHttp(this.isLike ? "unlikeTimeline" : "likeTimeline", {
            postID: this.postID,
            postAt: this.postAt,
        })
    }

    OnClickCollect() {
        AppConst.SocialHttpManager.sendPostHttp(SocialModel.getInstance().isFavorite ? "unfavoriteTimeline" : "favoriteTimeline", {
            postID: this.postID,
            postAt: this.postAt,
        })
    }

    OnClickFollow() {
        if (this.userID == RoleModel.getInstance().playerId) {
            return
        }
        AppConst.SocialHttpManager.sendPostHttp(SocialModel.getInstance().followList.indexOf(this.userID) !== -1 ? "unfollow" : "follow", {
            followedUserId: this.userID,
        })
    }

    OnClickEggReward() {
        this.eggRewardBtn.active = false
        AppConst.SocialHttpManager.sendPostHttp("receiveGlobalEgg", {
            token: RoleModel.getInstance().nakama_token,
            eggID: this.eggID,
        })
    }

    onClickComment() {
        if (this.commentNode.string) {
            AppConst.SocialHttpManager.sendPostHttp("commentTimeline", {
                postID: this.postID,
                postAt: this.postAt,
                content: this.commentNode.string,
            })
            this.commentNode.string = ""
        }
    }

    postLikeConfirmBack({ postID, isLike, changeCount }) {
        if (postID != this.postID) {
            return
        }
        this.isLike = isLike
        this.likeCount = this.likeCount + changeCount
        this.setBtnByIsLike()
    }

    postCollectConfirmBack({ postID, isFavorite, changeCount }) {
        if (postID != this.postID) {
            return
        }
        this.collectCount = this.collectCount + changeCount
        this.setBtnByIsFavorite(isFavorite)
    }

    setNikeName() {
        this.nikeName.string = SocialModel.getInstance().userListCache[this.userID]?.nick_name
    }

    setFollow() {
        if (this.userID != RoleModel.getInstance().playerId) {
            this.isFollow.node.active = true
            this.isFollow.string = SocialModel.getInstance().followList.indexOf(this.userID) !== -1 ? "unfollow" : "follow"
        }
    }

    setBtnByIsLike() {
        this.onLike.active = this.isLike
        this.offLike.active = !this.isLike
        this.postLikeLable.string = Math.max(0, this.likeCount).toString()
    }

    setBtnByIsFavorite(isFavorite: boolean) {
        this.onCollect.active = isFavorite
        this.offCollect.active = !isFavorite
        this.collectNumLable.string = Math.max(0, this.collectCount).toString()
    }

    // 去重push
    private uniquePush(arr, item) {
        let index = arr.indexOf(item)
        if (index == -1) {
            arr.push(item)
        } else {
            arr[index] = item
        }
    }
}


