import { _decorator, Component, Node, EditBox, Label, instantiate, Prefab } from 'cc';
import { AppConst } from '../../AppConst';
import { SocialModel } from '../../Model/SocialModel';
import { FollowComment } from '../Main/Follow/FollowComment';
import { Utils } from '../../Utils/Utils';
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

    @property(Node)
    public onLike: Node = null

    @property(Node)
    public offLike: Node = null

    @property(EditBox)
    commentNode: EditBox = null

    private isLike: boolean = false
    private likeCount: number = 0
    // 一级评论列表
    private commentRootList: any[] = []
    // 一级评论列表下级评论对象
    private commentListArr: {} = {}
    // 评论数据
    private commentList: {} = {}

    private postID: number
    private postAt: string

    private followCommentList: {} = {}

    start() {
        EventSystem.addListent("postLikeConfirmBack", this.postLikeConfirmBack, this)
        EventSystem.addListent("commentListData", this.commentListData, this)
        EventSystem.addListent("topCommentListData", this.topCommentListData, this)
        let param = this.node["_openParam"]
        this.postID = param?.postID
        this.postAt = param?.postAt
        if (!this.postID || !this.postAt) {
            console.log("postID or postAt is empty")
            return
        }
        AppConst.SocialHttpManager.sendGetHttp("firstCommentList", {
            postID: this.postID,
            postAt: this.postAt,
        })
        let otherPostList = SocialModel.getInstance().otherPostList
        let post = otherPostList.find(item => item.ID == this.postID)
        this.contentNode.string = post?.Content || ""
        this.titleNode.string = post?.Title || ""
        this.postAtLable.string = Utils.getDateFromStr(post?.CreatedAt || "")
        this.commentRender.active = false

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

    commentListData({ list, postID, postAt }) {
        if (postID != this.postID || postAt != this.postAt) {
            console.log("commentListData: postID or postAt is not match")
            return
        }
        this.addList(list)
        this.refreshCommentList()
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
        this.postLikeLable.string = Math.max(0, this.likeCount).toString()
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


