import { _decorator, Component, Node , Prefab} from 'cc';
import { IFDataSource, InfiniteList } from 'db://assets/plugin/InfiniteList/InfiniteList';
import { GameBuildCell } from './GameBuildCell';
import { Utils } from '../../Utils/Utils';
import { MapModel } from '../../Model/MapModel';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('GameBuildScroll')
export class GameBuildScroll extends Component implements IFDataSource {
    tileType : number = 0

    @property(Prefab)
    cellPrefab : Prefab

    infiniteList :InfiniteList

    list = []

    start() {
    }

    public setTileType(type: number){
        if(this.infiniteList == null){
            this.tileType = type
            this.infiniteList = this.getComponent("InfiniteList") as InfiniteList
            this.infiniteList.Init(this)
        }else{

            this.tileType = type
            this.infiniteList.Reload()
        }
    }

    GetCellNumber(): number {
        let funcTyppe = {4:0 , 13:1 , 14:2}
        this.list = []
        let cfg_name = ""
        if(this.tileType == 0){
            cfg_name = "mapGround"
        }else if(this.tileType == 1){
            cfg_name = "mapFloor"
        }else if(this.tileType == 3){
            cfg_name = "mapOutsideRenovation"
        }else if(this.tileType == 4 || this.tileType == 13 || this.tileType == 14){
            cfg_name = "mapDecor"
        }else if(this.tileType == 12){
            cfg_name = "mapWallDecor"
        }else if(this.tileType == 15){
            cfg_name = "mapEdit"
        }

        let mapTag = MapModel.getInstance().EditMapTag
        let mapGroundAll = AppConst.JSONManager.getItemAll(cfg_name)
        for(let m in mapGroundAll){
            let tags = mapGroundAll[m].tags
            let isAdd = !tags || tags == ""
            if(!isAdd && tags != ""){
                const tagAry: string[] = tags.split("#");
                for(let t = 0 ; t < tagAry.length ; t++){
                    if(parseInt(tagAry[t]) == mapTag){
                        isAdd = true
                    }
                }
            }
            if(isAdd){
                if(funcTyppe[this.tileType] != null){
                    //配置表的type字段要和funcTyppe匹配
                    if(parseInt(mapGroundAll[m].type) == funcTyppe[this.tileType]){
                        this.list.push({
                            id : m
                        })
                    }
                }else{
                    this.list.push({
                        id : m
                    })
                }
            }
        }
        return this.list.length        
    }

    GetCellIdentifer(dataIndex: number): string {
        return ""
    }
    GetCellSize(dataIndex: number): number {
        return 143
    }
    GetCellView(dataIndex: number, identifier?: string) : GameBuildCell {
        let node = Utils.instantiate(this.cellPrefab);
        return node.getComponent("GameBuildCell");
    }

    GetCellData(dataIndex: number) {
        if(this.tileType == 0){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list[dataIndex] , type : "Ground"}
        }else if(this.tileType == 1){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list[dataIndex] , type : "Floor"}
        }else if(this.tileType == 3){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list[dataIndex] , type : "OutsideRenovation"}
        }else if(this.tileType == 4){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list[dataIndex] , type : "Decor"}
        }else if(this.tileType == 12){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list[dataIndex] , type : "WallDacoration"}
        }else if(this.tileType == 13){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list[dataIndex] , type : "DecorOrnament"}
        }else if(this.tileType == 14){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list[dataIndex] , type : "Appliance"}
        }else if(this.tileType == 15){
            return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list[dataIndex] , type : "Fram"}
        }
    }    
}

