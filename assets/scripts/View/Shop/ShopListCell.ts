import { _decorator, Component, instantiate, Label, math, Node, Size } from 'cc';
import { YXCollectionView } from '../../../plugin/list-3x/yx-collection-view';
import { CardModel } from '../../Model/CardModel';
import { CustomGridFlowLayout } from '../../../plugin/list-3x/custom-grid-flow-layout';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
import { network } from '../../Model/RequestData';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('ShopListCell')
export class ShopListCell extends Component {
    @property(Label)
    ShopLimit: Label = null

    @property(Label)
    ShopMoney: Label

    private itemID
    start() {

    }

    setShopId(Shop_data) {
        console.log("'ShopListCell'ShopId'", Shop_data)
        this.itemID = Shop_data.item_id
        if (Shop_data.limit >= 0) {
            this.ShopLimit.string = "Limit: " + Shop_data.limit
            if (Shop_data.limit == 0) {
                this.ShopLimit.string = "no sale"
            }
        }

        if (isNaN(Shop_data.sale_price)) {
            console.log("Shop_data.sale_price", Shop_data.sale_price)
            const priceArr = Shop_data.sale_price.split(";")
            console.log("priceArr", priceArr)
            this.ShopMoney.string = "$X" + priceArr[Shop_data.saleCount]
        } else {
            this.ShopMoney.string = "$X" + Shop_data.sale_price
        }
    }

    OnClickBuy() {
        console.log("ShopListCell OnClickBuy")
        let json = new network.ShopBuyRequest();
        AppConst.WebSocketManager.send(json.toJSON(this.itemID, 1))
    }

}