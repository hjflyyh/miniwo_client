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

    private applyShopData(rows: any[]) {
        this.shopList = this.getShopList()
        if (!Array.isArray(rows)) {
            return
        }
        rows.forEach(i => {
            let index = this.shopList.findIndex(s => s.item_id == i.item_id)
            if (index != -1) {
                this.shopList[index].limit = i.limit;
                this.shopList[index].saleCount = i.saleCount;
                if (i.sale_price != null) {
                    this.shopList[index].sale_price = i.sale_price;
                }
                if (i.buy_count != null) {
                    this.shopList[index].buy_count = i.buy_count;
                }
            }
        });
    }

    private OnWebSocketMessage(answer) {
        if (answer["id"] == "shop_data" && answer["payload"]) {
            console.log("ShopModel OnWebSocketMessage", answer)
            let payload = JSON.parse(answer["payload"]);
            if(!payload || !payload.success || !payload.data){
                return;
            }
            this.applyShopData(payload["data"])
            EventSystem.send("ShopDataUpdated")
        }

        if (answer["id"] == "shop_buy" && answer["payload"]) {
            console.log("ShopModel OnWebSocketMessage shop_buy", answer)
            let payload = JSON.parse(answer["payload"]);
            console.log("ShopModel OnWebSocketMessage shop_buy payload", payload)
            if(!payload || !payload.success || !payload.data){
                return;
            }
            this.applyShopData(payload["data"])
            EventSystem.send("ShopDataUpdated")
        }
    }
}