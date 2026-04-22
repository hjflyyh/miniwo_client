import { network } from "./RequestData";
import { AppConst } from "../AppConst";
export class SocialModel {
    private static _instance: SocialModel = null;

    public followList: any[] = []
    public collectList: any[] = []

    public postList: any[] = []
    public otherPostList: any[] = []
    public randomPostList: any[] = []

    public postLikeList: any[] = [] // 点赞列表 帖子ID

    public commentPostID: number = 0  // 指定帖子id
    public commentIDs: number[] = [] // 帖子id下的所有点赞过的评论id

    public draftData: any

    public itemsCache: {} = {}

    public userListCache: {} = {}

    public static getInstance(): SocialModel {
        if (!this._instance) {
            this._instance = new SocialModel();
        }
        return this._instance;
    }

    public init() {
        EventSystem.addListent("SocialHttpMessage", this.OnSocialHttpMessage, this)
        EventSystem.addListent("WebSocketMessage", this.OnWebSocketMessage, this)
    }

    private OnWebSocketMessage(data) {
        if (data["id"] == "get_user_by_ids" && data["payload"]) {
            let payload = JSON.parse(data["payload"]);
            if (!payload || !payload.success || !payload.data) {
                return;
            }

            payload.data.forEach(user => {
                if (!user.player_id) {
                    return
                }
                user.info = user.info ? JSON.parse(user.info) : {}
                this.userListCache[user.player_id] = user
            })
            console.log("userListCache:", this.userListCache)
            EventSystem.send("userListCache")
        }
    }

    private OnSocialHttpMessage(data) {
        const cmd = data?.cmd || data?.data?.cmd
        data = data?.data || data
        if (cmd == network.FollowSocialCode.FollowData) {
            const followList = data.list || []
            this.followList = followList.map((i) => i.FollowedUserID)
            console.log("followList:", this.followList)
        }
        else if (cmd == network.FollowSocialCode.PostData) {
            this.receiveList(data.list || [])
            this.postList = data.list || []
            const postIDs = data.postIDs || []
            if (postIDs.length > 0) {
                this.postLikeList = [...new Set([...this.postLikeList, ...postIDs])]
            }
            console.log("postList:", this.postList)
        }
        else if (cmd == network.FollowSocialCode.OtherPostData) {
            this.receiveList(data.list || [])
            this.otherPostList = data.list || []
            const postIDs = data.postIDs || []
            if (postIDs.length > 0) {
                this.postLikeList = [...new Set([...this.postLikeList, ...postIDs])]
            }
            EventSystem.send("otherPostList")
            console.log("OtherPostData data:", data)
        }
        else if (cmd == network.FollowSocialCode.CommentData && data?.list) {
            this.receiveList(data.list || [])
            this.commentIDs = data?.commentIDs || []
            this.commentPostID = data?.postID
            EventSystem.send("commentListData", { list: data.list, postID: data.postID, postAt: data.postAt, egg: data?.egg })
        }
        else if (cmd == network.FollowSocialCode.TopCommentData && data?.list) {
            this.receiveList(data.list || [])
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
            this.receiveList(data.list || [])
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

    private receiveList(list: any[]) {
        const userIDs = [...new Set(list.filter(item => !this.userListCache[item.UserID]).map(item => Number(item.UserID)))];
        if (userIDs.length > 0) {
            let json = new network.GetUserByIDRequest();
            AppConst.WebSocketManager.send(json.toJSON(userIDs))
        }
    }
}

