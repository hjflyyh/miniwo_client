import { _decorator, Component, Label, Node, Prefab } from 'cc';
import { PrefabLoad } from '../../Utils/PrefabLoad';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('ItemTips')
export class ItemTips extends Component {
    @property(Label)
    itemName : Label

    @property(Label)
    itemInfo : Label

    @property(PrefabLoad)
    itemIcon : PrefabLoad

    @property(Label)
    itemCount : Label

    @property(Node)
    useNode : Node

    start() {
        let itemId = this.node["_openParam"].itemId
        let itemNum = this.node["_openParam"].num
        this.itemCount.string = itemNum > 0 ? "Count:" + itemNum : ""
        this.itemIcon.url = "UITexture/itemIcon/"+ itemId + "/spriteFrame"

        let itemCfg = AppConst.JSONManager.getItem("item" , itemId)
        this.itemName.string = itemCfg["name_" + AppConst.LanguageManager.language]
        this.itemInfo.string = itemCfg["info_" + AppConst.LanguageManager.language]
    }
    
}


