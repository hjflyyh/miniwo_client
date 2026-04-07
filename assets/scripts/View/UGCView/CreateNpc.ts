import { _decorator, Component, instantiate, Node } from 'cc';
import { UGCModel } from '../../Model/UGCModel';
import { CreateNpcNameCell } from './CreateNpcNameCell';
import { RoleModel } from '../../Model/RoleModel';
import { MTBICell } from './createNpc/MTBICell';
const { ccclass, property } = _decorator;

@ccclass('CreateNpc')
export class CreateNpc extends Component {
    private npcTabs : Node[] = [];

    @property(Node)
    public npcTabCell : Node = null;

    @property(Node)
    public mtbiCell : Node = null;
    public mtbiNodes : Node[] = [];

    @property(Node)
    public sexCell : Node = null;

    @property(Node)
    public rensheCell : Node = null;

    @property(Node)
    public backgroundCell : Node = null;

    public chooseNpcId = 0;
    start() {
        console.log(this.node["_openParam"])
        this.chooseNpcId = this.node["_openParam"].id;
        this.npcTabCell.active = false
        this.refreshTabNpc();
        this.refreshTabs();

        EventSystem.addListent("CreateNpcNameCell" , this.onChooseNpc , this)
    }

    onChooseNpc(npcId){
        this.chooseNpcId = npcId;
        this.refreshTabs();
        this.refreshTabNpc();
    }
    
    refreshTabs(){    
        this.mtbiCell.active = false;
        for(let i = 0 ; i < RoleModel.getInstance().tags.length ; i++){
            if(RoleModel.getInstance().tags[i].tag_type == 5){
                 let mtbiCell = instantiate(this.mtbiCell)
                 mtbiCell.parent = this.mtbiCell.parent
                 mtbiCell.active = true
                 
                 let tagCell : MTBICell = mtbiCell.getComponent(MTBICell)
                 tagCell.setNpcId(this.chooseNpcId , RoleModel.getInstance().tags[i].tag_name , i)
 
                 this.mtbiNodes.push(mtbiCell)
            }
        }
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
        for(let u = 0 ; u < this.npcTabs.length ; u++){
            if(u < UGCModel.getInstance().npcList.length){
                this.npcTabs[u].active = true;
                let npcInfo = UGCModel.getInstance().npcList[u];
                this.npcTabs[u].getComponent(CreateNpcNameCell).refreshNpcInfo(npcInfo, this);
            } else {
                this.npcTabs[u].active = false;
            }
        }
    }    
}

