import { _decorator, Component, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { PrivateChatManager } from '../../Manager/PrivateChatMessage';
const { ccclass, property } = _decorator;

@ccclass('MainView')
export class MainView extends Component {
    start() {
        AppConst.PanelManager.openView("res/View/Main/MainBottom")
        AppConst.PanelManager.openView("res/View/Main/MainTop")
    }

}


