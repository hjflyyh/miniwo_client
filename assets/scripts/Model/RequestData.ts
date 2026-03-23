import { MapModel } from "./MapModel";

export module network {
    export enum ServerHttpCommand {
        COMMON_LOGIN = 1, // 登录
    }

    export enum ServerCode {
        CodeProfile = 100, //个人信息
        CodeBagUpdate = 101, //背包
        CodeMailList = 102, //邮件列表
        CodeMailNew = 103, //新邮件通知
        CodeCardList = 104, //卡牌列表
        CodeMapList = 105, //地图列表
    }

    export enum FollowSocialCode {
        FollowData = 4001, // 关注数据
        // TimelineData = 4002, // 朋友圈数据
        PostData = 403,// 帖子数据
        OtherPostData = 4004,// other帖子数据
        CommentData = 4005,// 评论数据
        TopCommentData = 4006, // 一级评论数据
        LikeData = 4007, // 点赞数据
        PostCreate = 4008, // 发布帖子
        LikeConfirm = 4009, // 点赞确认
        UnLikeConfirm = 4010, // 取消点赞确认
    }

    export enum ServerCommandConstants {
        COMMON_HEARBEAT = 99996, // 心跳
        COMMON_LOGIN = 10000, // 登录
        COMMON_NPC_LIST = 10109, // 获取npc信息
        COMMON_ROOM_DATA = 10012, // 获取房间信息
        COMMON_ROLE_MAP_DATA = 10125, // 自定义房间数据
    }

    export enum ServerCommandLoginType {
        tourist = 0,
        web3 = 1,
        google = 2,
        apple = 3
    }

    export class HeartbeatRequest {
        toJSON() {
            return { rpc: { id: "heartbeat", payload: JSON.stringify({}) } };
        }
    }

    export class JoinMapEequest {
        toJSON(map_id) {
            return { rpc: { id: "join_map", payload: JSON.stringify({ map_id: map_id }) } };
        }
    }

    export class MatchJoinEequest {
        toJSON(match_id) {
            return { match_join: { match_id: match_id } };
        }
    }

    //=================================1.登录接口
    export class LoginRequest {
        private player_id
        constructor(player_id) {
            this.player_id = player_id
        }

        toJSON() {
            return { rpc: { id: "game_login", payload: JSON.stringify({ player_id: this.player_id }) } };
        }
    }

    //npc 列表
    export class GetAllNPCRequest {
        requestId: number; type: number; command: number;

        constructor() {
            this.requestId = 0;
            this.type = 1; // 固定值
            this.command = ServerCommandConstants.COMMON_NPC_LIST;
        }
        toJSON() {
            return { requestId: this.requestId, type: this.type, command: this.command };
        }
    }

    //房间信息
    export class GetRoomDataRequest {
        requestId: number; type: number; command: number;

        constructor() {
            this.requestId = 0;
            this.type = 1; // 固定值
            this.command = ServerCommandConstants.COMMON_ROOM_DATA;
        }
        toJSON() {
            return { requestId: this.requestId, type: this.type, command: this.command };
        }
    }

    //进入聊天
    export class MapChatHistory {
        public static toJSON() {
            return { id : "map_chat_history" , payload: JSON.stringify({
                map_id: MapModel.getInstance().currentMapId, // 或可省略，用当前地图
                limit: 50,
                cursor: ""
            }) };
        }
    }

    //获取自定义地图数据
    export class GetMapData {
        requestId: number; type: number; command: number;
        data: {}

        constructor() {
            this.requestId = 0;
            this.type = 1; // 固定值
            this.command = ServerCommandConstants.COMMON_ROLE_MAP_DATA;
            this.data = {
                id: 0
            }
        }
        toJSON() {
            return { requestId: this.requestId, type: this.type, command: this.command, data: this.data };
        }
    }

    export class CombineRequest {
        toJSON(card_id) {
            return { rpc: { id: "card_combine", payload: JSON.stringify({ card_id: card_id }) } };
        }
    }

    export class StarUpRequest {
        toJSON(card_id, count) {
            return { rpc: { id: "card_star_up", payload: JSON.stringify({ card_id: card_id, count: count }) } };
        }
    }
    export class LevelUpRequest {
        toJSON(card_id, count) {
            return { rpc: { id: "card_lv_up", payload: JSON.stringify({ card_id: card_id, count: count }) } };
        }
    }
}