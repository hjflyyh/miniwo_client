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

        let npcHobbies = UGCModel.getInstance().getNpcHobbies(this.npcId);
        let isIn = false
        for(let i = 0 ; i < npcHobbies.length ; i++){
            if(npcHobbies[i] == this.backgroundId){
                isIn = true;
            }
            
        }
        this.chooseNode.active = isIn;
    }

    onClick(){
        // UGCModel.getInstance().setNpcHobbies(this.npcId , this.backgroundId);
        // UGCModel.getInstance().syncNpcToServerById(this.npcId);
        // EventSystem.send("NPCRefreshCell" , {npcId : this.npcId , backgroundStr : this.backgroundStr})
        let npcHobbies = UGCModel.getInstance().getNpcHobbies(this.npcId);
        let isIn = false;
        for(let i = 0 ; i < npcHobbies.length ; i++){
            if(npcHobbies[i] == this.backgroundId){
                isIn = true;
                break;
            }
        }
        if(isIn){
            UGCModel.getInstance().removeNpcHobbies(this.npcId , this.backgroundId);
            UGCModel.getInstance().syncNpcToServerById(this.npcId);
        }else{
            if (UGCModel.getInstance().addNpcHobbies(this.npcId , this.backgroundId)) {
                UGCModel.getInstance().syncNpcToServerById(this.npcId);
            }
        }
        
        EventSystem.send("NPCRefreshCell" , {npcId : this.npcId , backgroundId : this.backgroundId})
    }
}

