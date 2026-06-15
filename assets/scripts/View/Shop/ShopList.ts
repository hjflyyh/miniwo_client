import { _decorator, Color, Component, Label, Node, resources, Size, Sprite, SpriteFrame, Vec3 } from 'cc';
import { YXCollectionView } from '../../../plugin/list-3x/yx-collection-view';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
import { ShopListCell } from './ShopListCell';
import { ShopModel } from '../../Model/ShopModel';
import { BagModel } from '../../Model/BagModel';
import { network } from '../../Model/RequestData';
import { AppConst } from '../../AppConst';
import { Utils } from '../../Utils/Utils';
import { ShopCheckSellNode } from './ShopCheckSellNode';
const { ccclass, property } = _decorator;

@ccclass('ShopList')
export class ShopList extends Component {
    private static readonly DIAMOND_ITEM_ID = 101;
    private static readonly MONEY_COLOR_DEFAULT = Color.BLACK;
    private static readonly MONEY_COLOR_NOT_ENOUGH = Color.RED;

    /**
     * 列表组件
     */
    @property(YXCollectionView)
    listComp: YXCollectionView = null

    @property(YXCollectionView)
    listSellComp: YXCollectionView = null

    showShops = []
    showSells = []

    private column = 4

    @property(Node)
    checkNode: Node = null

    @property(Node)
    checkSellNode : Node = null

    @property(Label)
    checkItemName: Label = null

    @property(Sprite)
    checkItemSprite: Sprite = null

    @property(Sprite)
    checkNeedItemSprite: Sprite = null

    @property(Label)
    checkNeedItemCount: Label = null

    @property(Label)
    checkLimitCount: Label = null

    @property(Label)
    checkChooseCount: Label = null

    @property([Node])
    public chooseNodes: Node[] = [];

    @property([Label])
    public chooseLabeles: Label[] = [];

    @property(Node)
    public bottomNode : Node = null;

    chooseCheckShopId = 0
    chooseCheckShopNum = 1
    private chooseCheckShopData: any = null

    private showType = 0;

    start() {
        if(Utils.handleAdaptation()){
            this.bottomNode.scale = new Vec3(0.7 , 0.7 , 1)
        }

        EventSystem.addListent("ShopDataUpdated", this.refreshShopList, this)
        EventSystem.addListent("ShowBuyCheck", this.onShowBuyCheck, this)
        EventSystem.addListent("BagUpdate", this.refreshCheckNode, this)

        let json = new network.ShopDataRequest();
        AppConst.WebSocketManager.send(json.toJSON());
        this.scheduleOnce(() => {
            this.refreshShopList();
        }, 0.1)
        if (this.checkNode) {
            this.checkItemSprite.spriteFrame = null
            this.checkNode.active = false
        }
        this.checkSellNode.active = false
        
        this.refrehsTab();
    }

    refrehsTab() {
        for (let i = 0; i < this.chooseNodes.length; i++) {
            if (i == this.showType) {
                this.chooseNodes[i].active = true;
                this.chooseLabeles[i].color = Color.WHITE;
            } else {
                this.chooseNodes[i].active = false;
                this.chooseLabeles[i].color = new Color(133, 133, 166);
            }
        }

        this.refreshShopList();
    }


    onClickTab(_a: unknown, b: string) {
        const next = Number(b);
        if (!Number.isFinite(next) || this.showType === next) {
            return;
        }
        this.showType = next;
        this.refrehsTab();
    }


    onDestroy() {
        EventSystem.remove(this)
    }

    private onShowBuyCheck(shopData: any) {
        if (!shopData) {
            return
        }
        if(this.showType == 2){
            this.checkSellNode.active = true
            let sellNode = this.checkSellNode.getComponent(ShopCheckSellNode) as ShopCheckSellNode
            sellNode.refreshSellNode(shopData, 1)
        }else{
            this.chooseCheckShopData = this.resolveShopData(shopData)
            this.chooseCheckShopId = Number(this.chooseCheckShopData?.item_id)
            this.chooseCheckShopNum = 1
            if (this.checkNode) {
                this.checkNode.active = true
            }
            this.refreshCheckNode()
        }
    }

