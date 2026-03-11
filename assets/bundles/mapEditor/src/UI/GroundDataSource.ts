import { _decorator, CCInteger, Component, Node, Prefab } from 'cc';
import { MapEditorUIConfig } from '../../../../src/common/MapEditorUIConfig';
import { Utils } from '../../../../scripts/Utils/Utils';
import InfiniteCell from '../../../../plugin/InfiniteList/InfiniteCell';
import { IFDataSource } from '../../../../plugin/InfiniteList/InfiniteList';
import { TileIconLayout } from './TileIconLayout';
import { AppConst } from '../../../../scripts/AppConst';
import { MapModel } from '../../../../scripts/Model/MapModel';

const { ccclass, property } = _decorator;

@ccclass('GroundDataSource')
export class GroundDataSource extends Component implements IFDataSource {
    @property(Prefab)
    cellPrefab : Prefab

    @property(CCInteger)
    tileType : number = 0

    isInitData = false
    
    list = []
    onLoad(){

    }

    start() {

    }

    update(deltaTime: number) {
        
    }

    GetCellNumber(): number {
        this.list = []
        let cfg_name = ""
        if(this.tileType == 0){
            cfg_name = "mapGround"
        }else if(this.tileType == 1){
            cfg_name = "mapFloor"
        }else if(this.tileType == 3){
            cfg_name = "mapOutsideRenovation"
        }else if(this.tileType == 4){
            cfg_name = "mapDecor"
        }else if(this.tileType == 12){
            cfg_name = "mapWallDecor"
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
    GetCellView(dataIndex: number, identifier?: string): TileIconLayout {
        let node = Utils.instantiate(this.cellPrefab);
        return node.getComponent("TileIconLayout");
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
        }
        // return {dataIndex : dataIndex , bundle : "mapEditor" , list : this.list , type : "Ground"}
    }
}


