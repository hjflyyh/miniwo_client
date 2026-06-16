import { _decorator, Component, Label, Node, UITransform, Vec2, Vec3 } from 'cc';
import { MapEditor } from './MapEditor';
import { CustomizeMapData, NpcSpriteAnimations } from './CustomizeMap/CustomizeMapData';
import { AppConst } from '../../../scripts/AppConst';
import { Utils } from '../../../scripts/Utils/Utils';
import {
    GenericSpritesheetAnimator,
    ZUOZHU_ACTION_HORIZONTAL_SLICES,
} from 'db://assets/scripts/Utils/GenericSpritesheetAnimator';

const { ccclass, property } = _decorator;

enum NpcState {
    Idle = 1,
    Move = 2,
}

type NpcSpriteAnimKey = 'idle' | 'walking_left' | 'walking_up' | 'walking_down';

interface NpcMovePacket {
    x: number;
    y: number;
    tile_x?: number;
    tile_y?: number;
    target_tile_x?: number;
    target_tile_y?: number;
    timestamp?: number;
}

interface MoveSample {
    pos: Vec3;
    tile: Vec2;
    targetTile: Vec2;
    ts: number;
}

@ccclass('MapNpc')
export class MapNpc extends Component {
    public map: MapEditor = null!;
    public customizeMapData: CustomizeMapData = null!;

    @property
    public npcId = 0;

    // 服务器 x/y 是否已经是 npcLayer 本地坐标
    @property
    public serverXYIsNpcLayerLocal = true;

    // 兜底移动速度（像素/秒）：无后续样本时用于收敛到目标点
    @property
    public baseSpeedPxPerSec = 30;

    @property
    public maxSpeedPxPerSec = 120;

    // 到点阈值（像素）
    @property
    public arriveEpsPx = 1.5;

    // 动画进入/退出阈值，避免 walk/idle 抖动
    @property
    public moveStartDistPx = 0.8;

    @property
    public idleEnterDistPx = 0.2;

    // 至少保持 walk 的时长（毫秒），避免一闪而过
    @property
    public minWalkHoldMs = 180;

    // 按时间戳滞后量调整速度：正值表示本地时间落后于目标时间戳
    @property
    public lagTuneMs = 300;

    @property
    public minLagSpeedScale = 0.45;

    @property
    public maxLagSpeedScale = 3.0;

    // 与服务器偏差超过该值时，硬纠正（像素）
    @property
    public hardSnapDistPx = 96;

    // 偏差较小时的软纠正强度（0~1）
    @property
    public softCorrectAlpha = 0.1;

    @property
    public queueMaxSize = 120;

    // 近距离包抑制：与当前坐标距离小于该值时，先缓存不立即入队
    @property
    public nearPacketDistPx = 5;

    // 缓存包静默多久后释放（毫秒）
    @property
    public nearPacketDelayMs = 100;

    // 缓存包最长滞留（毫秒），避免一直不释放
    @property
    public nearPacketMaxHoldMs = 260;

    // 插值回放延迟（毫秒）：渲染时间落后于本地服务器时间，避免队列被瞬间吃空
    @property
    public interpolationDelayMs = 120;

    // 后端约 10 次/秒广播时，允许短时间外推以减少“9px 一跳”的断续感
    @property
    public maxExtrapolateMs = 180;

    // 后端“仅移动时广播”，无包超过该时长则认为应进入停稳
    @property
    public stopNoPacketMs = 280;

    // 中等误差阈值（像素）：超过后提高纠偏力度，避免长时间拖尾
    @property
    public mediumCorrectDistPx = 24;

    // 中等误差下的最小纠偏强度（0~1）
    @property
    public mediumCorrectAlpha = 0.35;

    // 本帧位移达到该阈值即视为移动（动画兜底）
    @property
    public frameMoveAnimEpsPx = 0.05;

    @property(Label)
    dialogueLabel : Label

    @property(Node)
    dialogueNode : Node

