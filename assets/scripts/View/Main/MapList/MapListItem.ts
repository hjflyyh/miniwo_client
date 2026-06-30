import { _decorator, Component, Label, Node, Sprite } from 'cc';
import InfiniteCell from '../../../../plugin/InfiniteList/InfiniteCell';
import { MapModel } from '../../../Model/MapModel';
import { Utils } from '../../../Utils/Utils';
import { AppConst } from '../../../AppConst';
import { RoleModel } from '../../../Model/RoleModel';
import { network } from '../../../Model/RequestData';
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

    @property(Node)
    waitNode : Node

    mapData
    data

    start() {
        EventSystem.addListent("WebSocketNotifications", this.OnWebSocketNotifications, this)
        EventSystem.addListent("OnCodeMapLevelPushContent" , this.OnCodeMapLevelPushContent , this)
    }

    OnCodeMapLevelPushContent(){
        this.UpdateContent(this.data)
    }

    OnWebSocketNotifications(data){
        if (data.code == network.ServerCode.CodeMapCoverComplete) {
            //封面更新
            let content: any = data?.content;
            if (typeof content === "string") {
                try { content = JSON.parse(content); } catch { content = null; }
            }
            if(content?.map_id && content?.map_cover_url){
                const mapId = Number(content.map_id);
                let mapData = null;
                for(let m = 0 ; m < MapModel.getInstance().sceneMaps.length ; m++){
                    if(MapModel.getInstance().sceneMaps[m].id == mapId){
                        mapData = MapModel.getInstance().sceneMaps[m]
                    }
                }
                if(mapData){
                    mapData["map_cover_url"] = content.map_cover_url;
                    if(this.mapData && Number(this.mapData["id"]) == mapId){
                        Utils.loadCoverFitHeight(content.map_cover_url, this.banner);
                    }
                }
            }
        }
    }

    UpdateContent(data: any): void {
        this.data = data
        let mapData = MapModel.getInstance().sceneMaps[data]
        this.mapData = mapData
        this.mapName.string = mapData.map_name
        this.mapInfo.string = "Lv." + mapData.map_level
        this.likeNumber.string = mapData.map_like_count
        this.isLike.active = mapData.liked

        if(mapData["map_cover_url"] && mapData["map_cover_url"] != ""){
            this.banner.spriteFrame = null
            Utils.loadCoverFitHeight(mapData["map_cover_url"], this.banner);
        }
    }

    OnClick(){
        console.log("进入地图")
        console.log(this.mapData)
        const mapModel = MapModel.getInstance();
        const gameType = mapModel.resolveMapGameType(this.mapData);
        if (gameType != null) {
            mapModel.pendingMapGameType = gameType;
        }
        mapModel.requestJoinMap(Number(this.mapData["id"]));

        EventSystem.send("ShowJuhua", "EnterGameMap");
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


