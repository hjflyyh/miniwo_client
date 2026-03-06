import { _decorator, Component, Node } from 'cc';
import InfiniteCell from '../../../../plugin/InfiniteList/InfiniteCell';
import { MapEditorUIConfig } from '../../../../src/common/MapEditorUIConfig';
import { PrefabLoad } from '../../../../scripts/Utils/PrefabLoad';
import { MapManager } from '../MapManager';
import { tileIcon } from './tileIcon';
import { AppConst } from '../../../../scripts/AppConst';
const { ccclass, property } = _decorator;

@ccclass('TileIconLayout')
export class TileIconLayout extends Component implements InfiniteCell {
    public cellIdentifier: string;
    public dataIndex: number;

    @property([Node])
    tileIcon : Node[] = []

    start() {

    }

    UpdateContent(data: any): void {
        let startIndex = data["dataIndex"] * 4
        for(let s = 0 ; s < 4 ; s++){
            if(data["list"][startIndex + s]){
                this.tileIcon[s].active = true
                const prefab = this.tileIcon[s].getChildByName('icon').getComponent("PrefabLoad") as PrefabLoad;

                prefab.bundleName = data["bundle"]
                if(data["type"] == "Ground"){
                    let cfg = AppConst.JSONManager.getItem("mapGround" , data["list"][startIndex + s].id)
                    // prefab.url = MapManager.GetInstance().getTileImgURL(cfg["baseImg"]);
                    prefab.url = "ground/image/" + cfg["baseImg"] + "/spriteFrame";
                }
                if(data["type"] == "OutsideRenovation"){
                    let cfg = AppConst.JSONManager.getItem("mapOutsideRenovation" , data["list"][startIndex + s].id)
                    prefab.url = cfg["icon"]  + "/spriteFrame";
                }
                if(data["type"] == "Floor"){
                    let cfg = AppConst.JSONManager.getItem("mapFloor" , data["list"][startIndex + s].id)
                    prefab.url = cfg["icon"]  + "/spriteFrame";
                }
                if(data["type"] == "Decor"){
                    let cfg = AppConst.JSONManager.getItem("mapDecor" , data["list"][startIndex + s].id)
                    prefab.url = cfg["icon"]  + "/spriteFrame";
                }

                let tileIcon = this.tileIcon[s].getComponent("tileIcon") as tileIcon
                tileIcon.tileId = data["list"][startIndex + s].id
                tileIcon.tileType = data["type"]
            }else{
                this.tileIcon[s].active = false
            }
        }
    }
}


