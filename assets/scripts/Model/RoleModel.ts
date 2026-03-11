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

    public token : string;
    public playerId : string

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
    }

    public loginWS(){
        let json = new network.LoginRequest(this.playerId);
        AppConst.WebSocketManager.send(json.toJSON());
    }

    private OnHttpMessage(data){
        if(data.cmd == network.ServerHttpCommand.COMMON_LOGIN){
            this.token = data.token
            this.nickName = data.nick_name
            this.playerId = data.player_id

            
            AppConst.WebSocketManager.setConfig("ws://" + HttpManager.ipBase + ":7350/ws?token=" + data.nakama_token);
            AppConst.WebSocketManager.connect();
            EventSystem.send("LoginSuccess")
        }
    }
}