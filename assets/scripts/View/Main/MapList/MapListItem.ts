import { _decorator, Component, Label, Node, Sprite } from 'cc';
import InfiniteCell from '../../../../plugin/InfiniteList/InfiniteCell';
import { MapModel } from '../../../Model/MapModel';
import { network } from '../../../Model/RequestData';
import { AppConst } from '../../../AppConst';
import { Utils } from '../../../Utils/Utils';
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

    mapData
    start() {

    }

    UpdateContent(data: any): void {
        let mapData = MapModel.getInstance().sceneMaps[data]
        this.mapData = mapData
        this.mapName.string = mapData.map_name
        this.mapInfo.string = mapData.map_worldview

        Utils.loadCover(mapData["map_cover_url"], this.banner);
    }

    OnClick(){
        console.log("进入地图")
        console.log(this.mapData)
        let JoinMapEequest = new network.JoinMapEequest();
        AppConst.WebSocketManager.send(JoinMapEequest.toJSON(this.mapData["id"]))
    }
}


