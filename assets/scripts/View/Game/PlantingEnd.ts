import { _decorator, Component, Node, Quat, resources, Sprite, SpriteFrame, Vec3 } from 'cc';
import {
    FARM_PLOT_FUNCTION_HIDE_OTHERS,
    FarmPlotFunctionHidePayload,
} from '../../Model/Farm/FarmTypes';
import { getBasicSeedMatureSpriteResourcePath } from '../../Model/Farm/FarmSeedVisual';
import { FarmModel } from '../../Model/Farm/FarmModel';
import { GameFarmNode } from './GameFarmNode';
const { ccclass, property } = _decorator;

const SPRITE_CHILD_NAME = 'sp';
const FUNCTION_NODE_NAME = 'function';

/**
 * 成熟可收获地块叠加物：绑定服务端 farm_id，在 sp 上显示 basicSeeds.icon + "_2" 作物图。
 */
@ccclass('PlantingEnd')
export class PlantingEnd extends Component {
    @property(Node)
    fNode: Node = null;

    /** 服务端地块 farm_id */
    @property
    farmId = 0;

    @property(Sprite)
    plantSprite: Sprite = null;

    private lastSeedKey = '';
    private harvesting = false;
    private fNodeLifted = false;
    private readonly fNodeHomeLpos = new Vec3();
    private readonly fNodeHomeLrot = new Quat();
    private readonly fNodeHomeLscale = new Vec3();
    private readonly fNodeWorldPos = new Vec3();

    onLoad() {
        if (!this.fNode) {
            this.fNode = this.node.getChildByName(FUNCTION_NODE_NAME);
        }
        if (!this.plantSprite) {
            const spNode = this.node.getChildByName(SPRITE_CHILD_NAME);
            this.plantSprite = spNode?.getComponent(Sprite) ?? null;
        }
        EventSystem.addListent(FARM_PLOT_FUNCTION_HIDE_OTHERS, this.onHideOthersRequest, this);
        this.setFunctionPanelVisible(false);
    }

    onDestroy() {
        this.disposeFunctionPanel();
    }

    /** 销毁 PlantingEnd 前调用：收起 overlay 上的 function，避免引擎排序报错 */
    public disposeFunctionPanel() {
        const panel = this.fNode;
        if (!panel?.isValid) {
            this.fNodeLifted = false;
            return;
        }
        panel.active = false;
        if (this.fNodeLifted) {
            panel.removeFromParent();
            panel.destroy();
            this.fNodeLifted = false;
        }
    }
    
    async onClickShouhuo() {
        const farmId = Math.floor(Number(this.farmId) || 0);
        if (farmId <= 0) {
            return;
        }
        if (this.harvesting) {
            return;
        }
        const model = FarmModel.getInstance();
        if (!model.isPlotHarvestableById(farmId)) {
            EventSystem.send('ShowTips', 'The crops are not yet ripe.');
            return;
        }

        this.harvesting = true;
        try {
            const result = await model.harvest(farmId);
            if (result.ok) {
                this.setFunctionPanelVisible(false);
                EventSystem.send(FARM_PLOT_FUNCTION_HIDE_OTHERS, {});
                EventSystem.send('ShowTips', 'The harvesting was successful.');
            } else {
                EventSystem.send('ShowTips', result.message ?? 'The harvesting failed.');
            }
        } finally {
            this.harvesting = false;
        }
    }

    /** 点击 Button：切换 function；展开时广播隐藏其它地块 */
    onClick() {
        if (this.isFunctionPanelVisible()) {
            this.setFunctionPanelVisible(false);
            return;
        }
        EventSystem.send(FARM_PLOT_FUNCTION_HIDE_OTHERS, {
            except: this,
        } as FarmPlotFunctionHidePayload);
        this.setFunctionPanelVisible(true);
    }

    /** 绑定农田 id 并刷新作物贴图 */
    setup(farmId: number, seedKey?: string) {
        const id = Math.floor(Number(farmId) || 0);
        this.farmId = id;
        const key =
            seedKey != null
                ? String(seedKey).trim()
                : String(FarmModel.getInstance().getPlot(id)?.seed ?? '').trim();
        if (!key) {
            this.clearSprite();
            return;
        }
        if (key === this.lastSeedKey) {
            return;
        }
        this.lastSeedKey = key;
        this.loadPlantSprite(key);
    }

    private onHideOthersRequest(payload?: FarmPlotFunctionHidePayload) {
        if (payload?.except === this) {
            return;
        }
        this.setFunctionPanelVisible(false);
    }

    private isFunctionPanelVisible(): boolean {
        return !!this.fNode?.isValid && this.fNode.active;
    }

    private setFunctionPanelVisible(visible: boolean) {
        const panel = this.fNode;
        if (!panel?.isValid) {
            return;
        }
        if (visible) {
            this.liftFunctionPanelToOverlay();
            panel.active = true;
        } else {
            panel.active = false;
            this.restoreFunctionPanelParent();
        }
    }

    private liftFunctionPanelToOverlay() {
        const panel = this.fNode;
        if (!panel?.isValid || this.fNodeLifted) {
            return;
        }
        const overlay = this.resolveFunctionOverlayRoot();
        if (!overlay?.isValid) {
            return;
        }

        panel.getPosition(this.fNodeHomeLpos);
        panel.getRotation(this.fNodeHomeLrot);
        panel.getScale(this.fNodeHomeLscale);
        panel.getWorldPosition(this.fNodeWorldPos);

        panel.setParent(overlay);
        panel.setWorldPosition(this.fNodeWorldPos);
        panel.setSiblingIndex(overlay.children.length - 1);
        this.fNodeLifted = true;
    }

    private restoreFunctionPanelParent() {
        const panel = this.fNode;
        if (!panel?.isValid || !this.fNodeLifted) {
            return;
        }
        if (!this.node?.isValid) {
            panel.removeFromParent();
            panel.destroy();
            this.fNodeLifted = false;
            return;
        }
        panel.setParent(this.node);
        panel.setPosition(this.fNodeHomeLpos);
        panel.setRotation(this.fNodeHomeLrot);
        panel.setScale(this.fNodeHomeLscale);
        this.fNodeLifted = false;
    }

    private resolveFunctionOverlayRoot(): Node | null {
        let current: Node | null = this.node.parent;
        while (current) {
            const farmNode = current.getComponent(GameFarmNode);
            if (farmNode) {
                return farmNode.getFunctionOverlayRoot();
            }
            current = current.parent;
        }
        return null;
    }

    private loadPlantSprite(seedKey: string) {
        const sprite = this.plantSprite;
        if (!sprite) {
            return;
        }
        const path = getBasicSeedMatureSpriteResourcePath(seedKey);
        if (!path) {
            return;
        }
        resources.load(path, SpriteFrame, (err, sf) => {
            if (!err && sf && sprite.isValid && this.lastSeedKey === seedKey) {
                sprite.spriteFrame = sf;
            }
        });
    }

    private clearSprite() {
        this.lastSeedKey = '';
        if (this.plantSprite?.isValid) {
            this.plantSprite.spriteFrame = null;
        }
    }
}
