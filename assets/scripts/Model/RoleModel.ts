import { sys } from "cc";
import { network } from "./RequestData";
import { AppConst } from "../AppConst";
import { NPCModel } from "./NPCModel";
import { HttpManager } from "../Manager/HttpManager";

export class RoleModel {
    private static _instance: RoleModel = null;

    public loginType: number;
    public name: string;
    public password: string;
    public nickName: string;
    public avatar: number;
    public sex: number;
    public timeZone: number;
    public clientOs: string;
    public userId: string;
    public inviteCode: string;
    public invite: string;
    public address: string;
    public nakama_token : string;

    public token : string;
    public playerId : string
    private nakamaSessionId: string = "";
    private isForceLogoutHandling: boolean = false;

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
        if(payload && payload.success === false && payload.code === "SESSION_REPLACED"){
            this.handleForceLogout(payload.message || "账号已在其他设备登录");
            return;
        }

        if(data["id"] == "game_login"){
            if(payload && payload.success){
                if(payload.session_id){
                    this.nakamaSessionId = String(payload.session_id);
                }

                EventSystem.send("LoginSuccess")
                return;
            }
            if(payload && payload.success === false){
                const msg = payload.message || "游戏登录失败";
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
            this.isForceLogoutHandling = false;
            this.nakamaSessionId = "";
            this.token = data.token
            this.nickName = data.nick_name
            this.playerId = data.player_id
            this.nakama_token = data.nakama_token
            
            AppConst.WebSocketManager.setConfig("ws://" + HttpManager.ipBase + ":7350/ws?token=" + data.nakama_token);
            AppConst.WebSocketManager.connect();
        }
    }
}