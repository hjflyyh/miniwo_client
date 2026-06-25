import { _decorator, Component, Label, Node, ProgressBar, Sprite } from 'cc';
import { Utils } from '../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('NpcWorkCell')
export class NpcWorkCell extends Component {
    @property(Sprite)
    public npcHead: Sprite = null;

    @property(Label)
    public npcName: Label = null;

    /** 已被选中 */
    @property(Node)
    public chooseNode: Node = null;

    @property(ProgressBar)
    tilliProg : ProgressBar

    @property(Label)
    tiliLabel : Label

    @property(Label)
    workStatue : Label

    public npcData: any = null;

    refreshData(data: any, selected = false) {
        this.npcData = data ?? null;
        if (!data) {
            this.setSelected(false);
            return;
        }

        if(this.npcData.work_status == 0){
            this.workStatue.string = "Resting..."
        }else if(this.npcData.work_status == 1){
            this.workStatue.string = "On the farm..."
        }else if(this.npcData.work_status == 4){
            this.workStatue.string = "Dispatch..."
        }

        this.tilliProg.progress = data.stamina / 1000
        this.tiliLabel.string = data.stamina + "/1000"
        if (this.npcName) {
            this.npcName.string = String(data.name ?? "");
        }

        if (this.npcHead) {
            if (data.npc_sprite_url) {
                Utils.loadCover(data.npc_sprite_url, this.npcHead, 78, 78);
            }
        }

        this.setSelected(selected);
    }

    public setSelected(selected: boolean) {
        if (this.chooseNode) {
            this.chooseNode.active = !!selected;
        }
    }

    public getNpcId(): number {
        return Number(this.npcData?.id ?? this.npcData?.npc_id ?? 0);
    }

    /** 数据库 npc.work_status，供业务侧读取 */
    public getWorkStatus(): number {
        return Number(this.npcData?.work_status ?? 0);
    }

    public onClick() {
        const npcId = this.getNpcId();
        if (!npcId) {
            return;
        }
        EventSystem.send("OnNpcWorkCellClick", {
            npcId,
            npcData: this.npcData,
        });
    }
}
