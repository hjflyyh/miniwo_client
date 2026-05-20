import { _decorator, Button, Component, EventMouse, EventTouch, Input, input, Node, sys, tween, UITransform, v3, Vec2, Vec3 } from 'cc';
import { MapManager } from '../../../bundles/mapEditor/src/MapManager';
import { MapEditor } from '../../../bundles/mapEditor/src/MapEditor';
import { FARM_EVENT_DATA_UPDATED } from '../../Model/Farm/FarmTypes';
import { FarmModel } from '../../Model/Farm/FarmModel';
import { toServerFarmId } from '../../Model/Farm/FarmPlotMapper';
const { ccclass, property } = _decorator;

/** 点击地图上的小农田时抛出，GameView 监听后打开种子列表 */
export const GAME_FARM_PLOT_CLICK_EVENT = 'GameFarmPlotClick';

export const FARM_PLOT_COUNT = 36;

export type GameFarmPlotClickPayload = {
    farmIndex: number;
    plotIndex: number;
    /** 服务端 farm_id；无匹配时为 null */
    farmId: number | null;
    plotNodeName?: string;
};

type PlotHit = {
    node: Node;
    plotIndex: number;
    farmId: number | null;
};

@ccclass('GameFarmNode')
export class GameFarmNode extends Component {
    @property
    farmIndex: number = 0;

    /** 点击时缩放比例（相对原始 scale） */
    @property
    clickScale = 0.9;

    private static readonly TAP_MOVE_THRESHOLD = 12;

    private readonly plotBaseScale = new Map<Node, Vec3>();
    private serverFarmIdSet = new Set<number>();
    private farmDataListener: Record<string, unknown> = {};

    private touchStartPos: Vec2 | null = null;
    private pendingPlot: PlotHit | null = null;
    private touchMoved = false;
    private mouseStartPos: Vec2 | null = null;
    private pendingMousePlot: PlotHit | null = null;
    private mouseMoved = false;

    onLoad() {
        this.cachePlotBaseScales();
        this.stripPlotButtons();
        this.bindGlobalInput();
    }

    start() {
        EventSystem.addListent(FARM_EVENT_DATA_UPDATED, this.onFarmDataUpdated, this.farmDataListener);
        this.syncPlotVisibilityFromModel();
    }

    onDestroy() {
        EventSystem.remove(this.farmDataListener);
        this.unbindGlobalInput();
    }

    private cachePlotBaseScales() {
        const children = this.node.children;
        for (let i = 0; i < children.length; i++) {
            const plotNode = children[i];
            if (this.parsePlotIndex(plotNode) < 0) {
                continue;
            }
            if (!this.plotBaseScale.has(plotNode)) {
                this.plotBaseScale.set(plotNode, plotNode.scale.clone());
            }
        }
    }

    private onFarmDataUpdated() {
        this.syncPlotVisibilityFromModel();
    }

    /** 按 farm_data 显示/隐藏小田地：无对应 farm_id 则隐藏 */
    private syncPlotVisibilityFromModel() {
        const farmModel = FarmModel.getInstance();
        const farmCount = farmModel.getFarmCount();
        this.serverFarmIdSet.clear();
        const plots = farmModel.getAllPlots();
        for (let i = 0; i < plots.length; i++) {
            this.serverFarmIdSet.add(plots[i].farm_id);
        }

        const children = this.node.children;
        for (let i = 0; i < children.length; i++) {
            const plotNode = children[i];
            const plotIndex = this.parsePlotIndex(plotNode);
            if (plotIndex < 0) {
                continue;
            }

            const farmId = toServerFarmId(this.farmIndex, plotIndex, farmCount);
            const visible =
                farmId != null &&
                this.serverFarmIdSet.has(farmId) &&
                farmModel.getPlot(farmId) != null;

            plotNode.active = visible;
            if (visible) {
                const base = this.plotBaseScale.get(plotNode);
                if (base) {
                    plotNode.setScale(base);
                }
            }
        }
    }

    /** 移除 Button，避免吞掉触摸导致无法拖动/缩放地图 */
    private stripPlotButtons() {
        const children = this.node.children;
        for (let i = 0; i < children.length; i++) {
            const plotNode = children[i];
            const button = plotNode.getComponent(Button);
            if (button) {
                button.destroy();
            }
        }
    }

