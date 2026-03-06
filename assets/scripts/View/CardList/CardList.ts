import { _decorator, Component, instantiate, math, Node, Size } from 'cc';
import { YXCollectionView } from '../../../plugin/list-3x/yx-collection-view';
import { CardModel } from '../../Model/CardModel';
import { CustomGridFlowLayout } from '../../../plugin/list-3x/custom-grid-flow-layout';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
import { CardListCell } from './CardListCell';
const { ccclass, property } = _decorator;

@ccclass('CardList')
export class CardList extends Component {
    /**
     * 列表组件
     */
    @property(YXCollectionView)
    listComp: YXCollectionView = null

    @property(Node)
    worldRender : Node

    worldMap = {}

    chooseWorldId = null

    showCards = []

    private column = 3
    
    start() {
        this.worldRender.active = false
        this.scheduleOnce(()=>{
            this.refreshCardList();
        })
        this.refreshWorld()

        // EventSystem.send("OnSetNowShowPanel" , this.node["__url"])
    }

    OnChangeWorld(worldId){
        this.chooseWorldId = worldId
        this.refreshCardList();
    }

    refreshCardList(){
        if(this.chooseWorldId != null){
            this.showCards = CardModel.getInstance().maps[this.chooseWorldId]
    
            this.listComp.numberOfItems = () => this.showCards.length;
            if(!this.listComp.enabled){
                this.listComp.enabled = true
    
                this.listComp.cellForItemAt = (indexPath, collectionView) => {
                    // 通过下标可以获取到对应的数据
                    const data = this.showCards[indexPath.item]
    
                    // 通过标识符获取重用池内的节点
                    const cell = collectionView.dequeueReusableCell(`cell`)
                    let listCell = cell.getComponent("CardListCell") as CardListCell
                    listCell.setCardId(data)

                    return cell // 返回这个节点给列表显示
                }
                this.updateFlowLayout()
            }
            
            this.receivedData()
        }
    }

    updateFlowLayout(column: number = this.column) {
        let layout = new YXMasonryFlowLayout()
        layout.extraVisibleCount = 10
        layout.horizontalSpacing = -15
        layout.verticalSpacing = 20
        layout.divide = column
        layout.itemSize = (indexPath) => {
            return new Size(0, 500)
        }
        this.listComp.layout = layout
    }

    receivedData() {
        // 更新列表
        this.listComp.reloadData()
    }
    
    refreshWorld(){
        for(let mapId in CardModel.getInstance().maps){
            if(!this.worldMap[mapId]){
                if(!this.chooseWorldId){
                    this.chooseWorldId = mapId
                }
                let newRender = instantiate(this.worldRender)
                newRender.setParent(this.worldRender.parent)

                newRender.active = true

                let WorldRenderCell = newRender.getComponent("WorldRenderCell") as WorldRenderCell
                WorldRenderCell.setMapId(mapId)
            }
        }
    }
}


