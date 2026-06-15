import { _decorator, Component, Node } from 'cc';
import { MapModel } from '../../Model/MapModel';
const { ccclass, property } = _decorator;

@ccclass('GameMapTypePrefab')
export class GameMapTypePrefab extends Component {
    @property(Node)
    public lingmai : Node

    @property(Node)
    public kongshan : Node

    start() {
        console.log(MapModel.getInstance().map_detail)
        this.lingmai.active = MapModel.getInstance().map_detail?.map_era == 2
        this.kongshan.active = MapModel.getInstance().map_detail?.map_era == 1
    }
}