    private npcNode: Node = null;
    private genericSpritesheetAnimator: GenericSpritesheetAnimator = null;

    private spriteAnimations: NpcSpriteAnimations = {};
    private currentAnimKey = '';
    private moveAnimKey: NpcSpriteAnimKey = 'walking_left';
    private animLoadToken = 0;

    private state: NpcState = NpcState.Idle;
    public inited = false;

    private curTile = new Vec2(0, 0);
    private targetTile = new Vec2(0, 0);
    private lastMoveMarkMs = 0;

    private currentSample: MoveSample | null = null;
    private moveQueue: MoveSample[] = [];
    private pendingNearSample: MoveSample | null = null;
    private pendingNearFirstMs = 0;
    private pendingNearLastMs = 0;
    private movedByQueueSyncThisFrame = false;
    private lastSegVelocity = new Vec2(0, 0); // 像素/秒
    private useHorizontalMoveAnim = false;
    private facingScaleX = 1;

    start() {
        this.schedule(()=>{
            this.closeDialogTime--;
            if(this.closeDialogTime <= 0){  
                this.closeDialogTime = 0;
                this.dialogueNode.active = false
            }
        } , 1);
    }

    initNpcNode() {
        this.npcNode = this.node.getChildByName('npc')!;
        this.dialogueNode = this.node.getChildByName('dialogueNode');
        this.dialogueLabel = this.dialogueNode.getChildByName('dialogueLabel').getComponent(Label);
        this.dialogueNode.active = false;

        this.genericSpritesheetAnimator = this.npcNode?.getComponent(GenericSpritesheetAnimator) ?? null;
        this.setState(NpcState.Idle, true);
    }

    public setSpriteAnimations(anims: NpcSpriteAnimations) {
        this.spriteAnimations = { ...(anims ?? {}) };
        this.currentAnimKey = '';
        this.playSpriteByKey('idle', true);
    }

    private resolveAnimUrl(key: NpcSpriteAnimKey): string {
        const a = this.spriteAnimations;
        switch (key) {
            case 'idle':
                return String(a.idle_url ?? '').trim();
            case 'walking_left':
                return String(a.walking_left_url ?? '').trim();
            case 'walking_up':
                return String(a.walking_up_url ?? a.walking_left_url ?? '').trim();
            case 'walking_down':
                return String(a.walking_down_url ?? a.walking_left_url ?? '').trim();
            default:
                return '';
        }
    }

    private animKeyToSliceAction(key: NpcSpriteAnimKey): string {
        switch (key) {
            case 'idle':
                return 'idle';
            case 'walking_left':
                return 'walking-left';
            case 'walking_up':
                return 'walking-up';
            case 'walking_down':
                return 'walking-down';
            default:
                return 'idle';
        }
    }

    private playSpriteByKey(key: NpcSpriteAnimKey, force = false) {
        if (!this.genericSpritesheetAnimator?.isValid) {
            return;
        }
        const url = this.resolveAnimUrl(key);
        if (!url) {
            return;
        }
        if (!force && this.currentAnimKey === key) {
            return;
        }
        this.currentAnimKey = key;

        const actionName = this.animKeyToSliceAction(key);
        const cols = ZUOZHU_ACTION_HORIZONTAL_SLICES[actionName] ?? 8;
        const token = ++this.animLoadToken;

        this.genericSpritesheetAnimator.loadAndPlay(url, actionName, cols, (err) => {
            if (token !== this.animLoadToken) {
                return;
            }
            if (err) {
                console.warn(`[MapNpc] sprite load failed npc=${this.npcId} key=${key}`, err);
            }
        });
    }

    update(dt: number) {
        if (!this.inited) return;
        const nowMs = this.getNowServerMs();
        const renderMs = nowMs - Math.max(0, this.interpolationDelayMs);
        this.movedByQueueSyncThisFrame = false;
        this.flushPendingNearSample(nowMs, false);
        this.consumeQueueByTime(renderMs);
        this.samplePositionByTime(renderMs, dt);
    }

