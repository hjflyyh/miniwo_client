import { _decorator, Component, instantiate, Layout, Node } from 'cc';
import { UGCModel } from '../../Model/UGCModel';
import { NpcWorkCell } from './NpcWorkCell';
import { NpcWorkAnimCell } from './NpcWorkAnimCell';
const { ccclass, property } = _decorator;

@ccclass('NpcWorkView')
export class NpcWorkView extends Component {
    public chooseNpcId: number[] = [];

    @property(Node)
    public npcCell: Node = null;

    private npcCells: Node[] = [];

    @property(Node)
    public npcAnimCell: Node = null;

    private npcAnimCells: Node[] = [];


    private showList = []
    start() {
        if (this.npcCell) {
            this.npcCell.active = false;
        }
        if (this.npcAnimCell) {
            this.npcAnimCell.active = false;
        }
        EventSystem.addListent("OnRefreshGeneratedMyNpcList", this.onRefreshMyNpcList, this);
        EventSystem.addListent("OnNpcWorkCellClick", this.onNpcWorkCellClick, this);
        UGCModel.getInstance().listGeneratedNpcs();
    }

    /** 与 npcCells 一一对应的动画 cell 节点（子节点展示由业务自行处理） */
    public getNpcAnimCells(): Node[] {
        return this.npcAnimCells;
    }

    protected onDestroy(): void {
        EventSystem.remove(this);
    }

    private onRefreshMyNpcList(list?: any[]) {
        this.refreshNpcList(Array.isArray(list) ? list : UGCModel.getInstance().myNpcList);
    }

    private onNpcWorkCellClick(payload: { npcId?: number; npcData?: any }) {
        const npcId = Number(payload?.npcId ?? 0);
        if (!npcId) {
            return;
        }
        const idx = this.chooseNpcId.indexOf(npcId);
        if (idx >= 0) {
            this.chooseNpcId.splice(idx, 1);
        } else {
            this.chooseNpcId.push(npcId);
        }
        this.refreshChooseDisplay();
        EventSystem.send("OnNpcWorkChooseChange", {
            chooseNpcIds: [...this.chooseNpcId],
            npcId,
            npcData: payload?.npcData,
            selected: this.chooseNpcId.indexOf(npcId) >= 0,
        });
    }

    private refreshChooseDisplay() {
        for (let i = 0; i < this.npcCells.length; i++) {
            const comp = this.npcCells[i]?.getComponent(NpcWorkCell);
            if (!comp) {
                continue;
            }
            comp.setSelected(this.chooseNpcId.includes(comp.getNpcId()));
        }
        this.refreshNpcAnimList();
    }

    private refreshNpcList(npcList: any[]) {
        if (!this.npcCell?.isValid) {
            return;
        }
        const content = this.npcCell.parent;
        if (!content) {
            return;
        }

        this.showList = []
        for(let i = 0; i < npcList.length; i++){
            const npc = npcList[i];
            const npcId = Number(npc?.id ?? npc?.npc_id ?? 0);
            if(npcId && npc["sprite_generating_status"] && npc["sprite_generating_status"] == 2){
                this.showList.push(npc)
            }
        }

        while (this.npcCells.length < this.showList.length) {
            const cell = instantiate(this.npcCell);
            cell.parent = content;
            cell.active = true;
            this.npcCells.push(cell);
        }

        for (let i = 0; i < this.npcCells.length; i++) {
            const cell = this.npcCells[i];
            if (!cell?.isValid) {
                continue;
            }
            if (i < this.showList.length) {
                cell.active = true;
                const npc = this.showList[i];
                const comp = cell.getComponent(NpcWorkCell);
                const npcId = Number(npc?.id ?? npc?.npc_id ?? 0);
                const selected = this.chooseNpcId.includes(npcId);
                comp?.refreshData(npc, selected);
            } else {
                cell.active = false;
            }
        }

        const layout = content.getComponent(Layout);
        layout?.updateLayout();

        this.refreshNpcAnimList();
    }

