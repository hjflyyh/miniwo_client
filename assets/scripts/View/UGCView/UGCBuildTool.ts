import { _decorator, Component, instantiate, Node, tween, Vec3 } from 'cc';
import { MapManager } from 'db://assets/bundles/mapEditor/src/MapManager';
import { AppConst } from '../../AppConst';
import { UGCBuildTabCell } from './UGCBuildTabCell';
import { UGCBuildTypeCell } from './UGCBuildTypeCell';
// import { GroundDataSource } from 'db://assets/bundles/mapEditor/src/UI/GroundDataSource';
import { InfiniteList } from 'db://assets/plugin/InfiniteList/InfiniteList';
import { UGCGroundDataSource } from './UGCGroundDataSource';
const { ccclass, property } = _decorator;

@ccclass('UGCBuildToole')
export class UGCBuildToole extends Component {
    //最外层tab页
    @property(Node)
    ugcTypeCell : Node
    ugcTypeNodes : Node[] = []
    chooseTypeIndex = -1
    ugcTypeAry = []


    //第二层tab页
    @property(Node)
    ugcTabCell : Node
    ugcTabNodes : Node[] = []
    chooseTabIndex = -1
    ugcTabAry = []

    @property(InfiniteList)
    showGround : InfiniteList

    dataSource : UGCGroundDataSource

    start() {
        this.dataSource = this.showGround.node.getComponent("UGCGroundDataSource") as UGCGroundDataSource
        this.showGround.Init(this.dataSource)

        this.ugcTypeCell.active = false
        this.ugcTabCell.active = false
        this.refreshType()

        EventSystem.addListent("MapEditorPlacedItemTouched" , this.MapEditorPlacedItemTouched , this)
    }

    refreshPos(){
        if(this.chooseTypeIndex < 0){
                    tween(this.node)
                        .to(0.1, { position: new Vec3(0, 0, 0) })
                        .start();
            // this.node.setPosition(new Vec3(0 , 0 , 0))
            return
        }
        if(this.chooseTabIndex < 0){
                    tween(this.node)
                        .to(0.1, { position: new Vec3(0, 90, 0) })
                        .start();            
            // this.node.setPosition(new Vec3(0 , 90 , 0))
            return
        }        
        if(this.chooseTypeIndex >= 0){
            tween(this.node)
                        .to(0.1, { position: new Vec3(0, 375, 0) })
                        .start();            
            // this.node.setPosition(new Vec3(0 , 90 , 0))
            return
        }
    }

    MapEditorPlacedItemTouched(){
        this.onClickType(-1, true);
    }
    
    onClickTab(index){
        MapManager.GetInstance().getMapEditorUI()?.clearPlacedItemSelection();
        if(this.chooseTabIndex == index){
            this.chooseTabIndex = -1
        }else{
            this.chooseTabIndex = index
        }
        this.refreshType()
    }

    onClickType(index, fromItemTouch = false){
        if (!fromItemTouch) {
            MapManager.GetInstance().getMapEditorUI()?.clearPlacedItemSelection();
        }
        if(index == -1){
            this.chooseTypeIndex = -1
            this.chooseTabIndex = -1            
        }else if(this.chooseTypeIndex == index){
            this.chooseTypeIndex = -1
            this.chooseTabIndex = -1
        }else{
            this.chooseTypeIndex = index
            if(this.chooseTabIndex >= 0){
                this.chooseTabIndex = 0
            }
        }
        this.refreshType()
    }

    //tab页刷新
    refreshType(){
        let ugcTabAll = AppConst.JSONManager.getItemAll("ugcType")
        if(this.ugcTypeAry.length == 0){
            for(let u in ugcTabAll){
                if(ugcTabAll[u]["is_show"] == 1){
                    let tab = ugcTabAll[u]
                    tab.id = u
                    this.ugcTypeAry.push(tab)
                }
            }
        }
        if(this.ugcTypeAry.length > this.ugcTypeNodes.length){
            let num = this.ugcTypeAry.length - this.ugcTypeNodes.length
            for(let i = 0 ;  i < num ; i++){
                let newNode = instantiate(this.ugcTypeCell)
                newNode.active = true
                newNode.parent = this.ugcTypeCell.parent
                this.ugcTypeNodes.push(newNode)
            }
        }
        for(let u = 0 ; u < this.ugcTypeNodes.length ; u++){
            let cell = this.ugcTypeNodes[u].getComponent("UGCBuildTabCell") as UGCBuildTabCell
            cell.refreshNode(this.ugcTypeAry[u] , u , this)
        }

        if(this.ugcTypeAry[this.chooseTypeIndex] && this.ugcTypeAry[this.chooseTypeIndex]["Inside_and_outside"] == 0){
            EventSystem.send("focusCameraForBuildEntry")
            EventSystem.send("OnBuildFurniture")
        }
        if(this.chooseTabIndex < 0 || this.chooseTypeIndex < 0){
            EventSystem.send("OnBackChooseType")
        }
        this.refreshBuildType();
        this.refreshPos();
    }

    refreshBuildScroll(){
        if(this.chooseTabIndex < 0){
            return
        }
        this.dataSource.tabCfg = this.ugcTabAry[this.chooseTabIndex]
        this.showGround.Reload()
    }

    refreshBuildType(){
        if(this.chooseTypeIndex < 0){
            return
        }
        this.ugcTabAry = []
        let typeCfg = this.ugcTypeAry[this.chooseTypeIndex]
        let tabCfgAll = AppConst.JSONManager.getItemAll("ugcTab")
        for(let t in  tabCfgAll){
            if(tabCfgAll[t]["ugc_type_id"] == typeCfg["id"] && tabCfgAll[t]["is_show"] == 1){
                let cfg = tabCfgAll[t]
                cfg["id"] = t
                this.ugcTabAry.push(cfg)
            }
        }
        if(this.ugcTabAry.length > this.ugcTabNodes.length){
            let num = this.ugcTabAry.length - this.ugcTabNodes.length
            for(let i = 0 ;  i < num ; i++){
                let newNode = instantiate(this.ugcTabCell)
                newNode.active = true
                newNode.parent = this.ugcTabCell.parent
                this.ugcTabNodes.push(newNode)
            }
        }
        for(let i = 0 ; i < this.ugcTabNodes.length ; i++){
            if(this.ugcTabAry[i] == null){
                this.ugcTabNodes[i].active = false
            }else{
                this.ugcTabNodes[i].active = true
                let cell = this.ugcTabNodes[i].getComponent("UGCBuildTypeCell") as UGCBuildTypeCell
                cell.refreshNode(this.ugcTabAry[i] , i , this)
            }
        }
        this.refreshBuildScroll();
    }
}

