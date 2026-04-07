import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { CreateNpc } from '../CreateNpc';
import { UGCModel } from '../../../Model/UGCModel';
const { ccclass, property } = _decorator;

@ccclass('SexCell')
export class SexCell extends Component {
    @property(Label)
    public sexLabel : Label = null;

    @property(Node)
    public chooseNode : Node = null;

    private npcId = 0;
    private sexId = 0;
    start() {

    }

    refreshNpcInfo(npcId , sex){
        this.npcId = npcId;
        this.sexId = sex;
        if(this.sexId == 0){
            this.sexLabel.string = "男";
        }
        if(this.sexId == 1){
            this.sexLabel.string = "女";
        }
        if(this.sexId == 2){
            this.sexLabel.string = "其他";
        }
        let npcSex = UGCModel.getInstance().getNpcSex(this.npcId);
        this.chooseNode.active = npcSex == sex;
    }

    onClickSex(){
        UGCModel.getInstance().setNpcSex(this.npcId , this.sexId);
        UGCModel.getInstance().syncNpcToServerById(this.npcId);
        EventSystem.send("NPCRefreshCell" , {npcId : this.npcId , sexId : this.sexId})
    }
}

