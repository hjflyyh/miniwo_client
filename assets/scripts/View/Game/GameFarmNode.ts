import {
    _decorator,
    Button,
    Component,
    EventMouse,
    EventTouch,
    Input,
    input,
    director,
    instantiate,
    Node,
    Prefab,
    resources,
    sys,
    tween,
    UITransform,
    v3,
    Vec2,
    Vec3,
    Sprite,
    SpriteFrame,
    Color,
} from 'cc';
// import { MapManager } from '../../../bundles/mapEditor/src/MapManager';
// import { MapEditor } from '../../../bundles/mapEditor/src/MapEditor';
import {
    FARM_EVENT_DATA_UPDATED,
    FarmBuff,
    FarmPlotState,
    getActiveFarmBuffs,
    isPlotGrowing,
    isPlotHarvestable,
    plotNeedsWaterOverlay,
    sortFarmBuffsForDisplay,
} from '../../Model/Farm/FarmTypes';
import { getFarmBuffSpriteResourcePath } from '../../Model/Farm/FarmPlotBuffVisual';
import { FarmModel } from '../../Model/Farm/FarmModel';
import { toServerFarmId } from '../../Model/Farm/FarmPlotMapper';
import { Planting } from './Planting';
import { PlantingEnd } from './PlantingEnd';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

