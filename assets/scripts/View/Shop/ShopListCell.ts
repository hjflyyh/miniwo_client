import { _decorator, Color, Component, instantiate, Label, math, Node, resources, Size, Sprite, SpriteFrame } from 'cc';
import { YXCollectionView } from '../../../plugin/list-3x/yx-collection-view';
import { CardModel } from '../../Model/CardModel';
import { CustomGridFlowLayout } from '../../../plugin/list-3x/custom-grid-flow-layout';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
import { network } from '../../Model/RequestData';
import { AppConst } from '../../AppConst';
import { PrefabLoad } from '../../Utils/PrefabLoad';
import { BagModel } from '../../Model/BagModel';
import { getBasicSeedMatureSpriteResourcePath } from '../../Model/Farm/FarmSeedVisual';
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


    @property(Node)
    zhuanshi : Node = null

     @property(Node)
    jinbi : Node = null   

    @property(Node)
    sellNode : Node = null

    @property(Sprite)
    buttonSprite : Sprite = null

    private itemID
    private shopData: any = null
    start() {

    }

    setSellId(data){
        this.shopData = data
        this.ShopMoney.color = new Color(87, 80, 238, 255)
        this.buttonSprite.color = Color.WHITE

        this.sellNode.active = true;
        this.jinbi.active = true
        this.zhuanshi.active = false
        this.itemID = data.item_id
        let _this = this
        resources.load(getBasicSeedMatureSpriteResourcePath(data.id + ""), SpriteFrame, (err, sf) => {
            _this.icon.node.getComponent(Sprite).spriteFrame = sf;
        });
        this.ShopLimit.string = ""
        this.ShopMoney.string = "" + data.base_crop_price

        this.icon.node.scale = new math.Vec3(0.8, 0.8, 0.8)
    }

    setShopId(Shop_data) {
        this.ShopMoney.color = Color.WHITE
        this.buttonSprite.color = new Color(134, 129, 255, 255)

        this.sellNode.active = false;
        this.jinbi.active = Shop_data.currency == 2
        this.zhuanshi.active = Shop_data.currency == 0    
        this.icon.node.scale = new math.Vec3(2, 2, 2)    
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
        let _this = this
        resources.load("UITexture/itemIcon/"+ Shop_data.item_id + "/spriteFrame", SpriteFrame, (err, sf) => {
            _this.icon.node.getComponent(Sprite).spriteFrame = sf;
        });
        // this.icon.url = "UITexture/itemIcon/"+ Shop_data.item_id + "/spriteFrame"
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
        // if (this.shopData && Number(this.shopData.currency) === 0) {
        //     const needPrice = this.getSalePrice(this.shopData)
        //     const diamond = this.getDiamondCount()
        //     if (diamond < needPrice) {
        //         EventSystem.send("ShowTips", "道具不足")
        //         return
        //     }
        // }
        // let json = new network.ShopBuyRequest();
        // AppConst.WebSocketManager.send(json.toJSON(this.itemID, 1))
        EventSystem.send("ShowBuyCheck", this.shopData)
    }

}