    private closeDialogTime = 10
    private dialogTime = 10
    public onServerDialog(data){
        if(data.dialogue_idle != null && data.dialogue_idle["id"] != null && AppConst.LanguageManager.getDialogString(data.dialogue_idle["id"]) != ""){
            this.dialogueNode.active = true
            this.dialogueLabel.string = AppConst.LanguageManager.getDialogString(data.dialogue_idle["id"])
            this.closeDialogTime = this.dialogTime
        }else if(data.dialogStr != null && data.dialogStr != ""){
            this.dialogueNode.active = true
            this.dialogueLabel.string = data.dialogStr
            this.closeDialogTime = this.dialogTime
        }else{
            // this.dialogueNode.active = false
        }
    }

    // public onServerDialogStr(data){
    //     this.dialogueNode.active = true
    //     this.dialogueLabel.string = data.dialogStr;
    // }    

    /**
     * 服务器回包入口：每次收到移动数据调用
     */
    public onServerMove(data: NpcMovePacket) {
        // this.dialogueNode.active = false
        if (data == null || data.x == null || data.y == null) return;

        const serverPos = this.serverToNpcLayerPos(data.x, data.y);
        const tile = Number.isFinite(data.tile_x) && Number.isFinite(data.tile_y)
            ? new Vec2(data.tile_x!, data.tile_y!)
            : this.curTile.clone();
        const targetTile = Number.isFinite(data.target_tile_x) && Number.isFinite(data.target_tile_y)
            ? new Vec2(data.target_tile_x!, data.target_tile_y!)
            : tile.clone();

        const rawTs = Number(data.timestamp);
        const ts = Number.isFinite(rawTs) && rawTs > 0
            ? (rawTs < 1e12 ? rawTs * 1000 : rawTs)
            : this.getNowServerMs();

        const sample: MoveSample = {
            pos: new Vec3(serverPos.x, serverPos.y, 0),
            tile,
            targetTile,
            ts,
        };

        // 初始化首帧
        if (!this.inited) {
            this.inited = true;
            this.currentSample = sample;
            this.curTile.set(tile.x, tile.y);
            this.targetTile.set(targetTile.x, targetTile.y);
            this.node.setPosition(sample.pos);
            const moving = !this.curTile.equals(this.targetTile);
            if (moving) {
                this.lastMoveMarkMs = this.getNowServerMs();
            }
            this.setState(moving ? NpcState.Move : NpcState.Idle);
            return;
        }

        // 丢弃乱序旧包
        const lastTs = this.moveQueue.length > 0
            ? this.moveQueue[this.moveQueue.length - 1].ts
            : (this.currentSample ? this.currentSample.ts : 0);
        const pendingTs = this.pendingNearSample ? this.pendingNearSample.ts : 0;
        const maxSeenTs = Math.max(lastTs, pendingTs);
        if (ts < maxSeenTs) {
            return;
        }
        // 同时间戳包会导致消费抖动，做单调递增保护
        if (ts === maxSeenTs) {
            sample.ts = maxSeenTs + 1;
        }

        const nowMs = this.getNowServerMs();
        if (this.shouldDeferNearSample(sample)) {
            if (!this.pendingNearSample) {
                this.pendingNearFirstMs = nowMs;
            }
            this.pendingNearSample = sample;
            this.pendingNearLastMs = nowMs;
            return;
        }

        // 新的“有效位移包”到来时，先把缓存中的近距离包按时间顺序释放
        this.flushPendingNearSample(nowMs, true);
        this.enqueueSample(sample);
    }

