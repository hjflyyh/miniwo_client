import { _decorator, Component, Label, Node } from 'cc';
import { GenericSpritesheetAnimator, ZUOZHU_ACTION_HORIZONTAL_SLICES } from '../../Utils/GenericSpritesheetAnimator';
const { ccclass, property } = _decorator;

/** NPC 体力上限 */
const MAX_STAMINA = 1000;
/** attributes 中体力值字段 id */
const STAMINA_ATTRIBUTE_ID = 102;

@ccclass('NpcWorkAnimCell')
export class NpcWorkAnimCell extends Component {
    @property(GenericSpritesheetAnimator)
    public genericSpritesheetAnimator: GenericSpritesheetAnimator = null;

    @property([Node])
    public tiliNodes: Node[] = [];

    @property(Label)
    public tiliLabel: Label = null;

    refreshData(data: any) {
        if (!data) {
            this.refreshTiliNodes(0);
            return;
        }

        if (data.sprite_animations?.idle_url && this.genericSpritesheetAnimator) {
            this.genericSpritesheetAnimator.loadAndPlay(
                data.sprite_animations.idle_url,
                "idle",
                ZUOZHU_ACTION_HORIZONTAL_SLICES["idle"],
                () => undefined,
            );
        }

        const stamina = this.getStaminaValue(data);
        if (this.tiliLabel) {
            this.tiliLabel.string = String(stamina);
        }
        this.refreshTiliNodes(stamina);
    }

    /** attributes[102] 体力值 */
    private getStaminaValue(data: any): number {
        const attrs = data?.attributes;
        if (attrs == null || typeof attrs !== "object") {
            return 0;
        }
        const raw = attrs[STAMINA_ATTRIBUTE_ID] ?? attrs[String(STAMINA_ATTRIBUTE_ID)];
        const value = Number(raw);
        if (!Number.isFinite(value)) {
            return 0;
        }
        return Math.max(0, Math.min(MAX_STAMINA, Math.floor(value)));
    }

    /**
     * 按当前体力 / 上限 1000 计算应点亮的格子数。
     * 例如 7 格：500 体力 → 4 格，1000 → 7 格，0 → 0 格。
     */
    private refreshTiliNodes(currentStamina: number) {
        const totalCells = this.tiliNodes.length;
        if (totalCells <= 0) {
            return;
        }

        const clamped = Math.max(0, Math.min(MAX_STAMINA, Number(currentStamina) || 0));
        let filledCount = 0;
        if (clamped > 0) {
            filledCount = Math.ceil((clamped / MAX_STAMINA) * totalCells);
            filledCount = Math.max(1, Math.min(totalCells, filledCount));
        }

        for (let i = 0; i < totalCells; i++) {
            const node = this.tiliNodes[i];
            if (node?.isValid) {
                node.active = i < filledCount;
            }
        }
    }
}

