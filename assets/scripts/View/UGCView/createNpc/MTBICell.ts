import { _decorator, Component, Label, Node } from 'cc';
import { UGCModel } from '../../../Model/UGCModel';
const { ccclass, property } = _decorator;

@ccclass('MTBICell')
export class MTBICell extends Component {
    @property(Label)
    public mbtiLabel : Label = null;

    @property(Node)
    public chooseNode : Node = null;

    private npcId = 0;
    private mbtiId = 0;
    start() {

    }

    setNpcId(npcId , mbti , mbtiId){
        this.npcId = npcId;
        this.mbtiId = mbtiId;
        this.mbtiLabel.string = mbti;
        let npcMBTI = UGCModel.getInstance().getNpcMBTI(this.npcId);
        this.chooseNode.active = npcMBTI == mbtiId;
    }

    onClickMBTI(){
        UGCModel.getInstance().setNpcMBTI(this.npcId , this.mbtiId);
        UGCModel.getInstance().syncNpcToServerById(this.npcId);
        EventSystem.send("NPCRefreshCell" , {npcId : this.npcId , mbtiId : this.mbtiId})
    }
}

