import { AppConst } from "../AppConst";
import { network } from "./RequestData";

export class CardModel {
    private static _instance: CardModel = null;

    public cards = []
    public maps = {}
    public mapNames = {}

    public combine = {
        "N" : 1,
        "R" : 2,
        "SR" : 3,
        "SSR" : 4,
    }

    public static getInstance(): CardModel {
        if (!this._instance) {
            this._instance = new CardModel();
        }
        return this._instance;
    }

    public init(){
        EventSystem.addListent("WebSocketNotifications" , this.OnWSNotification , this)
    }

    //获取卡牌当前碎片数量
    public getCardSuipianNum(card_data){
        let num = 0;
        for(let c in card_data.fragment_json){
            num++;
        }
        return num
    }

    public getCardCombineCfg(combine){
        let cfgAll = AppConst.JSONManager.getItemAll("cardCombine")
        for(let c in cfgAll){
            if(cfgAll[c]["rare"] == combine){
                return cfgAll[c]
            }
        }
        return null
    }

    private OnWSNotification(data){
        if(data.code == network.ServerCode.CodeCardList){
            console.log("更新卡牌数据")
            // console.log(JSON.parse(data.content))
            this.cards = JSON.parse(data.content).cards
            this.maps = {}
            if(this.cards.length > 0){
                for(let c = 0 ; c < this.cards.length ; c++){
                    let mapId = this.cards[c].map_id
                    if(this.maps[mapId]){
                        this.maps[mapId].push(this.cards[c])
                    }else{
                        this.maps[mapId] = [this.cards[c]]
                        this.mapNames[mapId] = this.cards[c].map_name
                    }
                }
            }
            console.log(this.maps)
        }
    }
}