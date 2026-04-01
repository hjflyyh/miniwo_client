import { _decorator, Component, Node, Size, Sprite, Texture2D } from 'cc';
import { YXCollectionView } from '../../../plugin/list-3x/yx-collection-view';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
import { AppConst } from '../../AppConst';
import { FollowImgCell } from './FollowImgCell';
const { ccclass, property } = _decorator;

@ccclass('FollowImgChoose')
export class FollowImgChoose extends Component {
    private column = 3

    /**
     * 列表组件
     */
    @property(YXCollectionView)
    listComp: YXCollectionView = null

    //[{id: , type : , others : [id: , x: , y: , rotationZ: ,]}]
    public openData = []
    start() {
        if(this.node["_openParam"] != null){
            this.openData = this.node["_openParam"]
        }
        this.scheduleOnce(()=>{
            this.listComp.enabled = true
            this.listComp.numberOfItems = () => {
                return AppConst.JournalManager.journalImgs.length
            };

            this.listComp.cellForItemAt = (indexPath, collectionView) => {
                // 通过下标可以获取到对应的数据
                const data = AppConst.JournalManager.journalImgs[indexPath.item]
    
                // 通过标识符获取重用池内的节点
                const cell = collectionView.dequeueReusableCell(`cell`)
    
                // 更新数据显示
                const comp = cell.getComponent(FollowImgCell)
                comp.refreshData({
                    data : data,
                    view : this,
                })
    
                return cell // 返回这个节点给列表显示
            }
    
            // 配置 layout 布局规则
            this.updateFlowLayout()
    
            // 模拟获取数据
            this.receivedData()
        } ,0.1)
    }

    updateFlowLayout(column: number = this.column) {
        let layout = new YXMasonryFlowLayout()
        layout.extraVisibleCount = 10
        layout.horizontalSpacing = 0
        layout.verticalSpacing = 20
        layout.divide = column
        layout.itemSize = (indexPath) => {
            return new Size(0, 300)
        }
        this.listComp.layout = layout
    }


    receivedData() {
        // 更新列表
        this.listComp.reloadData()
    }
    
    clickCell(cellData){
        let oldIndex = -1;
        for(let i =0 ; i < this.openData.length ; i++){
            if(this.openData[i].id == cellData["id"] && this.openData[i].type == cellData["type"]){
                oldIndex = i
            }
        }
        if(oldIndex >= 0){
            this.openData.splice(oldIndex , 1)
        }else{
            this.openData.push({
                id : cellData["id"],
                type : cellData["type"],
                others : []
            })
        }

        EventSystem.send("OnFollowChooseImgCell")
    }

    onClickNext(){
        EventSystem.send("OnRefreshFollowImgChoose" , this.openData)
        AppConst.PanelManager.CloseView(this)
    }
}


