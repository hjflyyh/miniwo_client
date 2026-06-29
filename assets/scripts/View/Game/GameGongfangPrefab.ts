import { _decorator, Component, Label, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { BagModel } from '../../Model/BagModel';
import { MapModel } from '../../Model/MapModel';
import { WorkshopModel } from '../../Model/Workshop/WorkshopModel';
import { WORKSHOP_EVENT_UPDATED } from '../../Model/Workshop/WorkshopTypes';
const { ccclass, property } = _decorator;

type WorkshopLevelCfg = {
    required_map_level?: number;
    build_items?: string;
    upgrade_items?: string;
};

type ItemCost = {
    item_id: number;
    count: number;
};

const MAX_WORKSHOP_LEVEL = 4;

@ccclass('GameGongfangPrefab')
export class GameGongfangPrefab extends Component {
    @property(Node)
    lockNode: Node = null;

    @property(Node)
    upNode: Node = null;

    @property(Label)
    upLabel: Label = null;

    start() {
        if (this.upNode) {
            this.upNode.active = false;
        }
        EventSystem.addListent(WORKSHOP_EVENT_UPDATED, this.refreshDisplay, this);
        this.refreshDisplay();
    }

    onDestroy() {
        EventSystem.remove(this);
    }

    onClick() {
        const level = this.getWorkshopLevel();
        if (level >= MAX_WORKSHOP_LEVEL) {
            EventSystem.send('OpenGameGongfang');
            return;
        }

        this.refreshUpLabel();
        if (this.upNode) {
            if(this.upNode.active){
                this.upNode.active = false;
            }else{
                this.upNode.active = true;
            }
        }
    }

    onClickHide() {
        if (this.upNode) {
            this.upNode.active = false;
        }
    }

    onClickUp() {
        const level = this.getWorkshopLevel();
        if (level >= MAX_WORKSHOP_LEVEL) {
            return;
        }

        const targetLevel = level === 0 ? 1 : level + 1;
        const cfg = this.getLevelCfg(targetLevel);
        if (!cfg) {
            return;
        }

        const requiredMap = Number(cfg.required_map_level) || 1;
        const mapLevel = this.getMapLevel();
        const costStr = level === 0 ? cfg.build_items : cfg.upgrade_items;
        const costText = this.formatCostText(costStr);

        if (mapLevel < requiredMap) {
            AppConst.PanelManager.openView('res/View/Common/CheckCancelCommon', {
                showText: `The map level is insufficient. It needs to be increased to... Lv.${requiredMap}`,
            });
            return;
        }

        const costs = this.parseCostItems(costStr);
        for (let i = 0; i < costs.length; i++) {
            const cost = costs[i];
            const owned = BagModel.getInstance().getItemCount(cost.item_id);
            if (owned < cost.count) {
                const itemName = this.getItemDisplayName(cost.item_id);
                EventSystem.send('ShowTips', `${itemName} is insufficient, Needs: ${cost.count}`);
                return;
            }
        }

        const actionText = level === 0 ? 'build' : 'upgrade';
        AppConst.PanelManager.openView('res/View/Common/CheckCancelCommon', {
            showText: `Map Lv.${requiredMap} required. ${costText}. Confirm to ${actionText} the workshop?`,
            callback: this.confirmBuildOrUpgrade,
            callbackParent: this,
        });
    }

    onEnter() {
        const level = this.getWorkshopLevel();
        if (level <= 0) {
            EventSystem.send('ShowTips', 'Workshop not unlocked');
            return;
        }
        this.onClickHide();
        EventSystem.send('OpenGameGongfang');
    }

    private refreshDisplay() {
        const level = this.getWorkshopLevel();
        if (this.lockNode) {
            this.lockNode.active = level <= 0;
        }
    }

    private refreshUpLabel() {
        const level = this.getWorkshopLevel();
        const targetLevel = level === 0 ? 1 : Math.min(level + 1, MAX_WORKSHOP_LEVEL);
        const cfg = this.getLevelCfg(targetLevel);
        const requiredMap = Number(cfg?.required_map_level) || 1;

        if (!this.upLabel) {
            return;
        }

        if (level <= 0) {
            this.upLabel.string = `Unlock at Map Lv.${requiredMap}`;
        } else {
            this.upLabel.string = `Upgrade at Map Lv.${requiredMap}`;
        }
    }

    private async confirmBuildOrUpgrade() {
        const level = this.getWorkshopLevel();
        const model = WorkshopModel.getInstance();
        const next = level === 0 ? await model.build() : await model.upgrade();
        if (!next) {
            return;
        }
        this.onClickHide();
        this.refreshDisplay();
        EventSystem.send(
            'ShowTips',
            level === 0 ? 'Workshop built successfully.' : 'Workshop upgraded successfully.',
        );
    }

    private getWorkshopLevel(): number {
        return Math.floor(Number(WorkshopModel.getInstance().getState()?.level) || 0);
    }

    private getMapLevel(): number {
        const stateLevel = WorkshopModel.getInstance().getState()?.map_level;
        if (stateLevel != null) {
            return Math.floor(Number(stateLevel) || 0);
        }
        const mapModel = MapModel.getInstance();
        const level =
            mapModel.my_map_data?.map_level ??
            mapModel.map_detail?.map_level ??
            mapModel.showMatchPayLoad?.map_level;
        return Math.floor(Number(level) || 0);
    }

    private getLevelCfg(level: number): WorkshopLevelCfg | null {
        return AppConst.JSONManager?.getItem?.('workshopLevel', String(level)) as WorkshopLevelCfg | null;
    }

    private parseCostItems(raw: string | undefined): ItemCost[] {
        if (!raw) {
            return [];
        }
        return raw
            .split('|')
            .map((part) => {
                const split = part.split('#');
                return {
                    item_id: Math.floor(Number(split[0]) || 0),
                    count: Math.floor(Number(split[1]) || 0),
                };
            })
            .filter((item) => item.item_id > 0 && item.count > 0);
    }

    private formatCostText(raw: string | undefined): string {
        const costs = this.parseCostItems(raw);
        if (!costs.length) {
            return 'No items required';
        }
        return costs
            .map((cost) => `${cost.count} ${this.getItemDisplayName(cost.item_id)}`)
            .join(', ');
    }

    private getItemDisplayName(itemId: number): string {
        const cfg = AppConst.JSONManager.getItem('item', `${itemId}`);
        return cfg?.name_en || cfg?.name_cn || 'item';
    }
}