    /** 初始化 npcAnimCell 列表，数量与 npcCells 一致 */
    private refreshNpcAnimList() {
        if (!this.npcAnimCell?.isValid) {
            return;
        }
        const content = this.npcAnimCell.parent;
        if (!content) {
            return;
        }

        while (this.npcAnimCells.length < this.showList.length) {
            const cell = instantiate(this.npcAnimCell);
            cell.parent = content;
            cell.active = true;
            this.npcAnimCells.push(cell);
        }

        for (let i = 0; i < this.npcAnimCells.length; i++) {
            const cell = this.npcAnimCells[i];
            if (!cell?.isValid) {
                continue;
            }
            cell.active = i < this.showList.length;
            if(i < this.showList.length){
                const npc = this.showList[i];
                const npcId = Number(npc?.id ?? npc?.npc_id ?? 0);
                let isIn = false
                for(let j = 0; j < this.chooseNpcId.length; j++){
                    if(this.chooseNpcId[j] === npcId){
                        isIn = true
                        break
                    }
                }
                const comp = cell.getComponent(NpcWorkAnimCell);
                comp.refreshData(npc);
                cell.active = isIn
            }
        }

        const layout = content.getComponent(Layout);
        layout?.updateLayout();

        EventSystem.send("OnNpcWorkAnimCellsRefresh", {
            animCells: this.npcAnimCells,
            npcCells: this.npcCells,
            npcList: this.showList,
        });
    }

    public goToFarm() {
        if (this.chooseNpcId.length > 1) {
            EventSystem.send("ShowTips", "只能选择一个");
            return;
        }
        if (this.chooseNpcId.length !== 1) {
            EventSystem.send("ShowTips", "请先选择 NPC");
            return;
        }
        const check = UGCModel.getInstance().canAssignNpcToFarm(this.chooseNpcId[0]);
        if (!check.ok) {
            EventSystem.send("ShowTips", check.message ?? "无法派遣该 NPC 去农场");
            return;
        }
        this.applyWorkStatus(1);
    }

    public goToHome() {
        this.applyWorkStatus(0);
    }

    private applyWorkStatus(workStatus: 0 | 1) {
        if (!this.chooseNpcId.length) {
            EventSystem.send("ShowTips", "Please select at least one NPC");
            return;
        }

        const names = this.resolveSelectedNpcNames();
        UGCModel.getInstance()
            .batchSetNPCWorkStatus(this.chooseNpcId, workStatus)
            .then((resp: any) => {
                if (!resp?.success) {
                    return;
                }
                const tip = this.buildWorkStatusTip(names, workStatus);
                if (tip) {
                    EventSystem.send("ShowTips", tip);
                }
                UGCModel.getInstance().listGeneratedNpcs();
            })
            .catch(() => undefined);
    }

    private resolveSelectedNpcNames(): string[] {
        const names: string[] = [];
        const seen = new Set<number>();

        for (const cell of this.npcCells) {
            const comp = cell?.getComponent(NpcWorkCell);
            if (!comp) {
                continue;
            }
            const npcId = comp.getNpcId();
            if (!this.chooseNpcId.includes(npcId) || seen.has(npcId)) {
                continue;
            }
            seen.add(npcId);
            const rawName = String(comp.npcData?.name ?? "").trim();
            names.push(rawName || `NPC ${npcId}`);
        }

        if (names.length === this.chooseNpcId.length) {
            return names;
        }

        const ugc = UGCModel.getInstance();
        const sources = [
            ...(Array.isArray(ugc.myNpcList) ? ugc.myNpcList : []),
        ];
        for (const npcId of this.chooseNpcId) {
            if (seen.has(npcId)) {
                continue;
            }
            const hit = sources.find((npc) => {
                const id = Number(npc?.id ?? npc?.npc_id ?? 0);
                return id === npcId;
            });
            const rawName = String(hit?.name ?? "").trim();
            names.push(rawName || `NPC ${npcId}`);
            seen.add(npcId);
        }
        return names;
    }

    private buildWorkStatusTip(names: string[], workStatus: 0 | 1): string {
        if (!names.length) {
            return "";
        }
        const action = workStatus === 0 ? "went home" : "went to the farm";
        if (names.length === 1) {
            return `${names[0]} ${action}`;
        }
        return `${names.join(", ")} ${action}`;
    }
}