    private bindGlobalInput() {
        input.on(Input.EventType.TOUCH_START, this.onGlobalTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchCancel, this);
        if (!sys.isMobile) {
            input.on(Input.EventType.MOUSE_DOWN, this.onGlobalMouseDown, this);
            input.on(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
        }
    }

    private unbindGlobalInput() {
        input.off(Input.EventType.TOUCH_START, this.onGlobalTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onGlobalTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onGlobalTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onGlobalTouchCancel, this);
        if (!sys.isMobile) {
            input.off(Input.EventType.MOUSE_DOWN, this.onGlobalMouseDown, this);
            input.off(Input.EventType.MOUSE_UP, this.onGlobalMouseUp, this);
        }
    }

    private onGlobalTouchStart(event: EventTouch) {
        if (event.getTouches().length > 1) {
            this.resetTouch();
            return;
        }
        this.touchStartPos = event.getLocation().clone();
        this.touchMoved = false;
        this.pendingPlot = this.hitTestPlotAtScreen(this.touchStartPos);
    }

    private onGlobalTouchMove(event: EventTouch) {
        if (!this.touchStartPos) {
            return;
        }
        if (event.getTouches().length > 1) {
            this.resetTouch();
            return;
        }
        const dist = Vec2.distance(event.getLocation(), this.touchStartPos);
        if (dist > GameFarmNode.TAP_MOVE_THRESHOLD) {
            this.touchMoved = true;
            this.pendingPlot = null;
        }
    }

    private onGlobalTouchEnd(event: EventTouch) {
        if (event.getTouches().length > 1) {
            this.resetTouch();
            return;
        }
        this.tryConfirmPlotTap(event.getLocation());
        this.resetTouch();
    }

    private onGlobalTouchCancel() {
        this.resetTouch();
    }

    private onGlobalMouseDown(event: EventMouse) {
        this.mouseStartPos = event.getLocation().clone();
        this.mouseMoved = false;
        this.pendingMousePlot = this.hitTestPlotAtScreen(this.mouseStartPos);
    }

    private onGlobalMouseUp(event: EventMouse) {
        if (!this.mouseStartPos) {
            return;
        }
        const dist = Vec2.distance(event.getLocation(), this.mouseStartPos);
        if (dist > GameFarmNode.TAP_MOVE_THRESHOLD) {
            this.mouseMoved = true;
        }
        if (!this.mouseMoved && this.pendingMousePlot) {
            const hit = this.hitTestPlotAtScreen(event.getLocation());
            if (hit && hit.plotIndex === this.pendingMousePlot.plotIndex) {
                this.playPlotClickScale(hit.node);
                this.onPlotClick(hit);
            }
        }
        this.mouseStartPos = null;
        this.pendingMousePlot = null;
        this.mouseMoved = false;
    }

    private tryConfirmPlotTap(endPos: Vec2) {
        if (this.touchMoved || !this.pendingPlot) {
            return;
        }
        const hit = this.hitTestPlotAtScreen(endPos);
        if (!hit || hit.plotIndex !== this.pendingPlot.plotIndex) {
            return;
        }
        this.playPlotClickScale(hit.node);
        this.onPlotClick(hit);
    }

    private resetTouch() {
        this.touchStartPos = null;
        this.pendingPlot = null;
        this.touchMoved = false;
    }

    private getMapCamera() {
        const editor = MapManager.GetInstance()?.getMapEditor?.() as MapEditor;
        return editor?.mainCamera ?? null;
    }

    private resolveFarmIdForPlot(plotIndex: number): number | null {
        const farmId = toServerFarmId(
            this.farmIndex,
            plotIndex,
            FarmModel.getInstance().getFarmCount()
        );
        if (farmId == null || !this.serverFarmIdSet.has(farmId)) {
            return null;
        }
        return farmId;
    }

    private hitTestPlotAtScreen(screen: Vec2): PlotHit | null {
        const camera = this.getMapCamera();
        if (!camera) {
            return null;
        }
        const world = camera.screenToWorld(new Vec3(screen.x, screen.y, 0));
        const children = this.node.children;
        for (let i = children.length - 1; i >= 0; i--) {
            const plotNode = children[i];
            if (!plotNode.active) {
                continue;
            }
            const plotIndex = this.parsePlotIndex(plotNode);
            if (plotIndex < 0) {
                continue;
            }
            const farmId = this.resolveFarmIdForPlot(plotIndex);
            if (farmId == null) {
                continue;
            }
            const ui = plotNode.getComponent(UITransform);
            if (!ui) {
                continue;
            }
            const local = ui.convertToNodeSpaceAR(new Vec3(world.x, world.y, 0));
            const halfW = ui.width * 0.5;
            const halfH = ui.height * 0.5;
            if (local.x >= -halfW && local.x <= halfW && local.y >= -halfH && local.y <= halfH) {
                return { node: plotNode, plotIndex, farmId };
            }
        }
        return null;
    }

    private parsePlotIndex(plotNode: Node): number {
        const match = /^tudi(\d+)$/.exec(plotNode.name);
        if (!match) {
            return -1;
        }
        const n = Number(match[1]);
        if (!Number.isFinite(n) || n < 1 || n > FARM_PLOT_COUNT) {
            return -1;
        }
        return n - 1;
    }

    private playPlotClickScale(plotNode: Node) {
        if (!plotNode?.isValid) {
            return;
        }
        tween(plotNode).stop();
        const base = this.plotBaseScale.get(plotNode) ?? plotNode.scale.clone();
        const pressed = v3(
            base.x * this.clickScale,
            base.y * this.clickScale,
            base.z
        );
        tween(plotNode)
            .to(0.06, { scale: pressed }, { easing: 'quadOut' })
            .to(0.1, { scale: base }, { easing: 'quadOut' })
            .start();
    }

    private onPlotClick(hit: PlotHit) {
        const payload: GameFarmPlotClickPayload = {
            farmIndex: Number(this.farmIndex) || 0,
            plotIndex: hit.plotIndex,
            farmId: hit.farmId,
            plotNodeName: hit.node.name,
        };
        EventSystem.send(GAME_FARM_PLOT_CLICK_EVENT, payload);
    }
}
