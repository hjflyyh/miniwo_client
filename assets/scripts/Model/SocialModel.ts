import { network } from "./RequestData";
import { AppConst } from "../AppConst";
export class SocialModel {
    private static _instance: SocialModel = null;

    public followList: any[] = []
    public isFavorite: boolean = false

    public postList: number[] = []
    public otherPostList: number[] = []
    public randomPostList: number[] = []
    public likePostList: number[] = []
    public favoritePostList: number[] = []
    public postData: {} = {}

    public postLikeList: number[] = [] // 点赞列表 帖子ID
    public commentPostID: number = 0  // 指定帖子id
    public commentIDs: number[] = [] // 帖子id下的所有点赞过的评论id

    public draftData: any

    public itemsCache: {} = {}

    public userListCache: {} = {}

    /** userTimeline 搜索结果写入 randomPostList 或 otherPostList */
    public userTimelineListTarget: 'random' | 'other' = 'random'

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
            this.followList = data.list || []
            console.log("followList:", this.followList)
            EventSystem.send("followBack")
        }
        else if (this.isPostDataCmd(cmd)) {
            if (data?.nick_name && data?.list) {
                this.applyUserTimelineResult(data)
                return
            }
            this.receiveList(data.list || [])
            this.postList = this.setPostData(data.list || [])
            const postLikeIDs = data.postLikeIDs || []
            if (postLikeIDs.length > 0) {
                this.postLikeList = [...new Set([...this.postLikeList, ...postLikeIDs])]
            }
            console.log("postList:", this.postList)
            EventSystem.send("SocialPostData")
        }
        else if (cmd == network.FollowSocialCode.OtherPostData) {
            this.receiveList(data.list || [])
            this.otherPostList = this.setPostData(data.list || [])
            const postLikeIDs = data.postLikeIDs || []
            if (postLikeIDs.length > 0) {
                this.postLikeList = [...new Set([...this.postLikeList, ...postLikeIDs])]
            }
            EventSystem.send("otherPostList")
            console.log("OtherPostData data:", data)
        }
        else if (cmd == network.FollowSocialCode.CommentData && data?.list) {
            this.receiveList(data.list || [])
            this.commentIDs = data?.commentIDs || []
            this.commentPostID = data?.postID
            this.isFavorite = data?.isFavorite
            EventSystem.send("commentListData", { list: data.list, postID: data.postID, postAt: data.postAt, egg: data?.egg })
            EventSystem.send("postCollectConfirmBack", { postID: data.postID, isFavorite: this.isFavorite, changeCount: 0 })
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
            if (this.postData[data.postID] && this.postData[data.postID].LikeCount >= 0) {
                this.postData[data.postID].LikeCount = this.postData[data.postID].LikeCount + 1
            }
            EventSystem.send("postLikeConfirmBack", { postID: data.postID, isLike: true, changeCount: 1 })
        }
        else if (cmd == network.FollowSocialCode.UnLikeConfirm && !data?.commentID) {
            this.postLikeList = this.postLikeList.filter((item: any) => item != data.postID)
            if (this.postData[data.postID] && this.postData[data.postID].LikeCount > 0) {
                this.postData[data.postID].LikeCount = this.postData[data.postID].LikeCount - 1
            }
            EventSystem.send("postLikeConfirmBack", { postID: data.postID, isLike: false, changeCount: -1 })
        }
        else if (cmd == network.FollowSocialCode.LikeConfirm && data?.commentID) {
            this.commentIDs.push(data.commentID)
            EventSystem.send("commentLikeConfirmBack", { postID: data.postID, commentID: data.commentID, isLike: true, changeCount: 1 })
        }
        else if (cmd == network.FollowSocialCode.UnLikeConfirm && data?.commentID) {
            this.commentIDs = this.commentIDs.filter((item: any) => item != data.commentID)
            EventSystem.send("commentLikeConfirmBack", { postID: data.postID, commentID: data.commentID, isLike: false, changeCount: -1 })
        }
        else if (cmd == network.FollowSocialCode.Draft) {
            this.draftData = {
                content: data?.draft?.Content || "",
                title: data?.draft?.Title || "",
                imageUrl: data?.draft?.ImageURL || "",
            }
        }
        else if (cmd == network.FollowSocialCode.RandomPostData && data?.list) {
            const postLikeIDs = data.postLikeIDs || []
            if (postLikeIDs.length > 0) {
                this.postLikeList = [...new Set([...this.postLikeList, ...postLikeIDs])]
            }
            const sortedList = this.sortPostListByCreatedAtDesc(data.list || [])
            this.receiveList(sortedList)
            this.randomPostList = this.setPostData(sortedList)
            console.log("randomPostList:", this.randomPostList)
            EventSystem.send("FollowRandomPostData")
        }
        else if (cmd == network.FollowSocialCode.FollowSuccess) {
            this.followList.push(data.followedUserId)
            EventSystem.send("followBack", data.followedUserId)
        }
        else if (cmd == network.FollowSocialCode.UnFollowSuccess) {
            this.followList = this.followList.filter((item: any) => item != data.followedUserId)
            EventSystem.send("followBack", data.followedUserId)
        }
        else if (cmd == network.FollowSocialCode.FavoriteConfirm) {
            this.isFavorite = true
            if (this.postData[data.postID] && this.postData[data.postID].FavoriteCount >= 0) {
                this.postData[data.postID].FavoriteCount = this.postData[data.postID].FavoriteCount + 1
            }
            EventSystem.send("postCollectConfirmBack", { postID: data.postID, isFavorite: this.isFavorite, changeCount: 1 })
        }
        else if (cmd == network.FollowSocialCode.FavoriteCancel) {
            this.isFavorite = false
            if (this.postData[data.postID] && this.postData[data.postID].FavoriteCount > 0) {
                this.postData[data.postID].FavoriteCount = this.postData[data.postID].FavoriteCount - 1
            }
            EventSystem.send("postCollectConfirmBack", { postID: data.postID, isFavorite: this.isFavorite, changeCount: -1 })
        }
        else if (cmd == network.FollowSocialCode.LikePostData && data?.list) {
            this.receiveList(data.list || [])
            this.likePostList = this.setPostData(data.list || [])
            console.log("likePostList:", this.likePostList)
            if (this.likePostList.length > 0) {
                this.postLikeList = [...new Set([...this.postLikeList, ...this.likePostList])]
            }
        }
        else if (cmd == network.FollowSocialCode.FavoritePostData && data?.list) {
            this.receiveList(data.list || [])
            this.favoritePostList = this.setPostData(data.list || [])
            console.log("favoritePostList:", this.favoritePostList)
        }
    }

    private setPostData(list: any[]) : number[] {
        const ans = []
        list.forEach((i) => {
            this.postData[i.ID] = i
            ans.push(i.ID)
        })
        return ans
    }

    /** 帖子按 CreatedAt 降序；时间相同则 ID 大的在前 */
    private sortPostListByCreatedAtDesc(list: any[]): any[] {
        return list.slice().sort((a, b) => {
            const ta = Date.parse(String(a?.CreatedAt ?? '')) || 0
            const tb = Date.parse(String(b?.CreatedAt ?? '')) || 0
            if (tb !== ta) {
                return tb - ta
            }
            return Number(b?.ID ?? 0) - Number(a?.ID ?? 0)
        })
    }

    public getPostDataByPostList(index: number) {
        const id = this.postList[index]
        return this.postData[id]
    }

    public getPostDataByOtherPostList(index: number) {
        const id = this.otherPostList[index]
        return this.postData[id]
    }

    public getPostDataByRandomPostList(index: number) {
        const id = this.randomPostList[index]
        return this.postData[id]
    }

    public getPostDataByLikePostList(index: number) {
        const id = this.likePostList[index]
        return this.postData[id]
    }

    public getPostDataByFavoritePostList(index: number) {
        const id = this.favoritePostList[index]
        return this.postData[id]
    }

    public isFollowing(userId: any): boolean {
        if (userId == null || userId === '') {
            return false
        }
        return this.followList.some((item: any) => {
            if (item == userId) {
                return true
            }
            const id = item?.player_id ?? item?.playerId ?? item?.UserID ?? item?.userID ?? item?.id
            return id == userId
        })
    }

    private receiveList(list: any[]) {
        const userIDs = [...new Set(list.filter(item => !this.userListCache[item.UserID]).map(item => Number(item.UserID)))];
        if (userIDs.length > 0) {
            let json = new network.GetUserByIDRequest();
            AppConst.WebSocketManager.send(json.toJSON(userIDs))
        }
    }

    private isPostDataCmd(cmd: any): boolean {
        return cmd == network.FollowSocialCode.PostData || cmd === 'PostData'
    }

    private applyUserTimelineResult(data: any) {
        const postLikeIDs = data.postLikeIDs || []
        if (postLikeIDs.length > 0) {
            this.postLikeList = [...new Set([...this.postLikeList, ...postLikeIDs])]
        }
        const sortedList = this.sortPostListByCreatedAtDesc(data.list || [])
        this.receiveList(sortedList)
        const ids = this.setPostData(sortedList)
        if (data.player_id) {
            this.userListCache[data.player_id] = {
                ...(this.userListCache[data.player_id] || {}),
                player_id: data.player_id,
                nick_name: data.nick_name,
            }
            EventSystem.send("userListCache")
        }
        if (this.userTimelineListTarget === 'other') {
            this.otherPostList = ids
            EventSystem.send("otherPostList")
        } else {
            this.randomPostList = ids
            EventSystem.send("FollowRandomPostData")
        }
    }
}

