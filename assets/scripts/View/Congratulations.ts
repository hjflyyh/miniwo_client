import { _decorator, Component, instantiate, Label, Node, resources, sp, Sprite, SpriteFrame, UITransform } from 'cc';
import { AppConst } from '../AppConst';
import { BaseView } from './BaseView';
const { ccclass, property } = _decorator;

const OPEN_ANIM = 'animation1';
const LOOP_ANIM = 'animation2';
const MAX_REWARD_CELLS = 5;
const REWARD_CELL_GAP = 16;

type RewardItemData = {
    item_id?: number;
    id?: number;
    count?: number;
    num?: number;
};

@ccclass('Congratulations')
export class Congratulations extends Component {
    @property(sp.Skeleton)
    openSp: sp.Skeleton = null;

    @property(Node)
    rewardNode: Node = null;

    @property(Node)
    itemCell: Node = null;

    /** rewardNode 延迟显示时间（秒） */
    @property
    rewardShowDelay = 1;

    /** 至少等待该时间（秒）后才允许关闭 */
    @property
    minCloseDelay = 3;

    private allItems: RewardItemData[] = [];
    private displayStartIndex = 0;
    private readonly rewardCells: Node[] = [];
    private canClose = false;

    start() {
        this.onStart();
    }

    onStart() {
        this.resolveRewardRefs();
        this.allItems = this.normalizeOpenParam(this.node['_openParam']);
        if (!this.allItems.length) {
            this.allItems = [{ item_id: 104, count: 10 }];
        }
        this.displayStartIndex = 0;
        this.clearRewardCells();
        if (this.rewardNode?.isValid) {
            this.rewardNode.active = false;
        }
        if (this.itemCell?.isValid) {
            this.itemCell.active = false;
        }
        this.scheduleRewardShow();
        this.scheduleMinCloseDelay();
    }

    onEnable() {
        this.playOpenThenLoop();
    }

    onDisable() {
        this.unschedule(this.showRewardByTimer);
        this.unschedule(this.enableClose);
        if (this.openSp?.isValid) {
            this.openSp.setCompleteListener(null);
        }
    }

    /** 点击：未展示完则翻页，全部展示完后关闭界面 */
    onClick() {
        if (this.hasMoreToShow()) {
            this.displayStartIndex += this.getCurrentBatchSize();
            this.refreshRewardPage();
            return;
        }
        if (!this.canClose) {
            return;
        }
        this.closeView();
    }

    private resolveRewardRefs() {
        if (!this.rewardNode?.isValid) {
            this.rewardNode = this.node.getChildByName('reward');
        }
        if (!this.itemCell?.isValid && this.rewardNode?.isValid) {
            this.itemCell = this.rewardNode.getChildByName('cell');
        }
    }

    private normalizeOpenParam(param: unknown): RewardItemData[] {
        if (Array.isArray(param)) {
            return param as RewardItemData[];
        }
        if (param && typeof param === 'object' && Array.isArray((param as { items?: unknown }).items)) {
            return (param as { items: RewardItemData[] }).items;
        }
        return [];
    }

    private hasMoreToShow(): boolean {
        return this.displayStartIndex + this.getCurrentBatchSize() < this.allItems.length;
    }

    private getCurrentBatchSize(): number {
        return Math.min(MAX_REWARD_CELLS, Math.max(0, this.allItems.length - this.displayStartIndex));
    }

    private refreshRewardPage() {
        this.resolveRewardRefs();
        if (!this.rewardNode?.isValid || !this.itemCell?.isValid) {
            return;
        }

        const batch = this.allItems.slice(
            this.displayStartIndex,
            this.displayStartIndex + MAX_REWARD_CELLS,
        );
        this.clearRewardCells();

        const cellWidth = this.getCellLayoutWidth(this.itemCell);
        const totalWidth = batch.length * cellWidth + Math.max(0, batch.length - 1) * REWARD_CELL_GAP;
        const startX = -totalWidth / 2 + cellWidth / 2;

        for (let i = 0; i < batch.length; i++) {
            const cell = instantiate(this.itemCell);
            cell.active = true;
            cell.setParent(this.rewardNode);
            cell.setPosition(startX + i * (cellWidth + REWARD_CELL_GAP), 0, 0);
            this.bindRewardCell(cell, batch[i]);
            this.rewardCells.push(cell);
        }

        this.rewardNode.active = batch.length > 0;
    }

