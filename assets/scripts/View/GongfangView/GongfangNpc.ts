import { _decorator, Component, Label, Node, ProgressBar, Sprite } from 'cc';
import { Utils } from '../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('GongfangNpc')
export class GongfangNpc extends Component {
    @property(Sprite)
    npcHead: Sprite = null;

    @property(Node)
    deleteNode: Node = null;

    @property(ProgressBar)
    tiliPorg: ProgressBar = null;

    @property(Label)
    tili: Label = null;

    @property(Node)
    emptyNode: Node = null;

    private slotIndex = -1;
    private npcId = 0;
    private unlocked = true;
    private onDelete: ((slotIndex: number) => void) | null = null;
    private onSelect: ((slotIndex: number, unlocked: boolean) => void) | null = null;

    public bindHandlers(
        slotIndex: number,
        onDelete: (slotIndex: number) => void,
        onSelect: (slotIndex: number, unlocked: boolean) => void,
    ) {
        this.setSlotIndex(slotIndex);
        this.onDelete = onDelete;
        this.onSelect = onSelect;
    }

    public setSlotIndex(slotIndex: number) {
        const safeIndex = Math.floor(Number(slotIndex));
        this.slotIndex = Number.isFinite(safeIndex) && safeIndex >= 0 ? safeIndex : -1;
    }

    public getSlotIndex(): number {
        return this.slotIndex;
    }

    public refreshEmptySlot(unlocked = true) {
        this.npcId = 0;
        this.unlocked = unlocked;
        this.node.active = true;
        if (this.emptyNode) {
            this.emptyNode.active = true;
        }
        if (this.npcHead?.node) {
            this.npcHead.node.active = false;
        }
        if (this.deleteNode) {
            this.deleteNode.active = false;
        }
        if (this.tiliPorg) {
            this.tiliPorg.node.active = true;
             this.tiliPorg.progress = 0
        }
        if (this.tili) {
            this.tili.string = '';
        }
    }

    public refreshNpc(npcData: Record<string, unknown> | null) {
        if (!npcData) {
            this.refreshEmptySlot(true);
            return;
        }

        this.npcId = Number(npcData.id ?? npcData.npc_id ?? 0);
        this.unlocked = true;
        this.node.active = true;
        if (this.emptyNode) {
            this.emptyNode.active = false;
        }
        if (this.npcHead?.node) {
            this.npcHead.node.active = true;
        }
        if (this.deleteNode) {
            this.deleteNode.active = true;
        }
        if (this.tiliPorg) {
            this.tiliPorg.node.active = true;
        }

        const stamina = Math.max(0, Number(npcData.stamina ?? 0));
        const maxStamina = Math.max(stamina, Number(npcData.max_stamina ?? 1000));
        if (this.tiliPorg) {
            this.tiliPorg.progress = maxStamina > 0 ? stamina / maxStamina : 0;
        }
        if (this.tili) {
            this.tili.string = `${stamina}/${maxStamina}`;
        }

        const headUrl = String(
            npcData.npc_sprite_url ?? npcData.avatarUrl ?? npcData.model_url ?? '',
        );
        if (this.npcHead && headUrl) {
            Utils.loadCover(headUrl, this.npcHead, 78, 78);
        }
    }

    public onClickDelete() {
        if (this.slotIndex < 0 || !this.npcId) {
            return;
        }
        this.onDelete?.(this.slotIndex);
    }

    /** 点击空槽位选择 NPC */
    public onClickSelect(_event?: unknown, slotIndexStr?: string) {
        if (slotIndexStr !== undefined && slotIndexStr !== '') {
            this.setSlotIndex(Number(slotIndexStr));
        }
        if (this.slotIndex < 0 || this.npcId) {
            return;
        }
        if (!this.unlocked) {
            EventSystem.send('ShowTips', 'Please fill the previous NPC slot first.');
            return;
        }
        this.onSelect?.(this.slotIndex, this.unlocked);
    }

    /** 兼容 prefab 点击事件 */
    public onClickEmpty() {
        this.onClickSelect();
    }
}
