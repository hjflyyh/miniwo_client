import { _decorator, Button, Component, EventMouse, EventTouch, Input, input, Node, sys, tween, UITransform, v3, Vec2, Vec3 } from 'cc';
import { MapManager } from '../../../bundles/mapEditor/src/MapManager';
import { MapEditor } from '../../../bundles/mapEditor/src/MapEditor';
const { ccclass, property } = _decorator;

/** 点击地图上的小农田时抛出，GameView 监听后打开种子列表 */
export const GAME_FARM_PLOT_CLICK_EVENT = 'GameFarmPlotClick';

export const FARM_PLOT_COUNT = 36;

export type GameFarmPlotClickPayload = {
    farmIndex: number;
    plotIndex: number;
    plotNodeName?: string;
};

type PlotHit = {
    node: Node;
    plotIndex: number;
};

@ccclass('GameFarmNode')
export class GameFarmNode extends Component {
    @property
    farmIndex: number = 0;

    /** 点击时缩放比例（相对原始 scale） */
    @property
    clickScale = 0.9;

    private static readonly TAP_MOVE_THRESHOLD = 12;

    private touchStartPos: Vec2 | null = null;
    private pendingPlot: PlotHit | null = null;
    private touchMoved = false;
    private mouseStartPos: Vec2 | null = null;
    private pendingMousePlot: PlotHit | null = null;
    private mouseMoved = false;

    onLoad() {
        this.stripPlotButtons();
        this.bindGlobalInput();
    }

    onDestroy() {
        this.unbindGlobalInput();
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
                this.onPlotClick(hit.plotIndex, hit.node.name);
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
        this.onPlotClick(hit.plotIndex, hit.node.name);
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

    private hitTestPlotAtScreen(screen: Vec2): PlotHit | null {
        const camera = this.getMapCamera();
        if (!camera) {
            return null;
        }
        const world = camera.screenToWorld(new Vec3(screen.x, screen.y, 0));
        const children = this.node.children;
        for (let i = children.length - 1; i >= 0; i--) {
            const plotNode = children[i];
            const plotIndex = this.parsePlotIndex(plotNode);
            if (plotIndex < 0) {
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
                return { node: plotNode, plotIndex };
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
        const base = plotNode.scale.clone();
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

    private onPlotClick(plotIndex: number, plotNodeName: string) {
        const payload: GameFarmPlotClickPayload = {
            farmIndex: Number(this.farmIndex) || 0,
            plotIndex,
            plotNodeName,
        };
        EventSystem.send(GAME_FARM_PLOT_CLICK_EVENT, payload);
    }
}
