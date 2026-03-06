import { _decorator, Component, Node, randomRangeInt, Size } from 'cc';
import { YXCollectionView } from '../../../../plugin/list-3x/yx-collection-view';
import { YXMasonryFlowLayout } from '../../../../plugin/list-3x/yx-masonry-flow-layout';
import { MainCharacterListCell } from './MainCharacterListCell';

const { ccclass, property } = _decorator;

class Data {
    static ID: number = 0
    id: number = Data.ID++
    height: number = randomRangeInt(400, 500)
}

@ccclass('MainCharacterList')
export class MainCharacterList extends Component {
    /**
     * 列表组件
     */
    @property(YXCollectionView)
    listComp: YXCollectionView = null
    /**
     * 测试数据源
     */
    testData: Data[] = []

    private column = 2
    start() {
        this.scheduleOnce(()=>{
            this.listComp.enabled = true
            this.listComp.numberOfItems = () => this.testData.length;

            this.listComp.cellForItemAt = (indexPath, collectionView) => {
                // 通过下标可以获取到对应的数据
                const data = this.testData[indexPath.item]
    
                // 通过标识符获取重用池内的节点
                const cell = collectionView.dequeueReusableCell(`cell`)
    
                // 更新数据显示
                const comp = cell.getComponent(MainCharacterListCell)
                comp.refreshData(data)
    
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
        layout.horizontalSpacing = -15
        layout.verticalSpacing = 20
        layout.divide = column
        layout.itemSize = (indexPath) => {
            // 通过下标可以获取到对应的数据
            const data = this.testData[indexPath.item]
            return new Size(0, data.height)
        }
        this.listComp.layout = layout
    }

    /**
     * 模拟收到数据
     */
    receivedData() {
        this.testData = []
        for (let index = 0; index < 10000; index++) {
            this.testData.push(new Data())
        }

        // 更新列表
        this.listComp.reloadData()
    }

    OnClickChat(){
        EventSystem.send("OnGotoChat")
    }
}


