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
    private mbtiIndex = 0;
    start() {

    }

    setNpcId(npcId , mbti , mbtiIndex){
        this.npcId = npcId;
        this.mbtiIndex = mbtiIndex;
        this.mbtiLabel.string = mbti;
        let npcMBTI = UGCModel.getInstance().getNpcMBTI(this.npcId);
        this.chooseNode.active = npcMBTI + 1 == mbtiIndex;
    }

    onClickMBTI(){
        EventSystem.send("MTBICell" , {npcId : this.npcId , mbtiIndex : this.mbtiIndex})
    }
}

