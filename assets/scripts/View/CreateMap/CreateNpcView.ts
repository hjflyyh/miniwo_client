import { _decorator, Component, EditBox, Node } from 'cc';
import { UGCModel } from '../../Model/UGCModel';
import { MapModel } from '../../Model/MapModel';
import { UGCStep3 } from '../UGCView/step3/UGCStep3';
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
        EventSystem.addListent("OnRefreshMyNpcList", this.refreshNpcList, this);
        EventSystem.addListent("OnRefreshUGCMapNpc", this.refreshNpcList, this);
        EventSystem.addListent("OnRefreshCreateNpcView", this.refreshNpcList, this);
        UGCModel.getInstance().listMyNpcs();
    }

    protected onDestroy(): void {
        EventSystem.remove(this);
    }

    /** 刷新列表区（UGCStep3 子节点） */
    public refreshNpcList() {
        const step3 = this.node.getComponentInChildren(UGCStep3);
        step3?.refreshTabNpc();
    }

    public onClickcreateNpc() {
        this.createNpcNode.active = true;
    }

    public onClickCloseNpcCreate() {
        this.createNpcNode.active = false;
    }

    onClickCreateNpc() {
        const name = this.npcNameEditBox.string ? this.npcNameEditBox.string.trim() : "";
        if (name == "") {
            EventSystem.send("ShowTips", "请输入NPC名称");
            return;
        }
        const age = this.npcAgeEditBox.string ? this.npcAgeEditBox.string.trim() : "";
        if (age == "" || isNaN(Number(age))) {
            EventSystem.send("ShowTips", "请输入NPC年龄，必须为数字");
            return;
        }
        if (UGCModel.getInstance().npcList.length >= 10) {
            EventSystem.send("ShowTips", "NPC数量不能超过10个");
            return;
        }
        const ugc = UGCModel.getInstance();
        const hasSame = (ugc.npcList || []).some((npc: any) => {
            const npcName = String(npc?.name || "").trim();
            return npcName === name;
        });
        if (hasSame) {
            EventSystem.send("ShowTips", "已存在同名NPC，请换一个名字");
            return;
        }

        ugc.creatorNpc(MapModel.getInstance().my_map_data.id, name, Number(age));
        this.createNpcNode.active = false;
    }
}
