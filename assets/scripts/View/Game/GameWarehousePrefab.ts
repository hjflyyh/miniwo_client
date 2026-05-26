import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameWarehousePrefab')
export class GameWarehousePrefab extends Component {
    start() {

    }

    onClick(){
        EventSystem.send("OpenGameWarehouse")
    }
}

