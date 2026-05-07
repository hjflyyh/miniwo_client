import { _decorator, Color, Component, instantiate, Label, math, Node, Size } from 'cc';
import { YXCollectionView } from '../../../plugin/list-3x/yx-collection-view';
import { CardModel } from '../../Model/CardModel';
import { CustomGridFlowLayout } from '../../../plugin/list-3x/custom-grid-flow-layout';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
import { network } from '../../Model/RequestData';
import { AppConst } from '../../AppConst';
import { PrefabLoad } from '../../Utils/PrefabLoad';
import { BagModel } from '../../Model/BagModel';
const { ccclass, property } = _decorator;

@ccclass('ShopListCell')
export class ShopListCell extends Component {
    private static readonly DIAMOND_ITEM_ID = 101
    private static readonly MONEY_COLOR_ENOUGH = new Color(0, 255, 0, 255)
    private static readonly MONEY_COLOR_NOT_ENOUGH = new Color(255, 0, 0, 255)
    private static readonly MONEY_COLOR_DEFAULT = new Color(255, 255, 255, 255)

    @property(Label)
    ShopLimit: Label = null

    @property(Label)
    ShopMoney: Label

    @property(PrefabLoad)
    icon : PrefabLoad = null

    private itemID
    private shopData: any = null
    start() {

    }

    setShopId(Shop_data) {
        // console.log("'ShopListCell'ShopId'", Shop_data)
        this.shopData = Shop_data
        this.itemID = Shop_data.item_id
        if (Shop_data.limit >= 0) {
            this.ShopLimit.string = "Limit: " + Shop_data.limit
            if (Shop_data.limit == 0) {
                this.ShopLimit.string = "no sale"
            }
        }else{
            this.ShopLimit.string = ""
        }

        const needPrice = this.getSalePrice(Shop_data)
        this.ShopMoney.string = "X" + needPrice
        this.refreshMoneyColor(Shop_data, needPrice)
        
        this.icon.url = "UITexture/itemIcon/"+ Shop_data.item_id + "/spriteFrame"
    }

    private getSalePrice(shopData: any): number {
        if (isNaN(shopData.sale_price)) {
            const priceArr = String(shopData.sale_price || "").split(";")
            const idx = Math.max(0, Number(shopData.saleCount) || 0)
            const pick = idx < priceArr.length ? priceArr[idx] : priceArr[priceArr.length - 1]
            const v = Number(pick)
            return Number.isFinite(v) ? v : 0
        }
        const v = Number(shopData.sale_price)
        return Number.isFinite(v) ? v : 0
    }

    private getDiamondCount(): number {
        const slots = (BagModel.getInstance().slots as any[]) || []
        const diamond = slots.find((s: any) => Number(s?.item_id) === ShopListCell.DIAMOND_ITEM_ID)
        const count = Number(diamond?.count ?? 0)
        return Number.isFinite(count) ? Math.max(0, count) : 0
    }

    private refreshMoneyColor(shopData: any, needPrice: number) {
        if (Number(shopData?.currency) === 0) {
            const diamond = this.getDiamondCount()
            this.ShopMoney.color = diamond >= needPrice
                ? ShopListCell.MONEY_COLOR_DEFAULT
                : ShopListCell.MONEY_COLOR_NOT_ENOUGH
            return
        }
        this.ShopMoney.color = ShopListCell.MONEY_COLOR_DEFAULT
    }

    OnClickBuy() {
        console.log("ShopListCell OnClickBuy")
        if (this.shopData && Number(this.shopData.currency) === 0) {
            const needPrice = this.getSalePrice(this.shopData)
            const diamond = this.getDiamondCount()
            if (diamond < needPrice) {
                EventSystem.send("ShowTips", "道具不足")
                return
            }
        }
        let json = new network.ShopBuyRequest();
        AppConst.WebSocketManager.send(json.toJSON(this.itemID, 1))
    }

}