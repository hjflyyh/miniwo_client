import { _decorator, Component } from 'cc';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('MainView')
export class MainView extends Component {
    start() {
        AppConst.PanelManager.openView("res/View/Main/MainBottom")
        AppConst.PanelManager.openView("res/View/Main/MainTop")
    }

}

