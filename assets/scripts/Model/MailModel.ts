import { AppConst } from "../AppConst";
import { network } from "./RequestData";

export class MailModel {
    public mails = []

    private static _inst: MailModel | null = null;
    public static getInstance(): MailModel {
        if (!this._inst) this._inst = new MailModel();
        return this._inst;
    }

    public static resetInstance(): void {
        MailModel._inst = null;
    }

    public init() {
        EventSystem.addListent("HttpMessage", this.OnHttpMessage, this);
        EventSystem.addListent("WebSocketNotifications", this.OnWSNotification, this)
    }    

    public OnHttpMessage(){

    }

    public OnRead(id){
        for(let m = 0 ; m < this.mails.length ; m++){
            if(this.mails[m].id == id && !this.mails[m].is_read){
                this.mails[m].is_read = true;
                let MailReadRequest = new network.MailReadRequest();
                AppConst.WebSocketManager.send(MailReadRequest.toJSON(id));
            }
        }
    }

    private OnWSNotification(data) {
        if (data.code == network.ServerCode.CodeMailList) {
            console.log("邮件列表")
            console.log(data)
            let content = JSON.parse(data.content)
            if(content.mails){
                this.mails = content.mails
            }
            EventSystem.send("MailUpdate")
        }
    }    
}

