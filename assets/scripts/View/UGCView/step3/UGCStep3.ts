import { _decorator, Component, instantiate, Label, Node } from 'cc';
import { UGCModel } from '../../../Model/UGCModel';
import { UGCNpcTabCell } from './UGCNpcTabCell';
import { UGCNpcInfoCell } from './UGCNpcInfoCell';
const { ccclass, property } = _decorator;

@ccclass('UGCStep3')
export class UGCStep3 extends Component {
    @property(Node)
    public npcTabCell : Node = null;
    private npcTabs : Node[] = [];    

    @property(Node)
    public npcInfoCell : Node = null;
    public npcNodes : Node[] = [];


    start() {
        this.npcTabCell.active = false
        this.npcInfoCell.active = false

        UGCModel.getInstance().getNpcByMap(UGCModel.getInstance().mapData.id);

        this.refreshTabNpc();
        
        EventSystem.addListent("OnRefreshUGCMapNpc" , this.refreshTabNpc , this)
    }
    
    refreshTabNpc(){
        if(this.npcTabs.length < UGCModel.getInstance().npcList.length){
            for(let i = this.npcTabs.length ; i < UGCModel.getInstance().npcList.length ; i++){
                let npcTab = instantiate(this.npcTabCell);
                npcTab.parent = this.npcTabCell.parent;
                npcTab.active = true;
                this.npcTabs.push(npcTab);
            }   
        }
        for(let i = 0 ; i < this.npcTabs.length ; i++){
            if(i < UGCModel.getInstance().npcList.length){
                this.npcTabs[i].active = true;
                let npcInfo = UGCModel.getInstance().npcList[i];
                this.npcTabs[i].getComponent(UGCNpcTabCell).refreshNpcInfo(npcInfo);
            } else {
                this.npcTabs[i].active = false;
            }
        }

        if(this.npcNodes.length < UGCModel.getInstance().npcList.length){
            for(let i = this.npcNodes.length ; i < UGCModel.getInstance().npcList.length ; i++){
                let npcNew = instantiate(this.npcInfoCell);
                npcNew.parent = this.npcInfoCell.parent;
                npcNew.active = true;
                this.npcNodes.push(npcNew);
            }   
        }
        for(let i = 0 ; i < this.npcNodes.length ; i++){
            if(i < UGCModel.getInstance().npcList.length){
                this.npcNodes[i].active = true;
                let npcInfo = UGCModel.getInstance().npcList[i];
                this.npcNodes[i].getComponent(UGCNpcInfoCell).refreshNpcInfo(npcInfo);
            } else {
                this.npcNodes[i].active = false;
            }
        }
    }
}

