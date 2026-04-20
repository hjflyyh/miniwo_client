import { AppConst } from "../AppConst";
import { network } from "./RequestData";

export class ShopModel {
    private static _instance: ShopModel = null;

    // public empty_slots: number
    private shopList: any[] = []

    public static getInstance(): ShopModel {
        if (!this._instance) {
            this._instance = new ShopModel();
        }
        return this._instance;
    }

    public init() {
        EventSystem.addListent("WebSocketMessage", this.OnWebSocketMessage, this)
    }

    public getShopList() {
        if (this.shopList.length == 0) {
            const cfgAll = AppConst.JSONManager.getItemAll("gameStore")
            this.shopList = (Object as any).values(cfgAll)
        }
        return this.shopList
    }

    private OnWebSocketMessage(answer) {
        if (answer["id"] == "shop_data" && answer["payload"]) {
            let payload = JSON.parse(answer["payload"]);
            if(!payload || !payload.success || !payload.data){
                return;
            }
            this.shopList = this.getShopList()
            payload["data"].forEach(i => {
                let index = this.shopList.findIndex(s => s.item_id == i.item_id)
                if(index != -1){
                    this.shopList[index].limit = i.limit;
                    this.shopList[index].saleCount = i.saleCount;
                }
            });
        }
    }
}