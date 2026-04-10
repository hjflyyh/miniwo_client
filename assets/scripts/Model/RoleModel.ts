import { sys } from "cc";
import { network } from "./RequestData";
import { AppConst } from "../AppConst";
import { NPCModel } from "./NPCModel";
import { HttpManager } from "../Manager/HttpManager";
import { PrivateChatManager } from "../Manager/PrivateChatMessage";

export class RoleModel {
    private static _instance: RoleModel = null;

    public loginType: number;
    public name: string;
    public password: string;
    public nickName: string;
    public avatar: string;
    public gender: number;
    public birth: number;
    public age: number;
    public mbti: string;
    public bio: string;

    public timeZone: number;
    public clientOs: string;
    public userId: string;
    public nakamaUserId: string;
    public inviteCode: string;
    public invite: string;
    public address: string;
    public nakama_token : string;

    public token : string;
    public playerId : string

    public tags ;

    private nakamaSessionId: string = "";
    private isForceLogoutHandling: boolean = false;
    /** 最近一次 game_login 成功的时间，用于避免重连/并发登录时序误伤 */
    private lastLoginSuccessAtMs: number = 0;

    /**
     * 获取单例实例
     */
    public static getInstance(): RoleModel {
        if (!this._instance) {
            this._instance = new RoleModel();
        }
        return this._instance;
    }

    public init(){
        EventSystem.addListent("HttpMessage" , this.OnHttpMessage , this)
        EventSystem.addListent("WebSocketMessage" , this.OnWebSocketMessage , this)
        EventSystem.addListent("WebSocketNotifications" , this.OnWSNotification , this)
    }

    public onWebSocketConnected(){
        // 重要：重连窗口期内可能会收到服务端对“旧会话”的 force_logout 通知。
        // 若此时仍保留旧 nakamaSessionId，会误判为当前会话并强退。
        // 因此在发起 game_login 前先清空，待 game_login success 再写入新的 session_id。
        this.nakamaSessionId = "";
        this.loginWS();
    }

    public loginWS(){
        let json = new network.LoginRequest(this.playerId);
        AppConst.WebSocketManager.send(json.toJSON());
    }

    private parseRpcPayload(rawPayload: any): any {
        if (rawPayload == null || rawPayload === "") {
            return null;
        }
        if (typeof rawPayload === "string") {
            try {
                return JSON.parse(rawPayload);
            } catch {
                return null;
            }
        }
        return rawPayload;
    }

    private OnWebSocketMessage(data){
        if(!data || !data["id"]){
            return;
        }
        const payload = this.parseRpcPayload(data["payload"]);

        // 不在此处对「任意 RPC」的 SESSION_REPLACED 做异地强退：
        // 重连/Join 等场景下服务端可能对旧会话返回 SESSION_REPLACED，误伤当前新会话。
        // 真·异地踢下线仅通过 OnWSNotification（code=199, force_logout + target_session_id）处理。

        if(data["id"] == "game_login"){
            if(payload && payload.success){
                if(payload.session_id){
                    this.nakamaSessionId = String(payload.session_id);
                    this.nakamaUserId = String(payload.user_id);
                    this.lastLoginSuccessAtMs = Date.now();

                    PrivateChatManager.getInstance().init(this.nakamaUserId);
                }

                EventSystem.send("LoginSuccess")
                return;
            }
            if(payload && payload.success === false){
                let msg = payload.message || "游戏登录失败";
                if(payload.code === "SESSION_REPLACED"){
                    msg = "会话已失效，请重新登录";
                }
                EventSystem.send("ShowTips" , msg);
                return
            }

        }
    }

    private OnWSNotification(data){
        if(!data || Number(data.code) !== 199){
            return;
        }
        const content = this.parseRpcPayload(data.content);
        if(!content || content.type !== "force_logout"){
            return;
        }
        const targetSessionID = content.target_session_id ? String(content.target_session_id) : "";
        // 必须精确命中当前会话才执行强退：
        // 1) 服务端若未携带目标会话，直接忽略，避免误伤当前新端
        // 2) 客户端尚未拿到本端 session_id（game_login success 前），先忽略
        // 3) 目标会话与当前会话不一致，忽略
        if (!targetSessionID || !this.nakamaSessionId || targetSessionID !== this.nakamaSessionId) {
            return;
        }
        // 防误伤：在刚完成登录的极短窗口内，可能收到针对“旧会话”的清理通知（时序/推送延迟），
        // 但 session_id 可能短暂复用/刷新导致误命中当前会话；此时先忽略，不立即强退。
        // 真正的异地登录踢下线通常发生在稳定在线期间（不在这个窗口）。
        if (this.lastLoginSuccessAtMs > 0 && (Date.now() - this.lastLoginSuccessAtMs) < 3000) {
            try {
                console.log("[force_logout] ignored in login window", {
                    targetSessionID,
                    currentSessionID: this.nakamaSessionId,
                    message: content.message,
                });
            } catch {}
            return;
        }
        const message = content.message || "账号已在其他设备登录";
        this.handleForceLogout(message);
    }

    private handleForceLogout(message: string){
        if(this.isForceLogoutHandling){
            return;
        }
        this.isForceLogoutHandling = true;

        this.token = "";
        this.playerId = "";
        this.nakamaSessionId = "";
        EventSystem.send("ForceLogout");

        if(AppConst.WebSocketManager && AppConst.WebSocketManager.disconnect){
            AppConst.WebSocketManager.disconnect();
        }

        const loginViewUrl = "res/View/Login/LoginView";
        if(AppConst.PanelManager){
            AppConst.PanelManager.CloseAll();
            if(!AppConst.PanelManager.viewIsOpen(loginViewUrl)){
                AppConst.PanelManager.openView(loginViewUrl);
            }
        }
        EventSystem.send("ShowTips" , message || "账号已在其他设备登录");
    }

    private OnHttpMessage(data){
        if(data.cmd == network.ServerHttpCommand.COMMON_LOGIN){
            console.log("-----------data:", data)
            
            this.isForceLogoutHandling = false;
            this.nakamaSessionId = "";
            this.token = data.token
            this.nickName = data.nick_name
            this.avatar = data.avatar
            this.playerId = data.player_id
            this.nakama_token = data.nakama_token
            
            this.tags = data.tags

            if(data.info){
                const userInfo = JSON.parse(data.info)
                this.gender = userInfo?.gender || 0
                this.birth = userInfo?.birth || 0
                this.age = userInfo?.age || 0
                this.mbti = userInfo?.mbti || ""
                this.bio = userInfo?.bio || ""
            }

            AppConst.WebSocketManager.setConfig("ws://" + HttpManager.ipBase + ":7350/ws?token=" + data.nakama_token);
            AppConst.WebSocketManager.connect();
        }
    }
}