import {
    _decorator,
    Component,
    Label,
    Node,
    Quat,
    resources,
    Sprite,
    SpriteFrame,
    Vec3,
} from 'cc';
import {
    FARM_PLOT_FUNCTION_HIDE_OTHERS,
    FarmPlotFunctionHidePayload,
    getPlotGrowRemainSec,
} from '../../Model/Farm/FarmTypes';
import { FarmModel } from '../../Model/Farm/FarmModel';
import { getBasicSeedSpriteResourcePath } from '../../Model/Farm/FarmSeedVisual';
import { GameFarmNode } from './GameFarmNode';
const { ccclass, property } = _decorator;

const SPRITE_CHILD_NAME = 'sp';
const FUNCTION_NODE_NAME = 'function';
const TIME_NODE_NAME = 'time';

function formatGrowRemain(sec: number): string {
    const total = Math.max(0, Math.floor(sec));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    if (h > 0) {
        return `${h}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
}

@ccclass('Planting')
export class Planting extends Component {
    /** 服务端地块 farm_id */
    @property
    farmId = 0;

    @property(Node)
    fNode: Node = null;

    @property(Sprite)
    plantSprite: Sprite = null;

    @property(Label)
    timeLabel: Label = null;

    private lastSeedKey = '';
    private growExpiredNotified = false;
    private countdownTimer: ReturnType<typeof setInterval> | null = null;
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
        if (!this.timeLabel) {
            this.timeLabel = this.node.getChildByName(TIME_NODE_NAME)?.getComponent(Label) ?? null;
        }
        EventSystem.addListent(FARM_PLOT_FUNCTION_HIDE_OTHERS, this.onHideOthersRequest, this);
        this.setFunctionPanelVisible(false);
    }

    onDestroy() {
        this.stopCountdownTick();
        this.disposeFunctionPanel();
    }

    /** 销毁 Planting 前调用：收起 overlay 上的 function，避免引擎排序报错 */
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

    /** 绑定农田 id 并刷新作物贴图（basicSeeds.icon + "_1"）与倒计时 */
    setup(farmId: number, seedKey?: string) {
        const id = Math.floor(Number(farmId) || 0);
        this.farmId = id;
        const key =
            seedKey != null
                ? String(seedKey).trim()
                : String(FarmModel.getInstance().getPlot(id)?.seed ?? '').trim();
        if (!key) {
            this.clearSprite();
            this.growExpiredNotified = false;
            this.refreshCountdownDisplay();
            this.stopCountdownTick();
            return;
        }
        this.growExpiredNotified = false;
        if (key !== this.lastSeedKey) {
            this.lastSeedKey = key;
            this.loadPlantSprite(key);
        }
        this.refreshCountdownDisplay();
        this.startCountdownTick();
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
        this.refreshCountdownDisplay();
    }

    /** 隐藏场景中所有地块 function 面板 */
    public static hideAllFunctionPanels() {
        EventSystem.send(FARM_PLOT_FUNCTION_HIDE_OTHERS, {});
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

    private startCountdownTick() {
        this.stopCountdownTick();
        this.countdownTimer = setInterval(() => {
            if (!this.node?.isValid) {
                this.stopCountdownTick();
                return;
            }
            this.refreshCountdownDisplay();
        }, 1000);
    }

    private stopCountdownTick() {
        if (this.countdownTimer != null) {
            clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
    }

    private refreshCountdownDisplay() {
        if (!this.timeLabel?.isValid) {
            return;
        }
        const plot = FarmModel.getInstance().getPlot(this.farmId);
        const nowSec = FarmModel.getInstance().getNowUnixSec();
        const endSec = getPlotGrowRemainSec(plot);
        if (endSec <= 0) {
            this.timeLabel.string = '--:--';
            return;
        }
        const remain = endSec - nowSec;
        if (remain <= 0) {
            this.timeLabel.string = '00:00';
            this.stopCountdownTick();
            if (!this.growExpiredNotified) {
                this.growExpiredNotified = true;
                FarmModel.getInstance().notifyGrowCountdownEnded(this.farmId);
            }
            return;
        }
        this.timeLabel.string = formatGrowRemain(remain);
    }

    private loadPlantSprite(seedKey: string) {
        const sprite = this.plantSprite;
        if (!sprite) {
            return;
        }
        const path = getBasicSeedSpriteResourcePath(seedKey);
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