    refreshCheckNode() {
        if (!this.checkNode?.active || !this.chooseCheckShopData) {
            return
        }

        this.chooseCheckShopData = this.resolveShopData(this.chooseCheckShopData)
        this.ensureCheckRefs()

        const shopData = this.chooseCheckShopData
        const itemId = Number(shopData?.item_id)
        const maxCount = this.getMaxBuyCount(shopData)
        if (maxCount <= 0) {
            this.chooseCheckShopNum = 0
        } else {
            this.chooseCheckShopNum = Math.min(Math.max(1, this.chooseCheckShopNum), maxCount)
        }

        if (this.checkItemName) {
            this.checkItemName.string = this.resolveItemName(shopData, itemId)
        }
        this.loadItemSprite(this.checkItemSprite, itemId)

        const currencyItemId = this.getCurrencyItemId(shopData)
        this.loadItemSprite(this.checkNeedItemSprite, currencyItemId)

        const unitPrice = this.getSalePrice(shopData)
        const totalPrice = unitPrice * Math.max(0, this.chooseCheckShopNum)
        if (this.checkNeedItemCount) {
            this.checkNeedItemCount.string = "X" + totalPrice
            this.refreshNeedItemColor(shopData, totalPrice)
        }

        if (this.checkLimitCount) {
            const limit = Number(shopData?.limit)
            if (limit >= 0) {
                this.checkLimitCount.string = limit === 0 ? "no sale" : ("Limit: " + limit)
            } else {
                const personalLimit = Number(shopData?.personal_limit)
                this.checkLimitCount.string = Number.isFinite(personalLimit) && personalLimit > 0
                    ? ("Limit: " + personalLimit)
                    : ""
            }
        }

        if (this.checkChooseCount) {
            this.checkChooseCount.string = String(Math.max(0, this.chooseCheckShopNum))
        }
    }

    onClickOpenCheck() {
        if (this.checkNode) {
            this.checkNode.active = true
        }
        this.refreshCheckNode()
    }

    //确认购买
    onClickCheckBuy() {
        if (!this.chooseCheckShopData) {
            return
        }

        const shopData = this.resolveShopData(this.chooseCheckShopData)
        const limit = Number(shopData?.limit)
        if (limit === 0) {
            EventSystem.send("ShowTips", "已售罄")
            return
        }

        const count = Math.max(0, this.chooseCheckShopNum)
        if (count <= 0) {
            EventSystem.send("ShowTips", "购买数量无效")
            return
        }

        const maxCount = this.getMaxBuyCount(shopData)
        if (count > maxCount) {
            EventSystem.send("ShowTips", "超出可购买数量")
            this.chooseCheckShopNum = Math.max(1, maxCount)
            this.refreshCheckNode()
            return
        }

        const totalPrice = this.getSalePrice(shopData) * count
        if (Number(shopData?.currency) === 0) {
            const diamond = BagModel.getInstance().getItemCount(ShopList.DIAMOND_ITEM_ID)
            if (diamond < totalPrice) {
                EventSystem.send("ShowTips", "道具不足")
                return
            }
        }

        const itemId = Number(shopData?.item_id)
        if (!Number.isFinite(itemId) || itemId <= 0) {
            return
        }

        const json = new network.ShopBuyRequest()
        AppConst.WebSocketManager.send(json.toJSON(itemId, count))
        this.chooseCheckShopData = null
        this.chooseCheckShopId = 0
        this.chooseCheckShopNum = 1
        if (this.checkNode) {
            this.checkItemSprite.spriteFrame = null
            this.checkNode.active = false
        }
    }

    //增加购买数量
    onClickAddCount() {
        if (!this.chooseCheckShopData) {
            return
        }
        const maxCount = this.getMaxBuyCount(this.chooseCheckShopData)
        if (maxCount <= 0) {
            EventSystem.send("ShowTips", "已售罄")
            return
        }
        this.chooseCheckShopNum = Math.min(maxCount, Math.max(1, this.chooseCheckShopNum) + 1)
        this.refreshCheckNode()
    }

