import { _decorator, Component, instantiate, Node } from 'cc';
import { UGCModel } from '../../Model/UGCModel';
import { CreateNpcNameCell } from './CreateNpcNameCell';
import { RoleModel } from '../../Model/RoleModel';
import { MTBICell } from './createNpc/MTBICell';
import { SexCell } from './createNpc/SexCell';
import { RensheCell } from './createNpc/RensheCell';
import { BackgroundCell } from './createNpc/BackgroundCell';
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
    public sexNodes : Node[] = [];

    @property(Node)
    public rensheCell : Node = null;
    public rensheNodes : Node[] = [];

    @property(Node)
    public backgroundCell : Node = null;
    public backgroundNodes : Node[] = [];

    public chooseNpcId = 0;
    start() {
        console.log(this.node["_openParam"])
        this.chooseNpcId = this.node["_openParam"].id;
        this.npcTabCell.active = false
        this.refreshTabNpc();
        this.refreshTabs();

        EventSystem.addListent("CreateNpcNameCell" , this.onChooseNpc , this)
        EventSystem.addListent("NPCRefreshCell" , this.onChooseMBTI , this)
    }

    onChooseNpc(npcId){
        this.chooseNpcId = npcId;
        this.refreshTabs();
        this.refreshTabNpc();
    }

    onChooseMBTI(){
        this.refreshTabs();
    }
    
    refreshTabs(){
        this.mtbiCell.active = false;
        this.sexCell.active = false;
        this.rensheCell.active = false;
        this.backgroundCell.active = false;

        //mbti列表
        let mbtiList = UGCModel.getInstance().getMBTIList();
        for(let i = 0 ; i < mbtiList.length ; i++){
            let mtbiCell = this.mtbiNodes[i]
            if(mtbiCell == null){
                mtbiCell = instantiate(this.mtbiCell)
                mtbiCell.parent = this.mtbiCell.parent
                mtbiCell.active = true
                this.mtbiNodes.push(mtbiCell)                
            }
                 
            let tagCell : MTBICell = mtbiCell.getComponent(MTBICell)
            tagCell.setNpcId(this.chooseNpcId , mbtiList[i].tag_name , mbtiList[i].id)
        }

        //性别
        for(let i = 0 ; i < 3 ; i++){
            let sexCell = this.sexNodes[i]
            if(sexCell == null){
                sexCell = instantiate(this.sexCell)
                sexCell.parent = this.sexCell.parent
                sexCell.active = true
                this.sexNodes.push(sexCell)                
            }

            let tagCell : SexCell = sexCell.getComponent(SexCell)
            tagCell.refreshNpcInfo(this.chooseNpcId , i)
        }

        //人设
        let rensheList = UGCModel.getInstance().getRensheList();
        for(let i = 0 ; i < rensheList.length ; i++){
            let rensheCell = this.rensheNodes[i]
            if(rensheCell == null){
                rensheCell = instantiate(this.rensheCell)
                rensheCell.parent = this.rensheCell.parent
                rensheCell.active = true
                this.rensheNodes.push(rensheCell)                
            }
                 
            let tagCell : RensheCell = rensheCell.getComponent(RensheCell)
            tagCell.refreshNpcInfo(this.chooseNpcId , rensheList[i].id , rensheList[i].tag_name)
        }

        //背景
        let backgroundList = UGCModel.getInstance().getBackgroundList();
        for(let i = 0 ; i < backgroundList.length ; i++){
            let backgroundCell = this.backgroundNodes[i]
            if(backgroundCell == null){
                backgroundCell = instantiate(this.backgroundCell)
                backgroundCell.parent = this.backgroundCell.parent
                backgroundCell.active = true
                this.backgroundNodes.push(backgroundCell)                
            }
                 
            let tagCell : BackgroundCell = backgroundCell.getComponent(BackgroundCell)
            tagCell.refreshNpcInfo(this.chooseNpcId , backgroundList[i].id , backgroundList[i].tag_name)
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

