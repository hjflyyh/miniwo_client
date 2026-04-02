import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { Utils } from '../../Utils/Utils';
import { AppConst } from '../../AppConst';
import { RoleModel } from '../../Model/RoleModel';
import { UGCModel } from '../../Model/UGCModel';
const { ccclass, property } = _decorator;

@ccclass('MyWorldListCell')
export class MyWorldListCell extends Component {
    @property(Sprite)
    banner : Sprite

    @property(Node)
    bannerNull : Node

    @property(Label)
    mapName : Label

    @property(Label)
    remainingTime : Label

    @property(Label)
    creatorTime : Label

    @property(Node)
    editBtn : Node

    @property(Node)
    deleteBtn : Node

    start() {

    }
    
    onClickEdit(){
        UGCModel.getInstance().getMap(this.mapData.map_id)
    }

    onClickDelete(){
        AppConst.HttpManager.sendPostHttp("deleteDraftMap", JSON.stringify({
            token: RoleModel.getInstance().token,
            mapId: this.mapData.map_id   // 要删的地图 id，数字
        }));
    }

    private mapData
    refreshByData(data){
        this.mapData = data
        this.mapName.string = data.map_name
        this.remainingTime.string = "更新时间：" + data.updated_at
        this.creatorTime.string = data.created_at

        if(data.map_cover_url != null && data.map_cover_url != ""){
            this.bannerNull.active = false
            this.banner.node.active = true
            Utils.loadCover(data.map_cover_url, this.banner , 850 , 1420);
        }else{
            this.bannerNull.active = true
            this.banner.node.active = false
        }
        this.editBtn.active = data.map_state != 0
        this.deleteBtn.active = data.map_state != 0
    }
}

