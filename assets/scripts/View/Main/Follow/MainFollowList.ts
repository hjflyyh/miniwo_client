import { _decorator, Component, math, Node } from 'cc';
import { YXCollectionView } from '../../../../plugin/list-3x/yx-collection-view';
import { CustomGridFlowLayout } from '../../../../plugin/list-3x/custom-grid-flow-layout';
import { AppConst } from '../../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('MainFollowList')
export class MainFollowList extends Component {
    /**
     * 列表组件
     */
    @property(YXCollectionView)
    listComp: YXCollectionView = null

    @property(Node)
    addBtn : Node = null

    @property(Node)
    editBtn : Node = null

    @property(Node)
    oldBtn : Node = null

    isOpenEdit = false

    /**
     * 测试数据源
     */
    testData = []

    /**
     * 模拟收到数据
     */
    receivedData() {
        this.testData = []
        for (let index = 0; index < 17; index++) {
            this.testData.push(index)
        }

        // 更新列表
        this.listComp.reloadData()
    }

    private column = 1
    private alignment = 1
        
    start() {
        this.scheduleOnce(()=>{
            this.listComp.enabled = true
            // 确定列表内一共需要显示多少条内容   
            this.listComp.numberOfItems = () => this.testData.length;

            this.listComp.cellForItemAt = (indexPath, collectionView) => {
                // 通过下标可以获取到对应的数据
                const data = this.testData[indexPath.item]

                // 通过标识符获取重用池内的节点
                const cell = collectionView.dequeueReusableCell(`cell`)

                // 更新数据显示
                // const comp = cell.getComponent(CommonCell)
                // comp.label.string = `${indexPath}`
                // comp.randomIcon()
                // comp.randomShapeColor()
                // comp.randomStar()
                // comp.randomLevelSign()

                return cell // 返回这个节点给列表显示
            }

            // 配置 layout 布局规则
            this.updateFlowLayout()

            // 模拟获取数据
            this.receivedData()
        } , 0.1)

        this.setBtns()
    }
  
    setBtns(){
        this.editBtn.active = this.isOpenEdit
        this.oldBtn.active = this.isOpenEdit
    }

    onClickAddBtn(){
        if(this.isOpenEdit){
            this.isOpenEdit = false
        }else{
            this.isOpenEdit = true
        }
        this.setBtns()
    }

    onClickEditBtn(){
        AppConst.PanelManager.openView("res/View/Follow/FollowEditView")
    }

    updateFlowLayout(column: number = this.column, alignment: number = this.alignment) {
        let layout = new CustomGridFlowLayout()
        layout.horizontalSpacing = 10
        layout.verticalSpacing = 10
        layout.alignment = alignment
        
        layout.itemSize = new math.Size(1000, 1008)
        this.listComp.layout = layout
    }    
}


