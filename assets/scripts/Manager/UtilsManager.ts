import { _decorator, Color, color, Component, Material, Node } from 'cc';
import { RoleModel } from '../Model/RoleModel';
import { NPCModel } from '../Model/NPCModel';
import { AppConst } from '../AppConst';
import { MapModel } from '../Model/MapModel';
import { CardModel } from '../Model/CardModel';
import { SocialModel } from '../Model/SocialModel';
import { MapChatManager } from './ChatManager';
import { BagModel } from '../Model/BagModel';
const { ccclass, property } = _decorator;

@ccclass('UtilsManager')
export class UtilsManager extends Component {
    onLoad(){
        AppConst.UtilsManager = this

        RoleModel.getInstance().init()
        NPCModel.getInstance().init()
        MapModel.getInstance().init()
        CardModel.getInstance().init()
        BagModel.getInstance().init()
        SocialModel.getInstance().init()
        MapChatManager.instance.init()
    }

    start() {

    }
}


