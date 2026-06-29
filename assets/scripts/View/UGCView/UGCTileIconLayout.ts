import { _decorator, Component, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { PrefabLoad } from '../../Utils/PrefabLoad';
import { UGCtileIcon } from './UGCtileIcon';
const { ccclass, property } = _decorator;

@ccclass('UGCTileIconLayout')
export class UGCTileIconLayout extends Component {
     public cellIdentifier: string;
     public dataIndex: number;
 
     @property([Node])
     tileIcon : Node[] = []
 
     start() {
 
     }
 
     UpdateContent(data: any): void {
         let startIndex = data["dataIndex"] * 5
         for(let s = 0 ; s < 5 ; s++){
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
                 if(data["type"] == "Decor" || data["type"] == "DecorOrnament" || data["type"] == "Appliance"){
                     let cfg = AppConst.JSONManager.getItem("mapDecor" , data["list"][startIndex + s].id)
                     prefab.url = cfg["icon"]  + "/spriteFrame";
                 }
                 if(data["type"] == "WallDacoration"){
                     let cfg = AppConst.JSONManager.getItem("mapWallDecor" , data["list"][startIndex + s].id)
                     prefab.url = cfg["icon"]  + "/spriteFrame";
                 }
                 if(data["type"] == "Fram"){
                     let cfg = AppConst.JSONManager.getItem("mapEdit" , data["list"][startIndex + s].id)
                     prefab.url = cfg["resource"] + "/spriteFrame";
                 }
 
                 let tileIcon = this.tileIcon[s].getComponent("UGCtileIcon") as UGCtileIcon
                 tileIcon.tileId = data["list"][startIndex + s].id
                 tileIcon.tileType = data["type"]
             }else{
                 this.tileIcon[s].active = false
             }
         }
     }
 }

