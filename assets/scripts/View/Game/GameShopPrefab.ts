import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameShopPrefab')
export class GameShopPrefab extends Component {
    start() {

    }

    onClick(){
        EventSystem.send("OpenGameShop")
    }
}