    private consumeQueueByTime(nowMs: number) {
        if (!this.currentSample && this.moveQueue.length > 0) {
            const prev = this.node.position;
            const prevSample = this.currentSample;
            this.currentSample = this.moveQueue.shift()!;
            this.updateSegmentVelocity(prevSample, this.currentSample);
            this.node.setPosition(this.currentSample.pos);
            if (Math.hypot(this.currentSample.pos.x - prev.x, this.currentSample.pos.y - prev.y) > this.frameMoveAnimEpsPx) {
                this.movedByQueueSyncThisFrame = true;
            }
            this.curTile.set(this.currentSample.tile.x, this.currentSample.tile.y);
            this.targetTile.set(this.currentSample.targetTile.x, this.currentSample.targetTile.y);
        }
        while (this.currentSample && this.moveQueue.length > 0 && this.moveQueue[0].ts <= nowMs) {
            const prev = this.node.position;
            const prevSample = this.currentSample;
            this.currentSample = this.moveQueue.shift()!;
            this.updateSegmentVelocity(prevSample, this.currentSample);
            this.node.setPosition(this.currentSample.pos);
            if (Math.hypot(this.currentSample.pos.x - prev.x, this.currentSample.pos.y - prev.y) > this.frameMoveAnimEpsPx) {
                this.movedByQueueSyncThisFrame = true;
            }
            this.curTile.set(this.currentSample.tile.x, this.currentSample.tile.y);
            this.targetTile.set(this.currentSample.targetTile.x, this.currentSample.targetTile.y);
        }
    }

    private samplePositionByTime(nowMs: number, dt: number) {
        if (!this.currentSample) {
            this.applyAnimState(false, nowMs);
            return;
        }

        const next = this.moveQueue.length > 0 ? this.moveQueue[0] : null;
        if (!next) {
            const cur = this.node.position;
            const sinceSampleMs = Math.max(0, nowMs - this.currentSample.ts);
            const staleNoPacket = sinceSampleMs >= this.stopNoPacketMs;
            let target = this.currentSample.pos;

            // 仅做短时外推，匹配后端约 100ms 一次广播的节奏
            if (!staleNoPacket && sinceSampleMs > 0 && sinceSampleMs <= this.maxExtrapolateMs) {
                const extrapolateSec = sinceSampleMs / 1000;
                const vx = this.lastSegVelocity.x;
                const vy = this.lastSegVelocity.y;
                if (Math.hypot(vx, vy) > 0.01) {
                    target = new Vec3(
                        this.currentSample.pos.x + vx * extrapolateSec,
                        this.currentSample.pos.y + vy * extrapolateSec,
                        0
                    );
                }
            } else if (staleNoPacket) {
                // 长时间无包视为停稳，避免角色持续“空走”
                this.lastSegVelocity.set(0, 0);
            }
            this.updateMoveFacingByTarget(target);

            const dist = Math.hypot(target.x - cur.x, target.y - cur.y);
            const catchupSpeed = Math.min(this.maxSpeedPxPerSec, Math.max(this.baseSpeedPxPerSec, dist * 2));
            const moved = this.stepTowards(target, catchupSpeed, dt);
            const movingByTile = !this.curTile.equals(this.targetTile);
            const moving = !staleNoPacket && (moved || this.movedByQueueSyncThisFrame || (dist > this.moveStartDistPx && movingByTile));
            this.applyAnimState(moving, nowMs);
            return;
        }

        const durationMs = Math.max(1, next.ts - this.currentSample.ts);
        let alpha = (nowMs - this.currentSample.ts) / durationMs;
        if (alpha < 0) alpha = 0;
        if (alpha > 1) alpha = 1;

        const target = new Vec3(
            this.currentSample.pos.x + (next.pos.x - this.currentSample.pos.x) * alpha,
            this.currentSample.pos.y + (next.pos.y - this.currentSample.pos.y) * alpha,
            0
        );
        this.updateMoveFacingByTarget(target);
        const segDist = Math.hypot(next.pos.x - this.currentSample.pos.x, next.pos.y - this.currentSample.pos.y);
        // 按“目标时间戳与本地时间”的差值动态调速：落后越多越快，超前则更慢
        const lagMs = nowMs - next.ts;
        const lagScaleRaw = 1 + lagMs / Math.max(1, this.lagTuneMs);
        const lagScale = Math.max(this.minLagSpeedScale, Math.min(this.maxLagSpeedScale, lagScaleRaw));
        const segSpeedBase = Math.min(this.maxSpeedPxPerSec, Math.max(this.baseSpeedPxPerSec, segDist / durationMs * 1000));
        const segSpeed = Math.min(this.maxSpeedPxPerSec * this.maxLagSpeedScale, segSpeedBase * lagScale);
        const moved = this.followTargetWithCorrection(target, segSpeed, dt);

        const moveBySample = segDist > this.moveStartDistPx;
        const movingByTile = !this.currentSample.tile.equals(this.currentSample.targetTile) || !next.tile.equals(next.targetTile);
        const isMoving = moved || this.movedByQueueSyncThisFrame || (moveBySample && movingByTile);
        this.applyAnimState(isMoving, nowMs);
    }