    private getCellLayoutWidth(template: Node): number {
        const itemNode = template.getChildByName('item') ?? template.getChildByName('Sprite');
        const itemWidth = itemNode?.getComponent(UITransform)?.width;
        if (itemWidth && itemWidth > 0) {
            return itemWidth;
        }
        return template.getComponent(UITransform)?.width || 143;
    }

    private bindRewardCell(cell: Node, data: RewardItemData) {
        const itemId = Math.floor(Number(data?.item_id ?? data?.id) || 0);
        const count = Math.max(0, Math.floor(Number(data?.count ?? data?.num) || 0));

        const iconSprite =
            cell.getChildByPath('item/icon')?.getComponent(Sprite) ??
            cell.getChildByName('Sprite')?.getChildByName('icon')?.getComponent(Sprite) ??
            null;
        const numLabel = cell.getChildByName('num')?.getComponent(Label) ?? null;

        if (numLabel) {
            numLabel.string = String(count);
        }
        this.loadItemIcon(iconSprite, itemId);
    }

    private loadItemIcon(sprite: Sprite | null, itemId: number) {
        if (!sprite?.isValid || !Number.isFinite(itemId) || itemId <= 0) {
            return;
        }
        resources.load(`UITexture/itemIcon/${itemId}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (!err && sf && sprite?.isValid) {
                sprite.spriteFrame = sf;
                return;
            }
            resources.load(`common/image/item_${itemId}/spriteFrame`, SpriteFrame, (err2, sf2) => {
                if (!err2 && sf2 && sprite?.isValid) {
                    sprite.spriteFrame = sf2;
                }
            });
        });
    }

    private clearRewardCells() {
        for (let i = 0; i < this.rewardCells.length; i++) {
            this.rewardCells[i]?.destroy();
        }
        this.rewardCells.length = 0;
    }

    private closeView() {
        const baseView = this.getComponent(BaseView);
        if (baseView?.onClickClose()) {
            return;
        }
        if (baseView) {
            AppConst.PanelManager.CloseView(baseView);
        }
    }

    private resolveSpine(): sp.Skeleton | null {
        if (this.openSp?.isValid) {
            return this.openSp;
        }
        this.openSp = this.getComponentInChildren(sp.Skeleton);
        return this.openSp?.isValid ? this.openSp : null;
    }

    private getMinCloseDelay(): number {
        const param = this.node['_openParam'];
        if (param && typeof param === 'object' && !Array.isArray(param)) {
            const delay = Number((param as { minCloseDelay?: number; closeDelay?: number }).minCloseDelay
                ?? (param as { closeDelay?: number }).closeDelay);
            if (Number.isFinite(delay) && delay >= 0) {
                return delay;
            }
        }
        return this.minCloseDelay;
    }

    private scheduleMinCloseDelay() {
        this.canClose = false;
        this.unschedule(this.enableClose);
        this.scheduleOnce(this.enableClose, this.getMinCloseDelay());
    }

    private enableClose = () => {
        this.canClose = true;
    };

    private getRewardShowDelay(): number {
        const param = this.node['_openParam'];
        if (param && typeof param === 'object' && !Array.isArray(param)) {
            const delay = Number((param as { rewardShowDelay?: number; showDelay?: number }).rewardShowDelay
                ?? (param as { showDelay?: number }).showDelay);
            if (Number.isFinite(delay) && delay >= 0) {
                return delay;
            }
        }
        return this.rewardShowDelay;
    }

    private scheduleRewardShow() {
        this.unschedule(this.showRewardByTimer);
        this.scheduleOnce(this.showRewardByTimer, this.getRewardShowDelay());
    }

    private showRewardByTimer = () => {
        this.refreshRewardPage();
    };

    private playOpenThenLoop() {
        const spine = this.resolveSpine();
        if (!spine) {
            return;
        }
        spine.setCompleteListener(this.onOpenComplete);
        spine.setAnimation(0, OPEN_ANIM, false);
    }

    private onOpenComplete = (entry?: sp.spine.TrackEntry) => {
        const spine = this.openSp;
        if (!spine?.isValid) {
            return;
        }
        if (entry?.animation?.name !== OPEN_ANIM) {
            return;
        }
        spine.setCompleteListener(null);
        spine.setAnimation(0, LOOP_ANIM, true);
    };
}