const WATERING_PREFAB_NODE_NAME = 'WateringPrefab';
const WATERING_PREFAB_RESOURCE_PATH = 'UITexture/farm/WateringPrefab';
const PLANTING_PREFAB_NODE_NAME = 'Planting';
const PLANTING_PREFAB_RESOURCE_PATH = 'UITexture/farm/Planting';
const PLANTING_END_PREFAB_NODE_NAME = 'PlantingEnd';
const PLANTING_END_PREFAB_RESOURCE_PATH = 'UITexture/farm/PlantingEnd';
const PLOT_BUFF_NODE_NAME = 'buff';
/** 农田 function 面板统一挂在此层，避免相邻地块遮挡 */
const FARM_FUNCTION_OVERLAY_NAME = 'FarmPlotFunctionOverlay';

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

    /** 已播种未浇水时挂在地块上的预制件；未拖入则从 resources 加载 */
    @property(Prefab)
    wateringPrefab: Prefab = null;

    /** 生长中挂在地块上的预制件；未拖入则从 resources 加载 */
    @property(Prefab)
    plantingPrefab: Prefab = null;

    /** 生长到期时挂在地块上的预制件；未拖入则从 resources 加载 */
    @property(Prefab)
    plantingEndPrefab: Prefab = null;

    private static readonly TAP_MOVE_THRESHOLD = 12;

    private wateringPrefabResolved: Prefab | null = null;
    private plantingPrefabResolved: Prefab | null = null;
    private plantingPrefabLoading = false;
    private plantingEndPrefabResolved: Prefab | null = null;
    private plantingEndPrefabLoading = false;
    private readonly buffSpriteCache = new Map<number, SpriteFrame>();
    private readonly buffSpriteMissing = new Set<number>();

    private readonly plotBaseScale = new Map<Node, Vec3>();
    private functionOverlayRoot: Node | null = null;
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
        this.ensureFunctionOverlayRoot();
        this.resolveWateringPrefab();
        this.resolvePlantingPrefab();
        this.resolvePlantingEndPrefab();
    }

    /** Planting.fNode 展开时挂到该节点，置于整块农田分区最上层 */
    public getFunctionOverlayRoot(): Node {
        this.ensureFunctionOverlayRoot();
        return this.functionOverlayRoot;
    }

    private ensureFunctionOverlayRoot() {
        if (this.functionOverlayRoot?.isValid) {
            this.bringFunctionOverlayToFront();
            return;
        }
        const overlay = new Node(FARM_FUNCTION_OVERLAY_NAME);
        overlay.setParent(this.node);
        this.functionOverlayRoot = overlay;
        this.bringFunctionOverlayToFront();
    }

    private bringFunctionOverlayToFront() {
        const root = this.functionOverlayRoot;
        if (root?.isValid && root.parent === this.node) {
            root.setSiblingIndex(this.node.children.length - 1);
        }
    }

    private static _sceneSyncing = false;

    private _syncing = false;

    start() {
        EventSystem.addListent(FARM_EVENT_DATA_UPDATED, this.onFarmDataUpdated, this);
        this.syncFromFarmModel();
    }

    /** 进图或 farm_data 更新后：刷新显隐与可收获 PlantingEnd */
    public syncFromFarmModel() {
        if (this._syncing) {
            return;
        }
        this._syncing = true;
        try {
            this.syncPlotVisibilityFromModel();
            this.syncPlotOverlaysFromModel();
        } finally {
            this._syncing = false;
        }
    }

    /** 农场数据就绪后刷新场景中所有 GameFarmNode（进图优化） */
    public static syncAllInScene(root?: Node) {
        if (GameFarmNode._sceneSyncing) {
            return;
        }
        GameFarmNode._sceneSyncing = true;
        try {
            const scene = director.getScene();
            if (!scene) {
                return;
            }
            const base = root ?? scene;
            const nodes = base.getComponentsInChildren(GameFarmNode);
            for (let i = 0; i < nodes.length; i++) {
                nodes[i].syncFromFarmModel();
            }
        } finally {
            GameFarmNode._sceneSyncing = false;
        }
    }

    /** 刷新指定 farm_id 对应地块的 overlay（施肥等单地块变更后调用） */
    public static refreshPlotByFarmId(farmId: number, root?: Node): void {
        const id = Math.floor(Number(farmId) || 0);
        if (id <= 0) {
            return;
        }
        const scene = director.getScene();
        if (!scene) {
            return;
        }
        const base = root ?? scene;
        const nodes = base.getComponentsInChildren(GameFarmNode);
        for (let i = 0; i < nodes.length; i++) {
            nodes[i].refreshPlotOverlayByFarmId(id);
        }
    }

    /** 刷新本 GameFarmNode 内指定 farm_id 的地块 overlay */
    public refreshPlotOverlayByFarmId(farmId: number): void {
        const id = Math.floor(Number(farmId) || 0);
        if (id <= 0) {
            return;
        }
        const farmCount = FarmModel.getInstance().getFarmCount();
        const children = this.node.children;
        for (let i = 0; i < children.length; i++) {
            const plotNode = children[i];
            const plotIndex = this.parsePlotIndex(plotNode);
            if (plotIndex < 0) {
                continue;
            }
            const mappedId = toServerFarmId(this.farmIndex, plotIndex, farmCount);
            if (mappedId === id) {
                this.refreshPlotNode(plotNode, id);
                return;
            }
        }
    }

    onDestroy() {
        EventSystem.remove(this);
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
        this.syncFromFarmModel();
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

            // plotNode.active = visible;
            if(!visible){
                plotNode.getComponent(Sprite).color = Color.GRAY
            }else{
                plotNode.getComponent(Sprite).color = Color.WHITE
            }
            if (visible) {
                const base = this.plotBaseScale.get(plotNode);
                if (base) {
                    plotNode.setScale(base);
                }
                this.refreshPlotNode(plotNode, farmId);
            } else {
                this.setPlotWateringVisible(plotNode, false);
                this.setPlotPlantingVisible(plotNode, false);
                this.setPlotPlantingEndVisible(plotNode, false);
                this.refreshPlotBuffOverlay(plotNode, null, farmModel.getNowUnixSec());
            }
        }
    }

    /** 根据地块 buff 数组在子节点 buff 上显示 farmBuff/buffType_{type} */
    private refreshPlotBuffOverlay(plotNode: Node, plot: FarmPlotState | null, nowSec: number) {
        const buffNode = plotNode.getChildByName(PLOT_BUFF_NODE_NAME);
        if (!buffNode) {
            return;
        }
        let sprite = buffNode.getComponent(Sprite);
        if (!sprite) {
            sprite = buffNode.addComponent(Sprite);
            sprite.spriteFrame = null;
            sprite.color = Color.WHITE;
        }
        buffNode.scale = v3(0.5, 0.5, 1);

        const activeBuffs = sortFarmBuffsForDisplay(getActiveFarmBuffs(plot, nowSec));
        if (!activeBuffs.length) {
            buffNode.active = false;
            sprite.spriteFrame = null;
            return;
        }

        this.tryApplyPlotBuffSprite(buffNode, sprite, activeBuffs, 0);
    }

    private tryApplyPlotBuffSprite(
        buffNode: Node,
        sprite: Sprite,
        buffs: FarmBuff[],
        index: number,
    ) {
        if (!buffNode.isValid || !sprite.isValid) {
            return;
        }
        if (index >= buffs.length) {
            buffNode.active = false;
            sprite.spriteFrame = null;
            return;
        }

        const buffType = Math.floor(Number(buffs[index].buff_type) || 0);
        if (this.buffSpriteMissing.has(buffType)) {
            this.tryApplyPlotBuffSprite(buffNode, sprite, buffs, index + 1);
            return;
        }

        const cached = this.buffSpriteCache.get(buffType);
        if (cached) {
            sprite.spriteFrame = cached;
            buffNode.active = true;
            this.syncPlotOverlayDrawOrder(buffNode.parent);
            return;
        }

        const path = getFarmBuffSpriteResourcePath(buffType);
        if (!path) {
            this.buffSpriteMissing.add(buffType);
            this.tryApplyPlotBuffSprite(buffNode, sprite, buffs, index + 1);
            return;
        }

        resources.load(path, SpriteFrame, (err, sf) => {
            if (!buffNode.isValid || !sprite.isValid) {
                return;
            }
            if (err || !sf) {
                this.buffSpriteMissing.add(buffType);
                this.tryApplyPlotBuffSprite(buffNode, sprite, buffs, index + 1);
                return;
            }
            this.buffSpriteCache.set(buffType, sf);
            sprite.spriteFrame = sf;
            buffNode.active = true;
            this.syncPlotOverlayDrawOrder(buffNode.parent);
        });
    }

    /**
     * 地块子节点绘制顺序（自下而上）：buff < Watering < Planting / PlantingEnd。
     * buff 不得盖住生长中预制件。
     */
    private syncPlotOverlayDrawOrder(plotNode: Node) {
        if (!plotNode?.isValid) {
            return;
        }
        const layerNames = [
            PLOT_BUFF_NODE_NAME,
            WATERING_PREFAB_NODE_NAME,
            PLANTING_PREFAB_NODE_NAME,
            PLANTING_END_PREFAB_NODE_NAME,
        ];
        let nextIndex = 0;
        for (let i = 0; i < layerNames.length; i++) {
            const child = plotNode.getChildByName(layerNames[i]);
            if (!child?.isValid || !child.active) {
                continue;
            }
            if (child.getSiblingIndex() !== nextIndex) {
                child.setSiblingIndex(nextIndex);
            }
            nextIndex++;
        }
        const top =
            plotNode.getChildByName(PLANTING_END_PREFAB_NODE_NAME) ??
            plotNode.getChildByName(PLANTING_PREFAB_NODE_NAME);
        if (top?.isValid && top.active) {
            const lastIndex = plotNode.children.length - 1;
            if (top.getSiblingIndex() !== lastIndex) {
                top.setSiblingIndex(lastIndex);
            }
        }
    }

    private resolveWateringPrefab() {
        if (this.wateringPrefab) {
            this.wateringPrefabResolved = this.wateringPrefab;
            return;
        }
        resources.load(WATERING_PREFAB_RESOURCE_PATH, Prefab, (err, prefab) => {
            if (err || !prefab) {
                console.log('[GameFarmNode] WateringPrefab 加载失败', err?.message ?? err);
                return;
            }
            this.wateringPrefabResolved = prefab;
            if (this.node?.isValid) {
                this.syncPlotOverlaysFromModel();
            }
        });
    }

    private getWateringPrefab(): Prefab | null {
        return this.wateringPrefabResolved ?? this.wateringPrefab;
    }

    private resolvePlantingEndPrefab() {
        if (this.plantingEndPrefab) {
            this.plantingEndPrefabResolved = this.plantingEndPrefab;
            if (FarmModel.getInstance().isActive()) {
                this.syncPlotOverlaysFromModel();
            }
            return;
        }
        if (this.plantingEndPrefabResolved || this.plantingEndPrefabLoading) {
            return;
        }
        this.plantingEndPrefabLoading = true;
        resources.load(PLANTING_END_PREFAB_RESOURCE_PATH, Prefab, (err, prefab) => {
            this.plantingEndPrefabLoading = false;
            if (err || !prefab) {
                console.log('[GameFarmNode] PlantingEnd 加载失败', err?.message ?? err);
                return;
            }
            this.plantingEndPrefabResolved = prefab;
            if (this.node?.isValid) {
                this.syncPlotOverlaysFromModel();
            }
        });
    }

    private resolvePlantingPrefab() {
        if (this.plantingPrefab) {
            this.plantingPrefabResolved = this.plantingPrefab;
            if (FarmModel.getInstance().isActive()) {
                this.syncPlotOverlaysFromModel();
            }
            return;
        }
        if (this.plantingPrefabResolved || this.plantingPrefabLoading) {
            return;
        }
        this.plantingPrefabLoading = true;
        resources.load(PLANTING_PREFAB_RESOURCE_PATH, Prefab, (err, prefab) => {
            this.plantingPrefabLoading = false;
            if (err || !prefab) {
                console.log('[GameFarmNode] Planting 加载失败', err?.message ?? err);
                return;
            }
            this.plantingPrefabResolved = prefab;
            if (this.node?.isValid) {
                this.syncPlotOverlaysFromModel();
            }
        });
    }

    private getPlantingPrefab(): Prefab | null {
        return this.plantingPrefabResolved ?? this.plantingPrefab;
    }

    private getPlantingEndPrefab(): Prefab | null {
        return this.plantingEndPrefabResolved ?? this.plantingEndPrefab;
    }

    /** 根据 farm_data 刷新单块农田上的浇水 / 生长 / 成熟预制件 */
    private refreshPlotNode(plotNode: Node, farmId: number) {
        const farmModel = FarmModel.getInstance();
        const plot = farmModel.getPlot(farmId);
        const nowSec = farmModel.getNowUnixSec();
        const showEnd = isPlotHarvestable(plot, nowSec);
        const showWater = plotNeedsWaterOverlay(plot) && !showEnd;
        const showPlanting = isPlotGrowing(plot, nowSec) && !showEnd;
        this.refreshPlotBuffOverlay(plotNode, plot, nowSec);
        this.setPlotWateringVisible(plotNode, showWater);
        this.setPlotPlantingVisible(plotNode, showPlanting, plot);
        this.setPlotPlantingEndVisible(plotNode, showEnd, plot);
        this.syncPlotOverlayDrawOrder(plotNode);
    }

    private syncPlotOverlaysFromModel() {
        const farmModel = FarmModel.getInstance();
        const farmCount = farmModel.getFarmCount();
        const children = this.node.children;
        for (let i = 0; i < children.length; i++) {
            const plotNode = children[i];
            if (!plotNode.active) {
                continue;
            }
            const plotIndex = this.parsePlotIndex(plotNode);
            if (plotIndex < 0) {
                continue;
            }
            const farmId = toServerFarmId(this.farmIndex, plotIndex, farmCount);
            if (farmId == null) {
                this.setPlotWateringVisible(plotNode, false);
                this.setPlotPlantingVisible(plotNode, false);
                this.setPlotPlantingEndVisible(plotNode, false);
                this.refreshPlotBuffOverlay(plotNode, null, farmModel.getNowUnixSec());
                continue;
            }
            this.refreshPlotNode(plotNode, farmId);
        }
    }

    private setPlotWateringVisible(plotNode: Node, visible: boolean) {
        this.ensureWateringPrefabInstance(plotNode, visible);
    }

    private ensureWateringPrefabInstance(plotNode: Node, visible: boolean) {
        let wateringNode = plotNode.getChildByName(WATERING_PREFAB_NODE_NAME);
        if (!visible) {
            if (wateringNode) {
                wateringNode.destroy();
            }
            return;
        }

        const prefab = this.getWateringPrefab();
        if (!prefab) {
            return;
        }

        if (!wateringNode) {
            wateringNode = instantiate(prefab);
            wateringNode.name = WATERING_PREFAB_NODE_NAME;
            wateringNode.setParent(plotNode);
        }
        wateringNode.active = true;
        this.syncPlotOverlayDrawOrder(plotNode);
    }

    private setPlotPlantingVisible(plotNode: Node, visible: boolean, plot?: FarmPlotState | null) {
        this.ensurePlantingPrefabInstance(plotNode, visible, plot ?? null);
    }

    private ensurePlantingPrefabInstance(
        plotNode: Node,
        visible: boolean,
        plot: FarmPlotState | null,
    ) {
        let plantingNode = plotNode.getChildByName(PLANTING_PREFAB_NODE_NAME);
        if (!visible) {
            if (plantingNode) {
                plantingNode.getComponent(Planting)?.disposeFunctionPanel();
                plantingNode.destroy();
            }
            return;
        }

        const endNode = plotNode.getChildByName(PLANTING_END_PREFAB_NODE_NAME);
        if (endNode) {
            endNode.destroy();
        }

        const prefab = this.getPlantingPrefab();
        if (!prefab) {
            return;
        }

        if (!plantingNode) {
            plantingNode = instantiate(prefab);
            plantingNode.name = PLANTING_PREFAB_NODE_NAME;
            plantingNode.setParent(plotNode);
        }
        plantingNode.active = true;
        this.syncPlotOverlayDrawOrder(plotNode);

        const ctrl = plantingNode.getComponent(Planting);
        if (ctrl && plot) {
            ctrl.setup(plot.farm_id, String(plot.seed ?? '').trim());
        }
    }

    private setPlotPlantingEndVisible(plotNode: Node, visible: boolean, plot?: FarmPlotState | null) {
        this.ensurePlantingEndPrefabInstance(plotNode, visible, plot ?? null);
    }

    private ensurePlantingEndPrefabInstance(
        plotNode: Node,
        visible: boolean,
        plot: FarmPlotState | null,
    ) {
        let endNode = plotNode.getChildByName(PLANTING_END_PREFAB_NODE_NAME);
        if (!visible) {
            if (endNode) {
                endNode.getComponent(PlantingEnd)?.disposeFunctionPanel();
                endNode.destroy();
            }
            return;
        }

        const growingNode = plotNode.getChildByName(PLANTING_PREFAB_NODE_NAME);
        if (growingNode) {
            growingNode.getComponent(Planting)?.disposeFunctionPanel();
            growingNode.destroy();
        }

        const prefab = this.getPlantingEndPrefab();
        if (!prefab) {
            return;
        }

        if (!endNode) {
            endNode = instantiate(prefab);
            endNode.name = PLANTING_END_PREFAB_NODE_NAME;
            endNode.setParent(plotNode);
        }
        endNode.active = true;
        this.syncPlotOverlayDrawOrder(plotNode);

        const ctrl = endNode.getComponent(PlantingEnd);
        if (ctrl && plot) {
            ctrl.setup(plot.farm_id, String(plot.seed ?? '').trim());
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
        const editor = AppConst.mapManager.getMapEditor?.();
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