    // 减少购买数量
    onClickReduceCount() {
        if (!this.chooseCheckShopData) {
            return
        }
        this.chooseCheckShopNum = Math.max(1, this.chooseCheckShopNum - 1)
        this.refreshCheckNode()
    }

    onClickCloseCheck() {
        this.chooseCheckShopData = null
        this.chooseCheckShopId = 0
        this.chooseCheckShopNum = 1
        if (this.checkNode) {
            this.checkItemSprite.spriteFrame = null
            this.checkNode.active = false
        }
        this.checkSellNode.active = false
    }

    refreshShopList() {
        if(this.showType == 2){
            this.listComp.node.active = false
            this.listSellComp.node.active = true
            this.showSells = ShopModel.getInstance().getShopSellCrops()

            this.listSellComp.numberOfItems = () => this.showSells.length;
            if (!this.listSellComp.enabled) {
                this.listSellComp.enabled = true

                this.listSellComp.cellForItemAt = (indexPath, collectionView) => {
                    const data = this.showSells[indexPath.item]
                    const cell = collectionView.dequeueReusableCell(`cell`)
                    let listCell = cell.getComponent(ShopListCell) as ShopListCell
                    if (listCell && typeof listCell.setSellId === 'function') {
                        listCell.setSellId(data)
                    }
                    return cell
                }
                this.updateFlowLayout()
                this.receivedData()
            } else {
                this.listSellComp.reloadData()
            }            
        }else{
            this.listComp.node.active = true
            this.listSellComp.node.active = false

            this.showShops = ShopModel.getInstance().getShopList(this.showType)
            console.log("ShopList refreshShopList", this.showShops)

            if (this.checkNode?.active && this.chooseCheckShopData) {
                this.refreshCheckNode()
            }

            this.listComp.numberOfItems = () => this.showShops.length;
            if (!this.listComp.enabled) {
                this.listComp.enabled = true

                this.listComp.cellForItemAt = (indexPath, collectionView) => {
                    const data = this.showShops[indexPath.item]
                    const cell = collectionView.dequeueReusableCell(`cell`)
                    let listCell = cell.getComponent(ShopListCell) as ShopListCell
                    if (listCell && typeof listCell.setShopId === 'function') {
                        listCell.setShopId(data)
                    }
                    return cell
                }
                this.updateFlowLayout()
                this.receivedData()
            } else {
                this.listComp.reloadData()
            }
        }
    }

    updateFlowLayout(column: number = this.column) {
        let layout = new YXMasonryFlowLayout()
        layout.extraVisibleCount = 10
        layout.horizontalSpacing = -15
        layout.verticalSpacing = 20
        layout.divide = column
        layout.itemSize = () => {
            return new Size(0, 300)
        }
        this.listSellComp.layout = layout
        this.listComp.layout = layout
    }

    receivedData() {
        this.listComp.reloadData()
        this.listSellComp.reloadData()
    }

    private resolveShopData(shopData: any): any {
        const itemId = Number(shopData?.item_id)
        if (!Number.isFinite(itemId) || itemId <= 0) {
            return shopData
        }
        const latest = (this.showShops as any[]).find((s) => Number(s?.item_id) === itemId)
        return latest ?? shopData
    }

    private ensureCheckRefs() {
        if (!this.checkNode) {
            return
        }
        if (!this.checkItemName) {
            this.checkItemName = this.findCheckChild("checkItemName")?.getComponent(Label) ?? null
        }
        if (!this.checkItemSprite) {
            this.checkItemSprite = this.findCheckChild("checkItemSprite")?.getComponent(Sprite) ?? null
        }
        if (!this.checkNeedItemSprite) {
            this.checkNeedItemSprite = this.findCheckChild("checkNeedItemSprite")?.getComponent(Sprite) ?? null
        }
        if (!this.checkNeedItemCount) {
            this.checkNeedItemCount = this.findCheckChild("checkNeedItemCount")?.getComponent(Label) ?? null
        }
        if (!this.checkLimitCount) {
            this.checkLimitCount = this.findCheckChild("checkLimitCount")?.getComponent(Label) ?? null
        }
        if (!this.checkChooseCount) {
            this.checkChooseCount = this.findCheckChild("checkChooseCount")?.getComponent(Label) ?? null
        }
    }

