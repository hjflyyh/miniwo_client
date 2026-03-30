import { _decorator, Component, instantiate, Node, UITransform } from 'cc';
import { MapModel } from '../../Model/MapModel';
import { EditHeadCell } from './EditHeadCell';
import { MapManager } from '../../../bundles/mapEditor/src/MapManager';

const { ccclass, property } = _decorator;

/**
 * 区域 NPC 数据来源（不再使用全局 chooseHeads）：
 * - 框选未确认：MapEditorUI.pendingRegionNpcIds
 * - 已落盘区域：MapEditor.mapRegions[].npcIds
 * 地图上实例节点：MapEditor.createRegionNpcDisplayNode(npcId)（优先区域格子预制体，否则 mapEditNpc / 占位格）。
 */
@ccclass('EditHead')
export class EditHead extends Component {
    @property(Node)
    public headNode: Node;

    @property(Node)
    public regionSlotsRoot: Node = null;

    private readonly _cellW = 70;
    private readonly _cellH = 70;
    private readonly _regionSlotsLocalY = -120;

    private _cellByNpcId = new Map<string, EditHeadCell>();

    start() {
        this.headNode.active = false;
        this.initHeads();
        if (!this.regionSlotsRoot?.isValid) {
            const n = new Node('regionSlots');
            n.addComponent(UITransform);
            this.node.addChild(n);
            this.regionSlotsRoot = n;
            const tr = n.getComponent(UITransform);
            tr.setContentSize(0, 0);
            n.setPosition(0, this._regionSlotsLocalY, 0);
        }
    }

    public registerCell(npcId: string, cell: EditHeadCell) {
        this._cellByNpcId.set(npcId, cell);
    }

    /** 当前编辑上下文下的 npc id 列表（待确认框选 或 已绑定 region） */
    private getCurrentEditingNpcIds(): string[] {
        const mgr = MapManager.GetInstance();
        const ui: any = mgr?.getMapEditorUI?.();
        if (!ui) {
            return [];
        }
        const bindId: string | null = ui.getPendingRegionNpcBindId?.() ?? null;
        if (bindId) {
            const editor: any = mgr.getMapEditor?.();
            const r = editor?.mapRegions?.find((x: any) => x.id === bindId);
            return Array.isArray(r?.npcIds) ? [...r.npcIds].map((id: any) => String(id)) : [];
        }
        if (ui.getPendingRegionRect?.()) {
            return ui.getPendingRegionNpcIds?.() ?? [];
        }
        return [];
    }

    public resetRegionNpcUi() {
        this.syncCellSelectedFromContext();
        this.rebuildRegionSlots();
    }

    private syncCellSelectedFromContext() {
        const ids = new Set(this.getCurrentEditingNpcIds());
        for (const [id, cell] of this._cellByNpcId) {
            cell.setSelected(ids.has(id));
        }
    }

    initHeads() {
        const list = MapModel.getInstance().mapEditNpc;
        for (let i = 0; i < list.length; i++) {
            const head = instantiate(this.headNode);
            head.active = true;
            head.parent = this.headNode.parent;
            const editHeadCell = head.getComponent(EditHeadCell) as EditHeadCell;
            editHeadCell.init(list[i]);
        }
    }

    public addHead(npcId: string | number) {
        const id = String(npcId);
        const mgr = MapManager.GetInstance();
        const ui: any = mgr?.getMapEditorUI?.();
        const pending = ui?.getPendingRegionRect?.() ?? null;
        const regionId: string | null = ui?.getPendingRegionNpcBindId?.() ?? null;

        if (pending) {
            ui.togglePendingRegionNpcId?.(id);
        } else if (regionId) {
            const editor: any = mgr.getMapEditor?.();
            const region = editor?.mapRegions?.find((r: any) => r.id === regionId);
            if (!region) {
                return;
            }
            const npcIds: string[] = Array.isArray(region.npcIds) ? region.npcIds.map((x: any) => String(x)) : [];
            const idx = npcIds.indexOf(id);
            if (idx >= 0) {
                MapModel.getInstance().removeNpcFromRegion(regionId, id);
            } else {
                const gw = region.maxX - region.minX + 1;
                const gh = region.maxY - region.minY + 1;
                if (npcIds.length >= gw * gh) {
                    EventSystem.send('ShowTips', '该区域格子已满');
                    return;
                }
                MapModel.getInstance().addNpcToRegion(regionId, id);
            }
        } else {
            return;
        }

        this.syncCellSelectedFromContext();
        this.rebuildRegionSlots();
    }

    public refreshRegionSlotsFromUi() {
        this.rebuildRegionSlots();
    }

    private rebuildRegionSlots() {
        const root = this.regionSlotsRoot;
        if (root?.isValid) {
            root.removeAllChildren();

            const mgr = MapManager.GetInstance();
            const ui: any = mgr?.getMapEditorUI?.();
            const pending = ui?.getPendingRegionRect?.() ?? null;
            const ids = this.getCurrentEditingNpcIds();
            if (pending && ids.length > 0) {
                const gw = pending.maxX - pending.minX + 1;
                const gh = pending.maxY - pending.minY + 1;
                const cellW = this._cellW;
                const cellH = this._cellH;
                const count = Math.min(ids.length, gw * gh);
                const totalW = gw * cellW;
                const totalH = gh * cellH;
                const startX = -totalW / 2 + cellW / 2;
                const startY = totalH / 2 - cellH / 2;

                const editor: any = mgr?.getMapEditor?.();
                for (let i = 0; i < count; i++) {
                    const gx = i % gw;
                    const gy = Math.floor(i / gw);
                    const slot = new Node('slot');
                    slot.addComponent(UITransform).setContentSize(cellW - 4, cellH - 4);
                    root.addChild(slot);
                    slot.setPosition(startX + gx * cellW, startY - gy * cellH, 0);
                    const npcId = ids[i];
                    const node = editor?.createRegionNpcDisplayNode?.(npcId);
                    if (node?.isValid) {
                        slot.addChild(node);
                    }
                }
            }
        }
        this.syncMapRegionNpcHeads();
    }

    private syncMapRegionNpcHeads() {
        const mgr = MapManager.GetInstance();
        const editor: any = mgr?.getMapEditor?.();
        if (!editor) {
            return;
        }
        const ui: any = mgr?.getMapEditorUI?.();
        const pending = ui?.getPendingRegionRect?.() ?? null;
        const regionId: string | null = ui?.getPendingRegionNpcBindId?.() ?? null;
        const ids = this.getCurrentEditingNpcIds();
        if (pending) {
            editor.layoutRegionNpcHeadsForPending?.(pending, ids);
        } else if (regionId) {
            editor.syncRegionNpcLayoutFromData?.(regionId);
        }
    }
}
