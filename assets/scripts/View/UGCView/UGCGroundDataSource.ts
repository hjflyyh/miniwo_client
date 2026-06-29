
import { _decorator, CCInteger, Component, Node, Prefab } from 'cc';
import { AppConst } from '../../AppConst';
import { Utils } from '../../Utils/Utils';
import { UGCTileIconLayout } from './UGCTileIconLayout';

const { ccclass, property } = _decorator;

@ccclass('UGCGroundDataSource')
export class UGCGroundDataSource extends Component {
    @property(Prefab)
    cellPrefab : Prefab

    // @property(CCInteger)
    tileType : number = 0

    isInitData = false
    
    list = []

    tabCfg

    onLoad(){

    }

    start() {

    }

    update(deltaTime: number) {
        
    }

    GetCellNumber(): number {
        // let funcTyppe = {4:0 , 13:1 , 14:2}
        this.list = []
        if(this.tabCfg == null || !this.tabCfg){
            this.list = []
            return
        }
        let cfg_name = this.tabCfg["need_cfg"]

        // if(this.tileType == 0){
        //     cfg_name = "mapGround"
        // }else if(this.tileType == 1){
        //     cfg_name = "mapFloor"
        // }else if(this.tileType == 3){
        //     cfg_name = "mapOutsideRenovation"
        // }else if(this.tileType == 4 || this.tileType == 13 || this.tileType == 14){
        //     cfg_name = "mapDecor"
        // }else if(this.tileType == 12){
        //     cfg_name = "mapWallDecor"
        // }else if(this.tileType == 15){
        //     cfg_name = "mapEdit"
        // }
        if(cfg_name == "mapOutsideRenovation"){
            this.tileType = 3;
        }
        if(cfg_name == "mapDecor"){
            this.tileType = 4;
        }
        
        // let mapTag = MapModel.getInstance().EditMapTag
        let mapGroundAll = AppConst.JSONManager.getItemAll(cfg_name)
        for(let m in mapGroundAll){
            // let tags = mapGroundAll[m].tags
            // let isAdd = !tags || tags == ""
            // if(!isAdd && tags != ""){
            //     const tagAry: string[] = tags.split("#");
            //     for(let t = 0 ; t < tagAry.length ; t++){
            //         if(parseInt(tagAry[t]) == mapTag){
            //             isAdd = true
            //         }
            //     }
            // }
            // if(isAdd){
            //     if(funcTyppe[this.tileType] != null){
            //         //配置表的type字段要和funcTyppe匹配
            //         if(parseInt(mapGroundAll[m].type) == funcTyppe[this.tileType]){
            //             this.list.push({
            //                 id : m
            //             })
            //         }
            //     }else{
            //         this.list.push({
            //             id : m
            //         })
            //     }
            // }
            if(mapGroundAll[m]["ugc_Tab_id"] == this.tabCfg["id"]){
                    this.list.push({
                        id : m
                    })
            }
        }
        return this.list.length
    }

    GetCellIdentifer(dataIndex: number): string {
        return ""
    }
    GetCellSize(dataIndex: number): number {
        return 140
    }
    GetCellView(dataIndex: number, identifier?: string): UGCTileIconLayout {
        let node = Utils.instantiate(this.cellPrefab);
        return node.getComponent("UGCTileIconLayout");
    }
    GetCellData(dataIndex: number) {
        if(this.tileType == 0){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list , type : "Ground"}
        }else if(this.tileType == 1){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list , type : "Floor"}
        }else if(this.tileType == 3){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list , type : "OutsideRenovation"}
        }else if(this.tileType == 4){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list , type : "Decor"}
        }else if(this.tileType == 12){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list , type : "WallDacoration"}
        }else if(this.tileType == 13){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list , type : "DecorOrnament"}
        }else if(this.tileType == 14){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list , type : "Appliance"}
        }else if(this.tileType == 15){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list , type : "Fram"}
        }


        return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list , type : "Ground"}
    }
}

