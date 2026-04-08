import { _decorator, Component, Label, Node } from 'cc';
import { UGCModel } from '../../../Model/UGCModel';
const { ccclass, property } = _decorator;

@ccclass('RensheCell')
export class RensheCell extends Component {
    @property(Label)
    public rensheLabel : Label = null;

    @property(Node)
    public chooseNode : Node = null;

    private npcId = 0;
    private rensheId = 0;

    start() {

    }

    refreshNpcInfo(npcId , rensheId , renshe){
        this.npcId = npcId;
        this.rensheId = rensheId;
        
        this.rensheLabel.string = renshe;

        let npcRenshe = UGCModel.getInstance().getNpcRenshe(this.npcId);
        let isIn = false
        for(let i = 0 ; i < npcRenshe.length ; i++){
            if(npcRenshe[i] == this.rensheId){
                isIn = true;
            }
            
        }
        this.chooseNode.active = isIn;
    }

    onClickRenshe(){
        let npcRenshe = UGCModel.getInstance().getNpcRenshe(this.npcId);
        let isIn = false;
        for(let i = 0 ; i < npcRenshe.length ; i++){
            if(npcRenshe[i] == this.rensheId){
                isIn = true;
                break;
            }
        }
        if(isIn){
            UGCModel.getInstance().removeNpcRenshe(this.npcId , this.rensheId);
            UGCModel.getInstance().syncNpcToServerById(this.npcId);
        }else{
            if (UGCModel.getInstance().addNpcRenshe(this.npcId , this.rensheId)) {
                UGCModel.getInstance().syncNpcToServerById(this.npcId);
            }
        }
        
        EventSystem.send("NPCRefreshCell" , {npcId : this.npcId , rensheId : this.rensheId})
    }
}

