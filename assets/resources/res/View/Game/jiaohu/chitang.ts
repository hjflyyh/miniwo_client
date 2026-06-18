import { _decorator, Component, sp } from 'cc';
const { ccclass, property } = _decorator;

const FIRE_ANIM = 'fire';
/** spine 资源中待机动画名为 ldle */
const IDLE_ANIM = 'ldle';

@ccclass('chitang')
export class chitang extends Component {
    @property(sp.Skeleton)
    spine: sp.Skeleton = null!;

    start() {
        this.playIdle();
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

    onDestroy() {
        if (this.spine?.isValid) {
            this.spine.setCompleteListener(null);
        }
    }
}
