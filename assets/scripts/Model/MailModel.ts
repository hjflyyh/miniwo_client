import { network } from "./RequestData";

export class MailModel {
    public mails

    private static _inst: MailModel | null = null;
    public static getInstance(): MailModel {
        if (!this._inst) this._inst = new MailModel();
        return this._inst;
    }

    public init() {
        EventSystem.addListent("HttpMessage", this.OnHttpMessage, this);
        EventSystem.addListent("WebSocketNotifications", this.OnWSNotification, this)
    }    

    public OnHttpMessage(){

    }

    private OnWSNotification(data) {
        if (data.code == network.ServerCode.CodeMailList) {
            console.log("邮件列表")
            console.log(data)
            let content = JSON.parse(data.content)
            this.mails = content.mails
            EventSystem.send("MailUpdate")
        }
    }    
}

