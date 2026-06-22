import { _decorator, Component, Node, Prefab } from 'cc';
import InfiniteCell from 'db://assets/plugin/InfiniteList/InfiniteCell';
import { PrefabLoad } from '../../Utils/PrefabLoad';
import { AppConst } from '../../AppConst';
import { MapManager } from 'db://assets/bundles/mapEditor/src/MapManager';
const { ccclass, property } = _decorator;
@ccclass('GameBuildCell')
export class GameBuildCell extends Component implements InfiniteCell {
    public cellIdentifier: string;
    public dataIndex: number;

    @property(PrefabLoad)
    tileIconPrefab : PrefabLoad
    public tileId
    public tileType
    public data
    UpdateContent(data: any): void {
        this.data = data
        this.tileId = data["list"].id
        this.tileType = data["type"]
        this.tileIconPrefab.bundleName = data["bundle"]
        if(data["type"] == "Ground"){
            let cfg = AppConst.JSONManager.getItem("mapGround" , data["list"].id)
                    // prefab.url = MapManager.GetInstance().getTileImgURL(cfg["baseImg"]);
            this.tileIconPrefab.url = "ground/image/" + cfg["baseImg"] + "/spriteFrame";
        }
        if(data["type"] == "OutsideRenovation"){
                    let cfg = AppConst.JSONManager.getItem("mapOutsideRenovation" , data["list"].id)
                    this.tileIconPrefab.url = cfg["icon"]  + "/spriteFrame";
        }
        if(data["type"] == "Floor"){
            let cfg = AppConst.JSONManager.getItem("mapFloor" , data["list"].id)
                    this.tileIconPrefab.url = cfg["icon"]  + "/spriteFrame";
        }
        if(data["type"] == "Decor" || data["type"] == "DecorOrnament" || data["type"] == "Appliance"){
            let cfg = AppConst.JSONManager.getItem("mapDecor" , data["list"].id)
            this.tileIconPrefab.url = cfg["icon"]  + "/spriteFrame";
        }
        if(data["type"] == "WallDacoration"){
            let cfg = AppConst.JSONManager.getItem("mapWallDecor" , data["list"].id)
            this.tileIconPrefab.url = cfg["icon"]  + "/spriteFrame";
        }
        if(data["type"] == "Fram"){
            let cfg = AppConst.JSONManager.getItem("mapEdit" , data["list"].id)
            this.tileIconPrefab.url = cfg["resource"] + "/spriteFrame";
        }
    }
    
    start() {

    }

    onClick(){
        // MapManager.GetInstance().getMapEditor().tileMaskNode.active = true;
        EventSystem.send("BuildCellOnClick")
        if(this.tileType == "Ground"){
            EventSystem.send("OnClickTileGroundIcon" , this.tileId)
        }else if(this.tileType == "Floor"){
            EventSystem.send("OnClickFloorIcon" , {id : this.tileId , tileType : this.tileType})
        }else{
            EventSystem.send("OnClickTileOhterIcon" , {id : this.tileId , tileType : this.tileType})
        }
    }    
}

