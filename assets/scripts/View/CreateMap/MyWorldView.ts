import { _decorator, Component, Node, Size } from 'cc';
import { YXCollectionView } from 'db://assets/plugin/list-3x/yx-collection-view';
import { AppConst } from '../../AppConst';
import { RoleModel } from '../../Model/RoleModel';
import { YXMasonryFlowLayout } from 'db://assets/plugin/list-3x/yx-masonry-flow-layout';
import { MyWorldListCell } from './MyWorldListCell';
import { UGCModel } from '../../Model/UGCModel';
const { ccclass, property } = _decorator;

@ccclass('MyWorldView')
export class MyWorldView extends Component {
    /**
     * 列表组件
     */
    @property(YXCollectionView)
    mapList: YXCollectionView = null

    @property([Node])
    public chooseTabs: Node[] = []

    @property([Node])
    public unChooseTabs: Node[] = []

    @property([Node])
    public chooseNodes: Node[] = []

    private showTabIndex = 0;
    private mapListData = []
    private showMapListData = []

    start() {
        EventSystem.addListent("HttpMessage" , this.OnHttpMessage , this)

        this.scheduleOnce(() => {
            AppConst.HttpManager.sendPostHttp("getUserMapsSummary", JSON.stringify({
                token: RoleModel.getInstance().token, 
                page: 1,
                limit: 1000
            }));

            this.mapList.enabled = true
            this.mapList.numberOfItems = () => {
                if(this.showTabIndex == 0){
                    this.showMapListData = this.mapListData
                }else if(this.showTabIndex == 1){  
                    this.showMapListData = []
                    for(let i = 0 ; i < this.mapListData.length ; i++){
                        if(this.mapListData[i].map_state == 0){
                            this.showMapListData.push(this.mapListData[i])
                        }
                    }
                } else if(this.showTabIndex == 2){  
                    this.showMapListData = []
                    for(let i = 0 ; i < this.mapListData.length ; i++){
                        if(this.mapListData[i].map_state == 2){
                            this.showMapListData.push(this.mapListData[i])
                        }
                    }
                }                 
                return this.showMapListData.length
            };

            this.mapList.cellForItemAt = (indexPath, collectionView) => {
                // 通过下标可以获取到对应的数据
                const data = this.showMapListData[indexPath.item]
    
                // 通过标识符获取重用池内的节点
                const cell = collectionView.dequeueReusableCell(`cell`)
    
                // 更新数据显示
                const comp = cell.getComponent("MyWorldListCell") as MyWorldListCell
                comp.refreshByData(data)
    
                return cell // 返回这个节点给列表显示
            }
    
            // 配置 layout 布局规则
            this.updateFlowLayout()
    
            // 模拟获取数据
            this.receivedData()
        }, 0.1)        
        this.setTabShow();
    }

    OnClickAdd(){
        UGCModel.getInstance().resetMapData();
        AppConst.PanelManager.openView("res/View/CreateMap/CreateView")
    }

    OnClickTab(event, customData){
        this.showTabIndex = parseInt(customData)
        this.setTabShow();
    }

    OnHttpMessage(data) {
        if(data.functionName == "getUserMapsSummary"){
            this.mapListData = data.list
            this.receivedData()
        }
        if(data.functionName == "deleteDraftMap"){
            let mapId = data.map_id
            for(let i = 0 ; i < this.mapListData.length ; i++){
                if(this.mapListData[i].map_id == mapId){
                    this.mapListData.splice(i, 1)
                    break
                }
            }
            this.receivedData()   
        }
    }

    receivedData() {
        // 更新列表
        this.mapList.reloadData()
    }

    private column = 2
    updateFlowLayout(column: number = this.column) {
        let layout = new YXMasonryFlowLayout()
        layout.extraVisibleCount = 10
        layout.horizontalSpacing = -15
        layout.verticalSpacing = 20
        layout.divide = column
        layout.itemSize = (indexPath) => {
            
            return new Size(349, 600)
        }
        this.mapList.layout = layout
    }

    setTabShow(){
        for(let i = 0 ; i < this.chooseTabs.length ; i++){
            this.chooseTabs[i].active = i == this.showTabIndex
            this.chooseNodes[i].active = i == this.showTabIndex
            this.unChooseTabs[i].active = i != this.showTabIndex
        }
        this.mapList.reloadData()
    }
}

