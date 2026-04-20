import { network } from "./RequestData";
import { AppConst } from "../AppConst";
export class SocialModel {
    private static _instance: SocialModel = null;

    public followList: any[] = []
    
    public postList: any[] = []
    public otherPostList: any[] = []
    public randomPostList: any[] = []

    public postLikeList: any[] = [] // 点赞列表 帖子ID

    public commentPostID: number = 0  // 指定帖子id
    public commentIDs: number[] = [] // 帖子id下的所有点赞过的评论id

    public draftData: any

    public itemsCache: {} = {}

    public userListCache: {} = {} // todo

    public static getInstance(): SocialModel {
        if (!this._instance) {
            this._instance = new SocialModel();
        }
        return this._instance;
    }

    public init() {
        EventSystem.addListent("SocialHttpMessage", this.OnSocialHttpMessage, this)
    }

    private OnSocialHttpMessage(data) {
        const cmd = data?.cmd || data?.data?.cmd
        data = data?.data || data
        if (cmd == network.FollowSocialCode.FollowData) {
            const followList = data.list || []
            this.followList = followList.map((i) => i.FollowedUserID)
            console.log("fol lowList:", this.followList)
        }
        else if (cmd == network.FollowSocialCode.PostData) {
            this.postList = data.list || []
            const postIDs = data.postIDs || []
            if (postIDs.length > 0) {
                this.postLikeList = [...new Set([...this.postLikeList, ...postIDs])]
            }
            console.log("postList:", this.postList)
        }
        else if (cmd == network.FollowSocialCode.OtherPostData) {
            this.otherPostList = data.list || []
            const postIDs = data.postIDs || []
            if (postIDs.length > 0) {
                this.postLikeList = [...new Set([...this.postLikeList, ...postIDs])]
            }
            console.log("OtherPostData data:", data)
        }
        else if (cmd == network.FollowSocialCode.CommentData && data?.list) {
            this.commentIDs = data?.commentIDs || []
            this.commentPostID = data?.postID
            EventSystem.send("commentListData", { list: data.list, postID: data.postID, postAt: data.postAt, egg: data?.egg })
        }
        else if (cmd == network.FollowSocialCode.TopCommentData && data?.list) {
            EventSystem.send("topCommentListData", { list: data.list, postID: data.postID, postAt: data.postAt, topID: data.topID })
        }
        else if (cmd == network.FollowSocialCode.PostCreate) {
            this.draftData = {
                content: data?.draft?.Content || "",
                title: data?.draft?.Title || "",
                imageUrl: data?.draft?.ImageURL || "",
            }
            EventSystem.send("followEditBack")
        }
        else if (cmd == network.FollowSocialCode.LikeConfirm && !data?.commentID) {
            this.postLikeList.push(data.postID)
            this.otherPostList = this.otherPostList.reduce((acc, item) =>
            (acc.push(item.ID === data.postID
                ? { ...item, LikeCount: item.LikeCount + 1 } : item), acc),
                []);
            EventSystem.send("postLikeConfirmBack", data.postID)
        }
        else if (cmd == network.FollowSocialCode.UnLikeConfirm && !data?.commentID) {
            this.postLikeList = this.postLikeList.filter((item: any) => item != data.postID)
            this.otherPostList = this.otherPostList.reduce((acc, item) =>
            (acc.push(item.ID === data.postID
                ? { ...item, LikeCount: item.LikeCount - 1 } : item), acc),
                []);
            EventSystem.send("postLikeConfirmBack", data.postID)
        }
        else if (cmd == network.FollowSocialCode.LikeConfirm && data?.commentID) {
            this.commentIDs.push(data.commentID)
            EventSystem.send("commentLikeConfirmBack", { postID: data.postID, commentID: data.commentID })
        }
        else if (cmd == network.FollowSocialCode.UnLikeConfirm && data?.commentID) {
            this.commentIDs = this.commentIDs.filter((item: any) => item != data.commentID)
            EventSystem.send("commentLikeConfirmBack", { postID: data.postID, commentID: data.commentID })
        }
        else if (cmd == network.FollowSocialCode.Draft) {
            this.draftData = {
                content: data?.draft?.Content || "",
                title: data?.draft?.Title || "",
                imageUrl: data?.draft?.ImageURL || "",
            }
        }
        else if (cmd == network.FollowSocialCode.RandomPostData && data?.list) {
            const postIDs = data.postIDs || []
            if (postIDs.length > 0) {
                this.postLikeList = [...new Set([...this.postLikeList, ...postIDs])]
            }
            this.randomPostList = data.list || []
            console.log("randomPostList:", this.randomPostList)
        }
        else if (cmd == network.FollowSocialCode.FollowSuccess) {
            this.followList.push(data.followedUserId)
            EventSystem.send("followBack", data.followedUserId)
        }
        else if (cmd == network.FollowSocialCode.UnFollowSuccess) {
            this.followList = this.followList.filter((item: any) => item != data.followedUserId)
            EventSystem.send("followBack", data.followedUserId)
        }
    }
}

