import { network } from "./RequestData";

export class AffinitieModel {
    private static _instance: AffinitieModel = null;

    private static AffintiteLv = {
        0 : [-100 , -1],
        1 : [0 , 199],
        2 : [200 , 399],
        3 : [400 , 599],
        4 : [600 , 799],
        5 : [800 , 1000],
    }

    public static getInstance(): AffinitieModel {
        if (!this._instance) {
            this._instance = new AffinitieModel();
        }
        return this._instance;
    }

    public init() {
        EventSystem.addListent("WebSocketNotifications", this.OnWSNotification, this)
    }
    
    private OnWSNotification(data) {
        if (data.code == network.ServerCode.CodePlayerNpcAffinity) {
            console.log("更新用户->npc好感度")
            
        }
    }    
}


