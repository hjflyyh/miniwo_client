import { _decorator, Component, EditBox, Node } from 'cc';
import { UGCModel } from '../../Model/UGCModel';
import { MapModel } from '../../Model/MapModel';
const { ccclass, property } = _decorator;

@ccclass('CreateNpcView')
export class CreateNpcView extends Component {
    @property(Node)
    public createNpcNode: Node = null;

    @property(EditBox)
    public npcNameEditBox: EditBox = null;

    @property(EditBox)
    public npcAgeEditBox: EditBox = null;    

    start() {
        this.createNpcNode.active = false;
    }

    public onClickcreateNpc() {
        this.createNpcNode.active = true;
    }   

    public onClickCloseNpcCreate() { 
        this.createNpcNode.active = false;
    }

    onClickCreateNpc(){
        const name = this.npcNameEditBox.string ? this.npcNameEditBox.string.trim() : "";
        if(name == ""){
            EventSystem.send("ShowTips" , "请输入NPC名称")
            return
        }
        const age = this.npcAgeEditBox.string ? this.npcAgeEditBox.string.trim() : "";
        if(age == "" || isNaN(Number(age))){
            EventSystem.send("ShowTips" , "请输入NPC年龄，必须为数字")
            return
        }
        if(UGCModel.getInstance().npcList.length >= 10){
            EventSystem.send("ShowTips" , "NPC数量不能超过10个")
            return
        }
        // 检查是否存在同名 NPC（按名称精确匹配）
        const ugc = UGCModel.getInstance();
        const hasSame = (ugc.npcList || []).some((npc: any) => {
            const npcName = String(npc?.name || "").trim();
            return npcName === name;
        });
        if (hasSame) {
            EventSystem.send("ShowTips" , "已存在同名NPC，请换一个名字");
            return;
        }

        ugc.creatorNpc(MapModel.getInstance().my_map_data.id , name , Number(age));
        this.createNpcNode.active = false;
    }    
}

