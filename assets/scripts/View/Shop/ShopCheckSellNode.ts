import { _decorator, Component, Label, Node, resources, Sprite, SpriteFrame } from 'cc';
import { getBasicSeedMatureSpriteResourcePath } from '../../Model/Farm/FarmSeedVisual';
import { BagModel } from '../../Model/BagModel';
import { AppConst } from '../../AppConst';
import { network } from '../../Model/RequestData';
const { ccclass, property } = _decorator;

@ccclass('ShopCheckSellNode')
export class ShopCheckSellNode extends Component {
    @property(Sprite)
    checkItemSprite: Sprite = null

    @property(Label)
    checkNeedItemCount: Label = null

    @property(Label)
    checkLimitCount: Label = null

    @property(Label)
    checkChooseCount: Label = null


    chooseCount = 1
    shopData: any = null
    start() {
        EventSystem.addListent("BagUpdate", this.refreshShowItem, this)
    }

    refreshShowItem() {
        if(BagModel.getInstance().getItemCount(Number(this.shopData.item_id)) <= 0){
            this.node.active = false
            return
        }
        this.refreshSellNode(this.shopData, 1)
    }
    
    refreshSellNode(shopData, chooseCount){
        console.log("刷新出售界面", shopData, chooseCount)
        this.shopData = shopData
        this.chooseCount = chooseCount
        this.checkChooseCount.string = "" + chooseCount
        this.checkNeedItemCount.string = "" + shopData.base_crop_price * chooseCount
        this.checkLimitCount.string = "Inventory:" + BagModel.getInstance().getItemCount(Number(shopData.item_id))
        let _this = this
        resources.load(getBasicSeedMatureSpriteResourcePath(shopData.id + ""), SpriteFrame, (err, sf) => {
            _this.checkItemSprite.spriteFrame = sf;
        });
    }
    
    onClickAdd(){
        this.chooseCount++
        let num = BagModel.getInstance().getItemCount(Number(this.shopData.item_id))
        if(this.chooseCount > num){
            this.chooseCount = num
        }
        this.refreshSellNode(this.shopData, this.chooseCount)
    }

    onClickReduce(){
        if(this.chooseCount <= 1){
            return
        }
        this.chooseCount--
        this.refreshSellNode(this.shopData, this.chooseCount)
    }

    onClickConfirm(){
        console.log("点击确认出售", this.shopData, this.chooseCount)
        // this.node.active = false

        const json = new network.ShopSellRequest()
        AppConst.WebSocketManager.send(json.toJSON(this.shopData.item_id, this.chooseCount))
    }
}

