import { _decorator, Component, instantiate, Label, Layout, Node, ProgressBar, Sprite, UITransform } from 'cc';
import { UGCModel } from '../../Model/UGCModel';
import { WorkshopModel } from '../../Model/Workshop/WorkshopModel';
import { WORKSHOP_EVENT_UPDATED } from '../../Model/Workshop/WorkshopTypes';
import { Utils } from '../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('GongfangNpcView')
export class GongfangNpcView extends Component {
    @property(Node)
    npcCell: Node = null;

    private slotIndex = -1;
    private readonly npcCells: Node[] = [];

    onLoad() {
        this.resolveRefs();
        if (this.npcCell?.isValid) {
            this.npcCell.active = false;
        }
        if (this.node.active) {
            this.node.active = false;
        }
    }

    onEnable() {
        EventSystem.addListent('OnRefreshMyNpcList', this.onNpcListUpdated, this);
        EventSystem.addListent(WORKSHOP_EVENT_UPDATED, this.onNpcListUpdated, this);
        this.scheduleRefresh();
    }

    onDisable() {
        // EventSystem.removeListent('OnRefreshMyNpcList', this.onNpcListUpdated, this);
        // EventSystem.removeListent(WORKSHOP_EVENT_UPDATED, this.onNpcListUpdated, this);
        this.unschedule(this.doRefresh);
    }

    public show(slotIndex: number) {
        const safeIndex = Math.floor(Number(slotIndex));
        if (!Number.isFinite(safeIndex) || safeIndex < 0) {
            console.warn('[GongfangNpcView] invalid slot index', slotIndex);
            return;
        }
        this.slotIndex = safeIndex;
        this.resolveRefs();
        if (!UGCModel.getInstance().myNpcList?.length) {
            UGCModel.getInstance().listGeneratedNpcs();
        }
        if (this.node.active) {
            this.scheduleRefresh();
            return;
        }
        this.node.active = true;
    }

    public hide() {
        this.node.active = false;
    }

    public refresh() {
        this.scheduleRefresh();
    }

    onClick() {
        this.hide();
    }

    private onNpcListUpdated = () => {
        if (this.node?.active) {
            this.scheduleRefresh();
        }
    };

    private scheduleRefresh() {
        this.unschedule(this.doRefresh);
        this.scheduleOnce(this.doRefresh, 0);
    }

    private doRefresh = () => {
        if (!this.node?.active) {
            return;
        }
        this.resolveRefs();
        this.refreshNpcList();
        this.updateScrollLayout();
    };

    private refreshNpcList() {
        if (!this.npcCell?.isValid) {
            return;
        }

        const content = this.npcCell.parent;
        if (!content?.isValid) {
            return;
        }

        this.npcCell.active = false;
        this.clearCells(this.npcCells);

        const npcList = this.getSelectableNpcs();
        for (let i = 0; i < npcList.length; i++) {
            const cell = instantiate(this.npcCell);
            cell.active = true;
            cell.setParent(content);
            cell.name = `gongfang_npc_${this.getNpcId(npcList[i])}`;
            this.ensureCellTouchable(cell);
            this.bindNpcCell(cell, npcList[i]);
            this.npcCells.push(cell);
        }
    }

    private bindNpcCell(cell: Node, npc: Record<string, unknown>) {
        const iconSprite = cell.getChildByName('icon')?.getComponent(Sprite) ?? null;
        const tiliProg = cell.getChildByName('tiliProg')?.getComponent(ProgressBar) ?? null;
        const tiliLabel = cell.getChildByPath('tiliProg/tiliLabel')?.getComponent(Label) ?? null;

        const stamina = Math.max(0, Number(npc.stamina ?? 0));
        const maxStamina = Math.max(stamina, Number(npc.max_stamina ?? 1000));
        if (tiliProg) {
            tiliProg.progress = maxStamina > 0 ? stamina / maxStamina : 0;
        }
        if (tiliLabel) {
            tiliLabel.string = `${stamina}/${maxStamina}`;
        }

        const headUrl = String(
            npc.npc_sprite_url ?? npc.avatarUrl ?? npc.model_url ?? '',
        );
        if (iconSprite && headUrl) {
            Utils.loadCover(headUrl, iconSprite, 68, 68);
        }

        cell.off(Node.EventType.TOUCH_END);
        cell.on(Node.EventType.TOUCH_END, () => {
            this.onNpcCellClick(npc);
        }, this);
    }

    private onNpcCellClick(npc: Record<string, unknown>) {
        const npcId = this.getNpcId(npc);
        const slotIndex = Math.floor(Number(this.slotIndex));
        if (!npcId || !Number.isFinite(slotIndex) || slotIndex < 0) {
            EventSystem.send('ShowTips', 'invalid slot index');
            return;
        }
        const stamina = Math.max(0, Number(npc.stamina ?? 0));
        if (stamina < 5) {
            EventSystem.send('ShowTips', 'Need at least 5 stamina.');
            return;
        }
        const result = WorkshopModel.getInstance().assignNpc(slotIndex, npcId);
        if (result) {
            this.hide();
        }
    }

    private getSelectableNpcs(): Record<string, unknown>[] {
        const state = WorkshopModel.getInstance().getState();
        const assignedIds = new Set<number>();
        for (const slot of state?.npc_slots ?? []) {
            const npcId = Number(slot?.npc_id ?? 0);
            if (npcId > 0) {
                assignedIds.add(npcId);
            }
        }

        const list = UGCModel.getInstance().myNpcList ?? [];
        const result: Record<string, unknown>[] = [];
        for (let i = 0; i < list.length; i++) {
            const npc = list[i] as Record<string, unknown>;
            const npcId = this.getNpcId(npc);
            if (!npcId) {
                continue;
            }
            if (assignedIds.has(npcId)) {
                continue;
            }
            if (Number(npc.work_status ?? 0) !== 0) {
                continue;
            }
            result.push(npc);
        }
        return result;
    }

    private getNpcId(npc: Record<string, unknown>): number {
        return Math.floor(Number(npc?.id ?? npc?.npc_id ?? 0));
    }

    private resolveRefs() {
        if (!this.npcCell?.isValid) {
            this.npcCell = this.node.getChildByPath('Sprite-001/ScrollView/view/content/Node');
        }
    }

    private updateScrollLayout() {
        const content = this.npcCell?.parent;
        content?.getComponent(Layout)?.updateLayout();
    }

    private clearCells(cells: Node[]) {
        for (let i = 0; i < cells.length; i++) {
            cells[i]?.destroy();
        }
        cells.length = 0;
    }

    private ensureCellTouchable(cell: Node) {
        if (!cell.getComponent(UITransform)) {
            cell.addComponent(UITransform);
        }
    }
}
