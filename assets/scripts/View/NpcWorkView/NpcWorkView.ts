import { _decorator, Component, instantiate, Layout, Node } from 'cc';
import { UGCModel } from '../../Model/UGCModel';
import { NpcWorkCell } from './NpcWorkCell';
const { ccclass, property } = _decorator;

@ccclass('NpcWorkView')
export class NpcWorkView extends Component {
    public chooseNpcId: number[] = [];

    @property(Node)
    public npcCell: Node = null;

    private npcCells: Node[] = [];

    start() {
        if (this.npcCell) {
            this.npcCell.active = false;
        }
        EventSystem.addListent("OnRefreshGeneratedMyNpcList", this.onRefreshMyNpcList, this);
        EventSystem.addListent("OnNpcWorkCellClick", this.onNpcWorkCellClick, this);
        UGCModel.getInstance().listGeneratedNpcs();
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
            selected: this.chooseNpcId.includes(npcId),
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
    }

    private refreshNpcList(npcList: any[]) {
        if (!this.npcCell?.isValid) {
            return;
        }
        const content = this.npcCell.parent;
        if (!content) {
            return;
        }

        while (this.npcCells.length < npcList.length) {
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
            if (i < npcList.length) {
                cell.active = true;
                const npc = npcList[i];
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
    }
}
