import { _decorator, Component, instantiate, Label, Node, RichText } from 'cc';
import { AppConst } from '../../../AppConst';
import { Utils } from '../../../Utils/Utils';
import { FollowCommentCell } from './FollowCommentCell';
const { ccclass, property } = _decorator;

@ccclass('FollowComment')
export class FollowComment extends Component {
    @property(Node)
    showMoreBtn: Node = null

    @property(Node)
    commentRender: Node

    @property(Node)
    headRender: Node

    public postID: number
    public postAt: string
    public topID: number

    private commentList = {}
    private isShowMore: boolean = false

    start() {
        this.commentRender.active = false
        this.commentList = {}
    }

    onClickShowMore() {
        AppConst.SocialHttpManager.sendGetHttp("commentList", {
            postID: this.postID,
            postAt: this.postAt,
            topId: this.topID,
        })
        this.isShowMore = true
        this.showMoreBtn.active = false
    }

    onRefresh(data: any) {
        if (!this.isShowMore) {
            this.showMoreBtn.active = data.find((item: any) => item.ID == this.topID)?.CommentCount || 0 > 1
        }

        for (let comment of data) {
            let next = this.commentList[comment.ID]
            if (!next) {
                next = instantiate(this.commentRender)
                next.active = true
                this.headRender.addChild(next)
                this.commentList[comment.ID] = next
            }  

            const followcommentCell = next.getComponent("FollowCommentCell") as FollowCommentCell;
            followcommentCell.postID = this.postID
            followcommentCell.postAt = this.postAt
            followcommentCell.topID = this.topID
            followcommentCell.commentID = comment.ID
            followcommentCell.commentData = comment
            followcommentCell.refreshCommentCell()
        }
    }
}

