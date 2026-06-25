import { _decorator, Component, Node, sp, tween, UITransform, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

const FIRE_ANIM = 'fire';
/** spine 资源中待机动画名为 ldle */
const IDLE_ANIM = 'ldle';

@ccclass('chitang')
export class chitang extends Component {
    @property(sp.Skeleton)
    spine: sp.Skeleton = null!;

    /** 蝴蝶节点（自行拖拽） */
    @property(Node)
    hudie: Node = null;

    /** 池塘飞行范围节点（不绑则使用子节点 Sprite） */
    @property(Node)
    flyArea: Node = null;

    /** 单次飞行时长（秒） */
    @property
    flyDurationSec = 1.6;

    /** 落点最短停留（秒） */
    @property
    minStaySec = 0.8;

    /** 落点最长停留（秒） */
    @property
    maxStaySec = 2.2;

    /** 池塘边缘内缩（像素） */
    @property
    boundsPadding = 24;

    private stayTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly hudieBaseScale = new Vec3(1, 1, 1);

    start() {
        this.playIdle();
        this.startHudieFlight();
    }

    onClick() {
        if (!this.spine?.isValid) {
            return;
        }
        if (this.isPlayingFire()) {
            return;
        }
        this.spine.setCompleteListener(this.onFireComplete);
        this.spine.setAnimation(0, FIRE_ANIM, false);
    }

    private onFireComplete = (entry?: sp.spine.TrackEntry) => {
        if (!this.spine?.isValid) {
            return;
        }
        if (entry?.animation?.name !== FIRE_ANIM) {
            return;
        }
        this.spine.setCompleteListener(null);
        this.playIdle();
    };

    private playIdle() {
        if (!this.spine?.isValid) {
            return;
        }
        this.spine.setAnimation(0, IDLE_ANIM, true);
    }

    private isPlayingFire(): boolean {
        const entry = this.spine?.getCurrent(0);
        return entry?.animation?.name === FIRE_ANIM && !entry.isComplete();
    }

    private startHudieFlight() {
        if (!this.hudie?.isValid) {
            return;
        }
        this.hudieBaseScale.set(this.hudie.scale);
        const startPos = this.pickRandomPointInPond();
        if (startPos) {
            this.hudie.setPosition(startPos);
        }
        this.scheduleOnce(() => this.flyHudieToNextPoint(), 0.3);
    }

    private flyHudieToNextPoint() {
        if (!this.hudie?.isValid) {
            return;
        }
        const target = this.pickRandomPointInPond();
        if (!target) {
            this.scheduleHudieRetry();
            return;
        }

        const start = this.hudie.position.clone();
        if (target.x < start.x && this.hudie.scale.x > 0) {
            this.hudie.setScale(-Math.abs(this.hudieBaseScale.x), this.hudieBaseScale.y, this.hudieBaseScale.z);
        } else if (target.x > start.x && this.hudie.scale.x < 0) {
            this.hudie.setScale(Math.abs(this.hudieBaseScale.x), this.hudieBaseScale.y, this.hudieBaseScale.z);
        }

        tween(this.hudie).stop();
        tween(this.hudie)
            .to(this.flyDurationSec, { position: target }, { easing: 'sineInOut' })
            .call(() => this.scheduleHudieStay())
            .start();
    }

    private scheduleHudieStay() {
        this.clearHudieStayTimer();
        const span = Math.max(0, this.maxStaySec - this.minStaySec);
        const delaySec = this.minStaySec + Math.random() * span;
        this.stayTimer = setTimeout(() => {
            this.stayTimer = null;
            this.flyHudieToNextPoint();
        }, delaySec * 1000);
    }

    private scheduleHudieRetry() {
        this.clearHudieStayTimer();
        this.stayTimer = setTimeout(() => {
            this.stayTimer = null;
            this.flyHudieToNextPoint();
        }, 2000);
    }

    private clearHudieStayTimer() {
        if (this.stayTimer != null) {
            clearTimeout(this.stayTimer);
            this.stayTimer = null;
        }
    }

    private resolveFlyAreaNode(): Node | null {
        if (this.flyArea?.isValid) {
            return this.flyArea;
        }
        const sprite = this.node.getChildByName('Sprite');
        if (sprite?.isValid) {
            return sprite;
        }
        return this.node;
    }

    private pickRandomPointInPond(): Vec3 | null {
        if (!this.hudie?.isValid) {
            return null;
        }
        const areaNode = this.resolveFlyAreaNode();
        const areaUi = areaNode?.getComponent(UITransform);
        const parentUi = this.hudie.parent?.getComponent(UITransform);
        if (!areaUi || !parentUi) {
            return null;
        }

        const pad = Math.max(0, this.boundsPadding);
        const left = -areaUi.width * areaUi.anchorX + pad;
        const right = areaUi.width * (1 - areaUi.anchorX) - pad;
        const bottom = -areaUi.height * areaUi.anchorY + pad;
        const top = areaUi.height * (1 - areaUi.anchorY) - pad;
        if (right <= left || top <= bottom) {
            return null;
        }

        const worldLeftBottom = areaUi.convertToWorldSpaceAR(new Vec3(left, bottom, 0));
        const worldRightTop = areaUi.convertToWorldSpaceAR(new Vec3(right, top, 0));
        const localLeftBottom = parentUi.convertToNodeSpaceAR(worldLeftBottom);
        const localRightTop = parentUi.convertToNodeSpaceAR(worldRightTop);

        const x = localLeftBottom.x + Math.random() * (localRightTop.x - localLeftBottom.x);
        const y = localLeftBottom.y + Math.random() * (localRightTop.y - localLeftBottom.y);
        return new Vec3(x, y, this.hudie.position.z);
    }

    onDestroy() {
        this.clearHudieStayTimer();
        if (this.hudie?.isValid) {
            tween(this.hudie).stop();
        }
        if (this.spine?.isValid) {
            this.spine.setCompleteListener(null);
        }
    }
}
