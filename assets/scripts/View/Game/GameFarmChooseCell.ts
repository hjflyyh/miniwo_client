import { _decorator, Component, Label, resources, Sprite, SpriteFrame } from 'cc';
import { FarmModel } from '../../Model/Farm/FarmModel';
import { isPlotSeedEmpty } from '../../Model/Farm/FarmTypes';
const { ccclass, property } = _decorator;

/** 种子列表项被点击（校验地块 seed 为空后由 GameView 发 farm_grow） */
export const GAME_FARM_SEED_CHOOSE_EVENT = 'GameFarmSeedChoose';

export type GameFarmSeedChoosePayload = {
    itemId: number;
    /** basicSeeds / basicCrops 配置 key，作为 farm_grow 的 seed */
    seedKey: number;
};

@ccclass('GameFarmChooseCell')
export class GameFarmChooseCell extends Component {
    @property(Sprite)
    spriteRoot: Sprite = null;

    @property(Label)
    shownumber: Label = null;

    private itemId = 0;
    private seedKey = 0;
    private farmId: number | null = null;
    itemCount = 0;

    setFarmId(farmId: number | null) {
        const id = farmId != null ? Number(farmId) : null;
        this.farmId =
            id != null && Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
    }

    refreshNode(itemId: number, count: number, seedKey: number, _displayName?: string) {
        this.itemId = itemId;
        this.seedKey = seedKey;
        this.setCount(count);

        if (this.spriteRoot) {
            this.spriteRoot.enabled = false;
        }
        resources.load(`UITexture/itemIcon/${itemId}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (!this.spriteRoot?.isValid) {
                return;
            }
            if (!err && sf) {
                this.spriteRoot.spriteFrame = sf;
                this.spriteRoot.enabled = true;
            }
        });
    }

    /** 仅刷新背包数量显示 */
    setCount(count: number) {
        this.itemCount = Math.max(0, Number(count) || 0);
        if (this.shownumber) {
            this.shownumber.string = `x${this.itemCount}`;
        }
    }

    async onClick() {
        if (this.itemCount <= 0) {
            EventSystem.send('ShowTips', 'Insufficient seeds');
            return;
        }
        if (this.farmId == null) {
            EventSystem.send('ShowTips', 'Please select a farm first');
            return;
        }

        await FarmModel.getInstance().refreshFarms();
        const plot = FarmModel.getInstance().getPlot(this.farmId);
        if (!isPlotSeedEmpty(plot)) {
            EventSystem.send('ShowTips', 'The plot already has a crop');
            return;
        }

        EventSystem.send(GAME_FARM_SEED_CHOOSE_EVENT, {
            itemId: this.itemId,
            seedKey: this.seedKey,
        } satisfies GameFarmSeedChoosePayload);
    }
}
