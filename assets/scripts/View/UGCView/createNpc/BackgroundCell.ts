import { _decorator, Component, Label, Node } from 'cc';
import { UGCModel } from '../../../Model/UGCModel';
const { ccclass, property } = _decorator;

@ccclass('BackgroundCell')
export class BackgroundCell extends Component {
    @property(Label)
    public backgroundLabel : Label = null;

    @property(Node)
    public chooseNode : Node = null;

    private npcId = 0;
    private backgroundId = 0;
    private backgroundStr = ""

    start() {

    }

    refreshNpcInfo(npcId , backgroundId , background){
        this.npcId = npcId;
        this.backgroundId = backgroundId;
        this.backgroundStr = background;
        
        this.backgroundLabel.string = background;

        let npcBackground = UGCModel.getInstance().getNpcBackground(this.npcId);
        this.chooseNode.active = npcBackground == background;
    }

    onClick(){
        UGCModel.getInstance().setNpcBackground(this.npcId , this.backgroundStr);
        UGCModel.getInstance().syncNpcToServerById(this.npcId);
        EventSystem.send("NPCRefreshCell" , {npcId : this.npcId , backgroundStr : this.backgroundStr})
    }
}

