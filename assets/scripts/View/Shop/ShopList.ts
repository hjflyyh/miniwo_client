import { _decorator, Component, instantiate, math, Node, Size } from 'cc';
import { YXCollectionView } from '../../../plugin/list-3x/yx-collection-view';
import { CardModel } from '../../Model/CardModel';
import { CustomGridFlowLayout } from '../../../plugin/list-3x/custom-grid-flow-layout';
import { HttpManager } from '../../Manager/HttpManager';
import { RoleModel } from '../../Model/RoleModel';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
import { ShopListCell } from './ShopListCell';
import { ShopModel } from '../../Model/ShopModel';
import { network } from '../../Model/RequestData';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('ShopList')
export class ShopList extends Component {
    /**
     * 列表组件
     */
    @property(YXCollectionView)
    listComp: YXCollectionView = null

    showShops = []

    private column = 3

    start() {
        this.dossss()
        EventSystem.addListent("ShopDataUpdated", this.refreshShopList, this)
        let json = new network.ShopDataRequest();
        AppConst.WebSocketManager.send(json.toJSON());
        this.scheduleOnce(() => {
            this.refreshShopList();
        }, 0.1)
    }

    async dossss() {
        const token = RoleModel.getInstance().token;
        const res = await fetch(`${HttpManager.baseUrl}/getMyNPCs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
        const json = await res.json();
        console.log("npc:", json)
    }

    onDestroy() {
        EventSystem.remove(this)
    }

    refreshShopList() {
        this.showShops = ShopModel.getInstance().getShopList()
        console.log("ShopList refreshShopList", this.showShops)

        this.listComp.numberOfItems = () => this.showShops.length;
        if (!this.listComp.enabled) {
            this.listComp.enabled = true

            this.listComp.cellForItemAt = (indexPath, collectionView) => {
                // 通过下标可以获取到对应的数据
                const data = this.showShops[indexPath.item]

                // 通过标识符获取重用池内的节点
                const cell = collectionView.dequeueReusableCell(`cell`)
                let listCell = cell.getComponent("ShopListCell") as ShopListCell
                listCell.setShopId(data)

                return cell // 返回这个节点给列表显示
            }
            this.updateFlowLayout()
            this.receivedData()
        } else {
            this.listComp.reloadData()
        }

    }

    updateFlowLayout(column: number = this.column) {
        let layout = new YXMasonryFlowLayout()
        layout.extraVisibleCount = 10
        layout.horizontalSpacing = -15
        layout.verticalSpacing = 20
        layout.divide = column
        layout.itemSize = (indexPath) => {
            return new Size(0, 360)
        }
        this.listComp.layout = layout
    }

    receivedData() {
        // 更新列表
        this.listComp.reloadData()
    }
}