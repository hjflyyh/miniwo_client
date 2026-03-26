import { _decorator, Component, Label, Node } from 'cc';
import { RoleModel } from '../../Model/RoleModel';
import { MapChatManager } from '../../Manager/ChatManager';
const { ccclass, property } = _decorator;

@ccclass('GameViewChatCell')
export class GameViewChatCell extends Component {
    @property(Label)
    sendName : Label = null

    @property(Node)
    npcIcon : Node = null

    @property(Node)
    myTitle : Node = null

    @property(Label)
    content : Label = null

    @property(Node)
    npcNameBg : Node = null

    @property(Label)
    npcName : Label = null


    start() {

    }

    refreshData(data) {
        this.sendName.string = data.username + ":"
        this.myTitle.active = data.username == RoleModel.getInstance().nickName
        this.content.string = MapChatManager.instance.getDisplayText(data.text)
        
        if(data.from_type == "player"){
            this.npcIcon.active = false
            this.npcNameBg.active = false
        }else{
            this.npcIcon.active = true
            this.npcNameBg.active = true
            this.npcName.string = data.npc_name
            this.sendName.string = ""
        }
    }
}

