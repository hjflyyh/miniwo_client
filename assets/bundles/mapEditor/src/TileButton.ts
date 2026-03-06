import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TileButton')
export class TileButton extends Component {
    @property
    width: number = 64;
    @property
    height: number = 64;
}


