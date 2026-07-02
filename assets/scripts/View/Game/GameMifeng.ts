import {
    _decorator,
    Component,
    Label,
    Node,
    Size,
    sp,
    tween,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
import { MapEditor } from '../../../bundles/mapEditor/src/MapEditor';
import { AppConst } from '../../AppConst';
import { BagModel } from '../../Model/BagModel';
import { buildDisplayableBasicSeedRows } from '../../Model/Farm/FarmSeedCatalog';
import { FarmModel } from '../../Model/Farm/FarmModel';
import { toServerFarmId } from '../../Model/Farm/FarmPlotMapper';
import {
    FARM_EVENT_DATA_UPDATED,
    FarmPlotPhase,
    resolveFarmPlotPhase,
} from '../../Model/Farm/FarmTypes';
import { MapModel } from '../../Model/MapModel';
import { UGCModel } from '../../Model/UGCModel';
import { FARM_PLOT_COUNT, GameFarmNode } from './GameFarmNode';
import {
    GameMifengDialogueCategory,
    pickRandomDialogue,
} from './GameMifengDialogues';
const { ccclass, property } = _decorator;

const IDLE_ANIM = 'ldle';

/**
 * 飞行目标优先级权重（越高越容易被选中）：
 * 已成熟 40% > 生长中 30% > 已播种 20% > 空地 10%
 */
const PHASE_WEIGHTS: Record<FarmPlotPhase, number> = {
    [FarmPlotPhase.Mature]: 40,
    [FarmPlotPhase.Growing]: 30,
    [FarmPlotPhase.Planted]: 20,
    [FarmPlotPhase.Idle]: 10,
};

const PHASE_ORDER: FarmPlotPhase[] = [
    FarmPlotPhase.Mature,
    FarmPlotPhase.Growing,
    FarmPlotPhase.Planted,
    FarmPlotPhase.Idle,
];

type PlotFlyTarget = {
    key: string;
    phase: FarmPlotPhase;
    localPos: Vec3;
};

type FarmSurvey = {
    hasHarvestable: boolean;
    hasGrowing: boolean;
    hasPlanted: boolean;
    hasIdlePlot: boolean;
    hasSeedsInBag: boolean;
    hasNpcWorking: boolean;
};

@ccclass('GameMifeng')
export class GameMifeng extends Component {
    @property(sp.Skeleton)
    spine: sp.Skeleton = null;

    @property(Node)
    dialogueNode: Node = null;

    @property(Label)
    dialogueLabel: Label = null;

    /** 气泡显示时长（秒） */
    @property
    dialogueShowSec = 5;

    /** 气泡隐藏后再出现的等待时长（秒） */
    @property
    dialogueHideWaitSec = 3;

    /** 气泡弹出动画时长（秒） */
    @property
    dialoguePopSec = 0.28;

    /** 落点停留最短时长（秒） */
    @property
    minStaySec = 2.5;

    /** 落点停留最长时长（秒） */
    @property
    maxStaySec = 6;

    /** 单次飞行时长（秒） */
    @property
    flyDurationSec = 1.2;

    /** 在格子中心附近的随机偏移（相对 tileSize） */
    @property
    nearGridOffsetRatio = 0.35;

    private flying = false;
    private stayTimer: ReturnType<typeof setTimeout> | null = null;
    private dialogueTimer: ReturnType<typeof setTimeout> | null = null;
    private dialogueHideTimer: ReturnType<typeof setTimeout> | null = null;
    private lastTargetKey = '';
    private lastDialogueLine = '';
    private readonly dialogueBaseScale = new Vec3(1, 1, 1);
    private onFarmland = false;

    start() {
        if (!this.spine) {
            this.spine = this.getComponentInChildren(sp.Skeleton);
        }
        if (this.dialogueNode?.isValid) {
            this.dialogueBaseScale.set(this.dialogueNode.scale);
        }
        this.hideDialogue();
        this.playIdle();
        EventSystem.addListent(FARM_EVENT_DATA_UPDATED, this.onFarmDataUpdated, this);
        this.scheduleOnce(() => this.pickNextTargetAndFly(), 0.6);
        this.startDialogueLoop();
    }

    onDestroy() {
        this.clearStayTimer();
        this.clearDialogueTimers();
        tween(this.node).stop();
        if (this.dialogueNode?.isValid) {
            tween(this.dialogueNode).stop();
        }
        EventSystem.remove(this);
    }

    private onFarmDataUpdated() {
        if (this.flying || this.stayTimer != null) {
            return;
        }
        if (this.collectPlotTargets().length > 0) {
            this.pickNextTargetAndFly();
        }
    }

    private playIdle() {
        if (this.spine?.isValid) {
            this.spine.setAnimation(0, IDLE_ANIM, true);
        }
    }

    private getMapEditor(): MapEditor | null {
        return AppConst.mapManager?.getMapEditor?.() ?? null;
    }

    private getMoveParentUi(): UITransform | null {
        return this.node.parent?.getComponent(UITransform) ?? null;
    }

    private collectPlotTargets(): PlotFlyTarget[] {
        const map = this.getMapEditor();
        const parentUi = this.getMoveParentUi();
        const mapUi = map?.mapContainer?.getComponent(UITransform) ?? null;
        if (!map || !parentUi || !mapUi) {
            return [];
        }

        const farmModel = FarmModel.getInstance();
        const nowSec = farmModel.getNowUnixSec();
        const farmCount = farmModel.getFarmCount();
        const targets: PlotFlyTarget[] = [];
        const farmNodes = map.node.getComponentsInChildren(GameFarmNode);

        for (let i = 0; i < farmNodes.length; i++) {
            const farmNode = farmNodes[i];
            if (!farmNode.node?.active) {
                continue;
            }
            const farmIndex = Math.floor(Number(farmNode.farmIndex) || 0);
            const children = farmNode.node.children;
            for (let j = 0; j < children.length; j++) {
                const plotNode = children[j];
                if (!plotNode.active) {
                    continue;
                }
                const plotIndex = this.parsePlotIndex(plotNode.name);
                if (plotIndex < 0) {
                    continue;
                }
                const farmId = toServerFarmId(farmIndex, plotIndex, farmCount);
                if (farmId == null) {
                    continue;
                }
                const plot = farmModel.getPlot(farmId);
                if (!plot) {
                    continue;
                }
                const phase = resolveFarmPlotPhase(plot, nowSec);
                const localPos = this.buildFlyLocalNearPlot(plotNode, map, mapUi, parentUi);
                if (!localPos) {
                    continue;
                }
                targets.push({
                    key: `${farmId}`,
                    phase,
                    localPos,
                });
            }
        }
        return targets;
    }

    private parsePlotIndex(nodeName: string): number {
        const match = /^tudi(\d+)$/.exec(nodeName);
        if (!match) {
            return -1;
        }
        const n = Number(match[1]);
        if (!Number.isFinite(n) || n < 1 || n > FARM_PLOT_COUNT) {
            return -1;
        }
        return n - 1;
    }

    /** 地块世界坐标 → 最近地图格中心 → 附近随机点 → 蜜蜂父节点本地坐标 */
    private buildFlyLocalNearPlot(
        plotNode: Node,
        map: MapEditor,
        mapUi: UITransform,
        parentUi: UITransform,
    ): Vec3 | null {
        const plotWorld = plotNode.worldPosition;
        const mapLocal = mapUi.convertToNodeSpaceAR(new Vec3(plotWorld.x, plotWorld.y, plotWorld.z));
        const grid = this.findNearestGrid(mapLocal, map);
        let targetMapLocal: Vec3;
        if (grid) {
            const gridCenter = MapModel.getInstance().gridToWorld(
                grid,
                new Size(map.tileSize, map.tileSize),
                map,
            );
            const offset = this.randomNearGridOffset(map.tileSize);
            targetMapLocal = new Vec3(gridCenter.x + offset.x, gridCenter.y + offset.y, 0);
        } else {
            targetMapLocal = mapLocal;
        }
        const targetWorld = mapUi.convertToWorldSpaceAR(targetMapLocal);
        return parentUi.convertToNodeSpaceAR(targetWorld);
    }

    private findNearestGrid(localPos: Vec3, map: MapEditor): Vec2 | null {
        const width = Math.max(1, Math.floor(map.mapWidth));
        const height = Math.max(1, Math.floor(map.mapHeight));
        const mapModel = MapModel.getInstance();
        let best: Vec2 | null = null;
        let bestDist = Infinity;
        for (let gx = 0; gx < width; gx++) {
            for (let gy = 0; gy < height; gy++) {
                const center = mapModel.gridToWorld(
                    new Vec2(gx, gy),
                    new Size(map.tileSize, map.tileSize),
                    map,
                );
                const dx = localPos.x - center.x;
                const dy = localPos.y - center.y;
                const dist = dx * dx + dy * dy;
                if (dist < bestDist) {
                    bestDist = dist;
                    best = new Vec2(gx, gy);
                }
            }
        }
        return best;
    }

    private randomNearGridOffset(tileSize: number): Vec2 {
        const ratio = Math.max(0.05, this.nearGridOffsetRatio);
        const range = tileSize * ratio;
        return new Vec2(
            (Math.random() * 2 - 1) * range,
            (Math.random() * 2 - 1) * range,
        );
    }

    private pickWeightedTarget(targets: PlotFlyTarget[]): PlotFlyTarget | null {
        if (!targets.length) {
            return null;
        }

        const byPhase: Record<FarmPlotPhase, PlotFlyTarget[]> = {
            [FarmPlotPhase.Idle]: [],
            [FarmPlotPhase.Planted]: [],
            [FarmPlotPhase.Growing]: [],
            [FarmPlotPhase.Mature]: [],
        };
        for (let i = 0; i < targets.length; i++) {
            byPhase[targets[i].phase].push(targets[i]);
        }

        let totalWeight = 0;
        const weighted: { phase: FarmPlotPhase; weight: number }[] = [];
        for (let i = 0; i < PHASE_ORDER.length; i++) {
            const phase = PHASE_ORDER[i];
            if (byPhase[phase].length <= 0) {
                continue;
            }
            totalWeight += PHASE_WEIGHTS[phase];
            weighted.push({ phase, weight: PHASE_WEIGHTS[phase] });
        }
        if (totalWeight <= 0) {
            return null;
        }

        let roll = Math.random() * totalWeight;
        let chosenPhase = FarmPlotPhase.Idle;
        for (let i = 0; i < weighted.length; i++) {
            roll -= weighted[i].weight;
            if (roll <= 0) {
                chosenPhase = weighted[i].phase;
                break;
            }
        }

        let pool = byPhase[chosenPhase];
        if (pool.length > 1 && this.lastTargetKey) {
            const filtered = pool.filter((item) => item.key !== this.lastTargetKey);
            if (filtered.length > 0) {
                pool = filtered;
            }
        }
        return pool[Math.floor(Math.random() * pool.length)];
    }

    private pickNextTargetAndFly() {
        if (!this.node?.isValid) {
            return;
        }
        const target = this.pickWeightedTarget(this.collectPlotTargets());
        if (!target) {
            this.scheduleRetry();
            return;
        }
        this.lastTargetKey = target.key;
        this.flyToLocal(target.localPos);
    }

    private flyToLocal(localPos: Vec3) {
        this.clearStayTimer();
        this.flying = true;
        this.playIdle();

        const start = this.node.position.clone();
        const end = new Vec3(localPos.x, localPos.y, start.z);
        if (end.x < start.x && this.node.scale.x > 0) {
            this.node.setScale(-Math.abs(this.node.scale.x), this.node.scale.y, this.node.scale.z);
        } else if (end.x > start.x && this.node.scale.x < 0) {
            this.node.setScale(Math.abs(this.node.scale.x), this.node.scale.y, this.node.scale.z);
        }
        this.syncDialogueFlip();

        tween(this.node).stop();

        const shouldTeleport = !this.isOnFarmland(start);
        if (shouldTeleport) {
            this.node.setPosition(end);
            this.onFarmland = true;
            this.flying = false;
            this.scheduleNextHop();
            return;
        }

        tween(this.node)
            .to(this.flyDurationSec, { position: end }, { easing: 'sineInOut' })
            .call(() => {
                this.onFarmland = this.isOnFarmland(end);
                this.flying = false;
                this.scheduleNextHop();
            })
            .start();
    }

    /** 农田包围盒（蜜蜂父节点本地坐标） */
    private getFarmlandBounds(): { minX: number; maxX: number; minY: number; maxY: number } | null {
        const map = this.getMapEditor();
        const parentUi = this.getMoveParentUi();
        if (!map || !parentUi) {
            return null;
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let count = 0;
        const pad = Math.max(40, map.tileSize * 1.5);
        const farmNodes = map.node.getComponentsInChildren(GameFarmNode);

        for (let i = 0; i < farmNodes.length; i++) {
            const farmNode = farmNodes[i];
            if (!farmNode.node?.active) {
                continue;
            }
            const children = farmNode.node.children;
            for (let j = 0; j < children.length; j++) {
                const plotNode = children[j];
                if (!plotNode.active) {
                    continue;
                }
                if (this.parsePlotIndex(plotNode.name) < 0) {
                    continue;
                }
                const localPos = parentUi.convertToNodeSpaceAR(plotNode.worldPosition);
                minX = Math.min(minX, localPos.x);
                maxX = Math.max(maxX, localPos.x);
                minY = Math.min(minY, localPos.y);
                maxY = Math.max(maxY, localPos.y);
                count++;
            }
        }

        if (count <= 0) {
            return null;
        }
        return {
            minX: minX - pad,
            maxX: maxX + pad,
            minY: minY - pad,
            maxY: maxY + pad,
        };
    }

    private isOnFarmland(pos?: Vec3): boolean {
        const bounds = this.getFarmlandBounds();
        if (!bounds) {
            return this.onFarmland;
        }
        const p = pos ?? this.node.position;
        return (
            p.x >= bounds.minX &&
            p.x <= bounds.maxX &&
            p.y >= bounds.minY &&
            p.y <= bounds.maxY
        );
    }

    private scheduleNextHop() {
        const span = Math.max(0, this.maxStaySec - this.minStaySec);
        const delaySec = this.minStaySec + Math.random() * span;
        this.stayTimer = setTimeout(() => {
            this.stayTimer = null;
            this.pickNextTargetAndFly();
        }, delaySec * 1000);
    }

    private scheduleRetry() {
        this.stayTimer = setTimeout(() => {
            this.stayTimer = null;
            this.pickNextTargetAndFly();
        }, 3000);
    }

    private clearStayTimer() {
        if (this.stayTimer != null) {
            clearTimeout(this.stayTimer);
            this.stayTimer = null;
        }
    }

    private hideDialogue() {
        if (this.dialogueNode?.isValid) {
            tween(this.dialogueNode).stop();
            this.dialogueNode.active = false;
        }
    }

    /** 抵消蜜蜂节点 scale.x 翻转，避免气泡文字镜像 */
    private syncDialogueFlip() {
        if (!this.dialogueNode?.isValid) {
            return;
        }
        const baseX = Math.abs(this.dialogueBaseScale.x) || 1;
        const flipX = this.node.scale.x < 0;
        this.dialogueNode.setScale(
            flipX ? -baseX : baseX,
            this.dialogueBaseScale.y,
            this.dialogueBaseScale.z,
        );
    }

    private getDialogueScale(mult = 1): Vec3 {
        const baseX = Math.abs(this.dialogueBaseScale.x) || 1;
        const flipX = this.node.scale.x < 0;
        return new Vec3(
            (flipX ? -baseX : baseX) * mult,
            this.dialogueBaseScale.y * mult,
            this.dialogueBaseScale.z,
        );
    }

    private showDialogueWithPop(text: string) {
        if (!text || !this.dialogueNode?.isValid) {
            this.hideDialogue();
            return;
        }
        if (this.dialogueLabel?.isValid) {
            this.dialogueLabel.string = text;
        }

        tween(this.dialogueNode).stop();
        this.dialogueNode.active = true;
        this.dialogueNode.setScale(this.getDialogueScale(0.15));

        const targetScale = this.getDialogueScale(1);
        tween(this.dialogueNode)
            .to(Math.max(0.12, this.dialoguePopSec), { scale: targetScale }, { easing: 'backOut' })
            .start();
    }

    private startDialogueLoop() {
        this.clearDialogueTimers();
        this.scheduleNextDialogueShow(this.dialogueHideWaitSec);
    }

    private scheduleNextDialogueShow(waitSec: number) {
        // this.dialogueTimer = setTimeout(() => {
        //     this.dialogueTimer = null;
        //     this.presentDialogue();
        // }, Math.max(0, waitSec) * 1000);
    }

    private presentDialogue() {
        const category = this.pickDialogueCategory(this.surveyFarm());
        const line = pickRandomDialogue(category, this.lastDialogueLine);
        if (!line) {
            this.scheduleNextDialogueShow(this.dialogueHideWaitSec);
            return;
        }
        this.lastDialogueLine = line;
        this.showDialogueWithPop(line);

        this.dialogueHideTimer = setTimeout(() => {
            this.dialogueHideTimer = null;
            this.hideDialogue();
            this.scheduleNextDialogueShow(this.dialogueHideWaitSec);
        }, Math.max(0.5, this.dialogueShowSec) * 1000);
    }

    private clearDialogueTimers() {
        if (this.dialogueTimer != null) {
            clearTimeout(this.dialogueTimer);
            this.dialogueTimer = null;
        }
        if (this.dialogueHideTimer != null) {
            clearTimeout(this.dialogueHideTimer);
            this.dialogueHideTimer = null;
        }
    }

    private surveyFarm(): FarmSurvey {
        const survey: FarmSurvey = {
            hasHarvestable: false,
            hasGrowing: false,
            hasPlanted: false,
            hasIdlePlot: false,
            hasSeedsInBag: false,
            hasNpcWorking: false,
        };

        const farmModel = FarmModel.getInstance();
        const nowSec = farmModel.getNowUnixSec();
        const farmCount = farmModel.getFarmCount();
        const map = this.getMapEditor();
        if (map?.node?.isValid) {
            const farmNodes = map.node.getComponentsInChildren(GameFarmNode);
            for (let i = 0; i < farmNodes.length; i++) {
                const farmNode = farmNodes[i];
                if (!farmNode.node?.active) {
                    continue;
                }
                const farmIndex = Math.floor(Number(farmNode.farmIndex) || 0);
                const children = farmNode.node.children;
                for (let j = 0; j < children.length; j++) {
                    const plotNode = children[j];
                    if (!plotNode.active) {
                        continue;
                    }
                    const plotIndex = this.parsePlotIndex(plotNode.name);
                    if (plotIndex < 0) {
                        continue;
                    }
                    const farmId = toServerFarmId(farmIndex, plotIndex, farmCount);
                    if (farmId == null) {
                        continue;
                    }
                    const plot = farmModel.getPlot(farmId);
                    if (!plot) {
                        continue;
                    }
                    const phase = resolveFarmPlotPhase(plot, nowSec);
                    if (phase === FarmPlotPhase.Mature) {
                        survey.hasHarvestable = true;
                    } else if (phase === FarmPlotPhase.Growing) {
                        survey.hasGrowing = true;
                    } else if (phase === FarmPlotPhase.Planted) {
                        survey.hasPlanted = true;
                    } else if (phase === FarmPlotPhase.Idle) {
                        survey.hasIdlePlot = true;
                    }
                }
            }
        }

        const bag = BagModel.getInstance();
        const seedRows = buildDisplayableBasicSeedRows();
        for (let i = 0; i < seedRows.length; i++) {
            if (bag.getItemCount(seedRows[i].itemId) > 0) {
                survey.hasSeedsInBag = true;
                break;
            }
        }

        const npcList = UGCModel.getInstance().myNpcList?.length
            ? UGCModel.getInstance().myNpcList
            : UGCModel.getInstance().npcList;
        for (let i = 0; i < (npcList || []).length; i++) {
            if (Number(npcList[i]?.work_status ?? 0) === 1) {
                survey.hasNpcWorking = true;
                break;
            }
        }

        return survey;
    }

    /** 对话优先级：可收获 > 种植中 > 有种子未播 > 没种子 > 没 NPC 工作 */
    private pickDialogueCategory(survey: FarmSurvey): GameMifengDialogueCategory {
        if (survey.hasHarvestable) {
            return GameMifengDialogueCategory.Harvestable;
        }
        if (survey.hasGrowing || survey.hasPlanted) {
            return GameMifengDialogueCategory.Growing;
        }
        if (survey.hasSeedsInBag && survey.hasIdlePlot) {
            return GameMifengDialogueCategory.HasSeedsNotPlanted;
        }
        if (!survey.hasSeedsInBag) {
            return GameMifengDialogueCategory.NoSeeds;
        }
        if (!survey.hasNpcWorking) {
            return GameMifengDialogueCategory.NoNpcWorking;
        }
        return GameMifengDialogueCategory.Growing;
    }
}
