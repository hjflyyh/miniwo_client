import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { Utils } from '../../Utils/Utils';
import { AppConst } from '../../AppConst';
import { CREATE_NPC_NEW_OPEN_ENTER_INFO, npcIsSpriteGenerating, npcNeedsEnterInfo } from './CreateNpcNewDraft';
const { ccclass, property } = _decorator;

@ccclass('CreateNpcTabCell')
export class CreateNpcTabCell extends Component {
    npcInfo

    @property(Sprite)
    headSp : Sprite

    @property(Node)
    GeneratedNode : Node

    @property(Node)
    headBg : Node

    @property(Label)
    GenerateLabel : Label

    start() {

    }

    refreshNpcInfo(npcInfo){
        console.log(npcInfo)
        this.npcInfo = npcInfo
        this.GeneratedNode.active = !npcInfo.npc_sprite_url || npcInfo.npc_sprite_url == ""

        if (npcIsSpriteGenerating(this.npcInfo)) {
            this.GenerateLabel.string = "Generating..."
        }else{
            this.GenerateLabel.string = "Continue..."
        }
        if(!npcInfo.npc_sprite_url || npcInfo.npc_sprite_url == ""){
            this.headSp.spriteFrame = null
            this.headBg.active = false
        }else{
            Utils.loadCover(npcInfo.npc_sprite_url , this.headSp)
            this.headBg.active = true
        }
    }

    onClick() {
        if (!this.npcInfo) {
            return;
        }
        if (npcIsSpriteGenerating(this.npcInfo)) {
            AppConst.PanelManager.openView('res/View/CreateMap/NPCTips', this.npcInfo);
            return;
        }
        if (npcNeedsEnterInfo(this.npcInfo)) {
            EventSystem.send(CREATE_NPC_NEW_OPEN_ENTER_INFO, this.npcInfo);
            return;
        }
        AppConst.PanelManager.openView('res/View/CreateMap/NPCTips', this.npcInfo);
    }
}