    private shouldDeferNearSample(sample: MoveSample): boolean {
        const cur = this.node.position;
        const dx = sample.pos.x - cur.x;
        const dy = sample.pos.y - cur.y;
        const dist = Math.hypot(dx, dy);
        if (dist > this.nearPacketDistPx) {
            return false;
        }
        // 若 tile 与目标 tile 不同，优先保留移动响应，不做抑制
        if (!sample.tile.equals(sample.targetTile)) {
            return false;
        }
        return true;
    }

    private flushPendingNearSample(nowMs: number, force: boolean) {
        if (!this.pendingNearSample) {
            return;
        }
        if (force) {
            this.enqueueSample(this.pendingNearSample);
            this.clearPendingNearSample();
            return;
        }

        const firstElapsed = nowMs - this.pendingNearFirstMs;
        const lastElapsed = nowMs - this.pendingNearLastMs;
        const shouldFlush = firstElapsed >= this.nearPacketMaxHoldMs || lastElapsed >= this.nearPacketDelayMs;
        if (!shouldFlush) {
            return;
        }

        this.enqueueSample(this.pendingNearSample);
        this.clearPendingNearSample();
    }

    private clearPendingNearSample() {
        this.pendingNearSample = null;
        this.pendingNearFirstMs = 0;
        this.pendingNearLastMs = 0;
    }

    private enqueueSample(sample: MoveSample) {
        this.moveQueue.push(sample);
        if (this.moveQueue.length > this.queueMaxSize) {
            this.moveQueue.shift();
        }
    }

    private followTargetWithCorrection(target: Vec3, speedPx: number, dt: number): boolean {
        const cur = this.node.position;
        const err = Math.hypot(target.x - cur.x, target.y - cur.y);
        if (err <= 0.01) {
            return false;
        }
        if (err > this.hardSnapDistPx) {
            this.node.setPosition(target.x, target.y, cur.z);
            return true;
        }
        const maxStep = Math.max(0, speedPx * Math.max(dt, 1 / 120));
        const alphaBySpeed = maxStep <= 0 ? this.softCorrectAlpha : Math.min(1, maxStep / Math.max(err, 0.0001));
        const minAlpha = err > this.mediumCorrectDistPx
            ? this.mediumCorrectAlpha
            : this.softCorrectAlpha;
        const alpha = Math.max(minAlpha, alphaBySpeed);
        this.node.setPosition(
            cur.x + (target.x - cur.x) * alpha,
            cur.y + (target.y - cur.y) * alpha,
            cur.z
        );
        return true;
    }

    private updateSegmentVelocity(from: MoveSample | null, to: MoveSample | null) {
        if (!from || !to) {
            return;
        }
        const dtSec = Math.max(0.001, (to.ts - from.ts) / 1000);
        const vx = (to.pos.x - from.pos.x) / dtSec;
        const vy = (to.pos.y - from.pos.y) / dtSec;
        if (!Number.isFinite(vx) || !Number.isFinite(vy)) {
            return;
        }
        this.lastSegVelocity.set(vx, vy);
    }

