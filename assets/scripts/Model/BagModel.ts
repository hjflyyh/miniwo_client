import { AppConst } from "../AppConst";
import { network } from "./RequestData";

export class BagModel {
    private static _instance: BagModel = null;

    public empty_slots: number
    public slots: number[]

    public static getInstance(): BagModel {
        if (!this._instance) {
            this._instance = new BagModel();
        }
        return this._instance;
    }

    public init() {
        EventSystem.addListent("WebSocketNotifications", this.OnWSNotification, this)
    }

    public getAllowedRewards() {
        let cfgAll = AppConst.JSONManager.getItemAll("socialEasterEgg")
        let arr = []
        for (let c in cfgAll) {
            if (cfgAll[c] && cfgAll[c]["allowed_rewards"]) {
                arr.push(cfgAll[c]["allowed_rewards"])
            }
        }
        return arr
    }

    public getSlotAllowedRewards() {
        return this.slots.filter((item) => this.getAllowedRewards().indexOf(`${item["item_id"]}`) >= 0)
    }

    public getMaxEggCount() {
        return AppConst.JSONManager.getItemAll("systemConfig")[18]["configuration"].split("_")[0]
    }


    private OnWSNotification(data) {
        if (data.code == network.ServerCode.CodeBagUpdate) {
            console.log("更新背包数据")
            let contentData = JSON.parse(data.content)
            this.empty_slots = contentData.empty_slots
            this.slots = contentData.slots
        }
    }
}