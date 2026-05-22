import { _decorator, Component, instantiate, math, Node, Size } from 'cc';
import { YXCollectionView } from '../../../plugin/list-3x/yx-collection-view';
import { CardModel } from '../../Model/CardModel';
import { CustomGridFlowLayout } from '../../../plugin/list-3x/custom-grid-flow-layout';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
import { AppConst } from '../../AppConst';
import { BagModel } from '../../Model/BagModel';
import { BagListCell } from './BagListCell';
const { ccclass, property } = _decorator;

@ccclass('BagList')
export class BagList extends Component {
    /**
     * 列表组件
     */
    @property(YXCollectionView)
    listComp: YXCollectionView = null

    showBags = []

    private column = 5

    start() {
        this.scheduleOnce(() => {
            this.refreshBagList();
        })
    }

    refreshBagList() {
        const slots = BagModel.getInstance().slots || []
        this.showBags = slots.filter((slot: any) => {
            const itemId = slot?.item_id
            if (!itemId) {
                return false
            }
            const itemCfg = AppConst.JSONManager.getItem("item", `${itemId}`)
            if (!itemCfg) {
                return false
            }
            return `${itemCfg.is_displayed_in_backpack}` === "0"
        })
        console.log("BagList refreshBagList" , this.showBags)

        this.listComp.numberOfItems = () => this.showBags.length;
        if (!this.listComp.enabled) {
            this.listComp.enabled = true

            this.listComp.cellForItemAt = (indexPath, collectionView) => {
                // 通过下标可以获取到对应的数据
                const data = this.showBags[indexPath.item]

                // 通过标识符获取重用池内的节点
                const cell = collectionView.dequeueReusableCell(`cell`)
                let listCell = cell.getComponent("BagListCell") as BagListCell
                listCell.setBagId(data)

                return cell // 返回这个节点给列表显示
            }
            this.updateFlowLayout()
        }

        this.receivedData()
    }

    updateFlowLayout(column: number = this.column) {
        let layout = new YXMasonryFlowLayout()
        layout.extraVisibleCount = 10
        layout.horizontalSpacing = -15
        layout.verticalSpacing = 0
        layout.divide = column
        layout.itemSize = (indexPath) => {
            return new Size(0, 140)
        }
        this.listComp.layout = layout
    }

    receivedData() {
        // 更新列表
        this.listComp.reloadData()
    }
}