    private stepTowards(target: Vec3, speedPx: number, dt: number): boolean {
        const cur = this.node.position;
        const dx = target.x - cur.x;
        const dy = target.y - cur.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= this.arriveEpsPx) {
            this.node.setPosition(target.x, target.y, cur.z);
            return false;
        }
        const step = speedPx * Math.max(dt, 1 / 120);
        const ratio = Math.min(1, step / Math.max(dist, 0.0001));
        this.node.setPosition(cur.x + dx * ratio, cur.y + dy * ratio, cur.z);
        return true;
    }

    private getNowServerMs(): number {
        return Utils.getServerNowMs();
    }

    private applyAnimState(isMoving: boolean, nowMs: number) {
        const cur = this.node.position;
        const samplePos = this.currentSample?.pos;
        const nearTarget = samplePos
            ? Math.hypot(samplePos.x - cur.x, samplePos.y - cur.y) <= this.idleEnterDistPx
            : true;
        const hasQueue = this.moveQueue.length > 0;

        if (isMoving) {
            this.lastMoveMarkMs = nowMs;
            this.setState(NpcState.Move);
            return;
        }

        // 防止 walk 一闪而过：至少保持一段时间，且接近目标并且队列没有待移动段时才 idle
        const holdWalk = nowMs - this.lastMoveMarkMs < this.minWalkHoldMs;
        if (holdWalk || !nearTarget || hasQueue) {
            this.setState(NpcState.Move);
            return;
        }
        this.setState(NpcState.Idle);
    }

    /**
     * 把逻辑格中心转成 npcLayer 本地坐标
     */
    /**
     * 服务器 x/y -> npcLayer 本地坐标
     * - serverXYIsNpcLayerLocal=true: 直接使用
     * - false: 视为地图像素坐标（左上原点）
     */
    private serverToNpcLayerPos(x: number, y: number): Vec3 {
        if (!this.map) {
            return new Vec3(x, y, 0);
        }
        if (this.serverXYIsNpcLayerLocal) {
            return new Vec3(x, y, 0);
        }

        // 地图像素（左上原点） -> mapContainer 本地（中心原点）
        const mapPixelW = this.map.mapWidth * this.map.tileSize;
        const mapPixelH = this.map.mapHeight * this.map.tileSize;
        const mapLocalX = x - mapPixelW * 0.5;
        const mapLocalY = mapPixelH * 0.5 - y;

        const world = this.map.mapContainer
            .getComponent(UITransform)!
            .convertToWorldSpaceAR(new Vec3(mapLocalX, mapLocalY, 0));

        return this.map.npcLayer.getComponent(UITransform)!.convertToNodeSpaceAR(world);
    }

    private setState(next: NpcState, force = false) {
        const prevState = this.state;
        if (!force && prevState === next && next !== NpcState.Move) {
            return;
        }
        this.state = next;

        if (next === NpcState.Move) {
            this.playSpriteByKey(this.moveAnimKey, force || prevState !== next);
        } else {
            this.playSpriteByKey('idle', force || prevState !== next);
        }
    }

    private updateMoveFacingByTarget(target: Vec3) {
        const cur = this.node.position;
        const dx = target.x - cur.x;
        const dy = target.y - cur.y;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
            return;
        }
        const horizontal = Math.abs(dx) >= Math.abs(dy);
        this.useHorizontalMoveAnim = horizontal;
        if (horizontal) {
            this.moveAnimKey = 'walking_left';
            this.facingScaleX = dx >= 0 ? -1 : 1;
            if (this.npcNode?.isValid) {
                this.npcNode.setScale(this.facingScaleX, 1, 1);
            }
        } else {
            this.moveAnimKey = dy >= 0 ? 'walking_up' : 'walking_down';
            if (this.npcNode?.isValid) {
                this.npcNode.setScale(1, 1, 1);
            }
        }
        if (this.state === NpcState.Move) {
            this.playSpriteByKey(this.moveAnimKey);
        }
    }
}