    private findCheckChild(name: string): Node | null {
        if (!this.checkNode) {
            return null
        }
        const stack: Node[] = [this.checkNode]
        while (stack.length > 0) {
            const node = stack.pop()
            if (!node) {
                continue
            }
            if (node.name === name) {
                return node
            }
            for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push(node.children[i])
            }
        }
        return null
    }

    private resolveItemName(shopData: any, itemId: number): string {
        const directName = String(shopData?.item_name || "").trim()
        if (directName) {
            return directName
        }
        if (!Number.isFinite(itemId) || itemId <= 0) {
            return ""
        }
        const itemCfg = AppConst.JSONManager.getItem("item", `${itemId}`)
        if (!itemCfg) {
            return String(itemId)
        }
        const lang = AppConst.LanguageManager.language
        return String(itemCfg[`name_${lang}`] || itemCfg.name_cn || itemCfg.name_en || itemId)
    }

    private getCurrencyItemId(shopData: any): number {
        if (Number(shopData?.currency) === 0) {
            return ShopList.DIAMOND_ITEM_ID
        }
        const currency = Number(shopData?.currency)
        return Number.isFinite(currency) && currency > 0 ? currency : ShopList.DIAMOND_ITEM_ID
    }

    private getSalePrice(shopData: any): number {
        if (isNaN(shopData?.sale_price)) {
            const priceArr = String(shopData?.sale_price || "").split(";")
            const idx = Math.max(0, Number(shopData?.saleCount) || 0)
            const pick = idx < priceArr.length ? priceArr[idx] : priceArr[priceArr.length - 1]
            const v = Number(pick)
            return Number.isFinite(v) ? v : 0
        }
        // const v = Number(shopData?.sale_price)
        return shopData?.sale_price
    }

    private getMaxBuyCount(shopData: any): number {
        const limit = Number(shopData?.limit)
        let maxCount = 999
        if (limit >= 0) {
            if (limit === 0) {
                return 0
            }
            maxCount = limit
        } else {
            const personalLimit = Number(shopData?.personal_limit)
            if (Number.isFinite(personalLimit) && personalLimit > 0) {
                maxCount = personalLimit
            }
        }

        if (Number(shopData?.currency) === 0) {
            const unitPrice = this.getSalePrice(shopData)
            if (unitPrice > 0) {
                const diamond = BagModel.getInstance().getItemCount(ShopList.DIAMOND_ITEM_ID)
                maxCount = Math.min(maxCount, Math.floor(diamond / unitPrice))
            }
        }
        return Math.max(0, maxCount)
    }

    private refreshNeedItemColor(shopData: any, totalPrice: number) {
        if (!this.checkNeedItemCount) {
            return
        }
        if (Number(shopData?.currency) === 0) {
            const diamond = BagModel.getInstance().getItemCount(ShopList.DIAMOND_ITEM_ID)
            this.checkNeedItemCount.color = diamond >= totalPrice
                ? ShopList.MONEY_COLOR_DEFAULT
                : ShopList.MONEY_COLOR_NOT_ENOUGH
            return
        }
        this.checkNeedItemCount.color = ShopList.MONEY_COLOR_DEFAULT
    }

    private loadItemSprite(sprite: Sprite | null, itemId: number) {
        if (!sprite || !Number.isFinite(itemId) || itemId <= 0) {
            if (sprite) {
                sprite.spriteFrame = null
            }
            return
        }
        sprite.spriteFrame = null
        resources.load(`UITexture/itemIcon/${itemId}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (!err && sf && sprite?.isValid) {
                sprite.spriteFrame = sf
                return
            }
        })
    }
}
