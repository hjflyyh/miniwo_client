import { _decorator, Component, Label, Node, Sprite } from 'cc';
import InfiniteCell from '../../../../plugin/InfiniteList/InfiniteCell';
import { MapModel } from '../../../Model/MapModel';
import { Utils } from '../../../Utils/Utils';
import { AppConst } from '../../../AppConst';
import { RoleModel } from '../../../Model/RoleModel';
const { ccclass, property } = _decorator;

@ccclass('MapListItem')
export class MapListItem extends Component implements InfiniteCell{
    public cellIdentifier: string;
    public dataIndex: number;

    @property(Label)
    mapName : Label


    @property(Label)
    mapInfo : Label

    @property(Sprite)
    banner : Sprite

    @property(Label)
    likeNumber : Label

    @property(Node)
    isLike : Node

    mapData
    start() {

    }

    UpdateContent(data: any): void {
        let mapData = MapModel.getInstance().sceneMaps[data]
        this.mapData = mapData
        this.mapName.string = mapData.map_name
        this.mapInfo.string = mapData.map_worldview
        this.likeNumber.string = mapData.map_like_count
        this.isLike.active = mapData.liked

        Utils.loadCover(mapData["map_cover_url"], this.banner , 850 , 1420);
    }

    OnClick(){
        console.log("进入地图")
        console.log(this.mapData)
        const mapModel = MapModel.getInstance();
        mapModel.pendingMapGameType = mapModel.resolveMapGameType(this.mapData);
        mapModel.requestJoinMap(Number(this.mapData["id"]));
    }

    OnClickLike(){
        const mapId = Number(this.mapData["id"]);
        if (MapModel.getInstance().IsUserLikedMap(mapId)) {
            MapModel.getInstance().RemoveMapLike(mapId);
            AppConst.HttpManager.sendPostHttp("unlikeMap" , JSON.stringify({ "token": RoleModel.getInstance().token, mapId }));
        } else {
            MapModel.getInstance().AddMapLike(mapId);
            AppConst.HttpManager.sendPostHttp("likeMap" , JSON.stringify({ "token": RoleModel.getInstance().token, mapId }));
        }
        this.isLike.active = MapModel.getInstance().IsUserLikedMap(mapId);
        this.likeNumber.string = String(MapModel.getInstance().GetMapLikeCount(mapId));
    }
}


