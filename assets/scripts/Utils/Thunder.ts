import { _decorator, AudioClip, AudioSource, Component, Node, Sprite, tween, UIOpacity, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 简化版雷电：闪电图闪烁 + 全屏微闪（可选）+ 延迟雷声（可选）。
 * 请在编辑器中拖入 thunderBg（半透明白底等）、thunderImg（天气-雷电图），节点上建议带 Sprite 或 UIOpacity。
 */
@ccclass('Thunder')
export class Thunder extends Component {
    @property(Node)
    thunderBg: Node = null;

    @property(Node)
    thunderImg: Node = null;

    @property({ tooltip: '两次闪电之间的最短间隔（秒）' })
    minStrikeInterval = 2.2;

    @property({ tooltip: '两次闪电之间的最长间隔（秒）' })
    maxStrikeInterval = 5.5;

    @property({ tooltip: '是否随机出现第二次微弱闪一下' })
    doubleFlash = true;

    @property({ tooltip: '最亮一挡保持时间（秒），便于看清闪电图' })
    peakHoldSec = 0.18;

    @property({ tooltip: '变暗后中间挡保持时间（秒），仍略可见再消' })
    dimHoldSec = 0.22;

    @property({ tooltip: '二次弱闪保持时间（秒）' })
    doubleFlashHoldSec = 0.14;

    @property({ tooltip: '结束前渐暗一挡：闪电图透明度 0~1' })
    tailImgAlpha = 0.22;

    @property({ tooltip: '结束前渐暗一挡：背景闪透明度 0~1' })
    tailBgAlpha = 0.08;

    @property({ tooltip: '渐暗挡保持时间（秒），再完全关掉' })
    tailHoldSec = 0.16;

    @property({ tooltip: '闪电图 X 缩放相对基准的随机倍数下限（每次闪击重新随机）' })
    boltScaleXMulMin = 0.86;

    @property({ tooltip: '闪电图 X 缩放相对基准的随机倍数上限' })
    boltScaleXMulMax = 1.18;

    @property({ tooltip: '闪电图随机旋转角度下限（度），相对基准 angle' })
    boltAngleJitterMin = -16;

    @property({ tooltip: '闪电图随机旋转角度上限（度）' })
    boltAngleJitterMax = 16;

    @property(AudioClip)
    thunderClip: AudioClip = null;

    @property({ tooltip: '雷声相对闪电画面延迟（秒）下限' })
    thunderSoundDelayMin = 0.35;

    @property({ tooltip: '雷声相对闪电画面延迟（秒）上限' })
    thunderSoundDelayMax = 1.1;

    private _audio: AudioSource = null;

    /** 闪电节点在编辑器里设的初始 scale / angle，每次闪击在此基础上随机 */
    private _boltBaseReady = false;
    private readonly _boltBaseScale = new Vec3(1, 1, 1);
    private _boltBaseAngle = 0;

    onEnable() {
        this._boltBaseReady = false;
        this._prepareHidden();
        this._ensureAudio();
        this._scheduleNextStrike();
    }

    onDisable() {
        this.unscheduleAllCallbacks();
        tween(this.node).stop();
        if (this.thunderBg?.isValid) tween(this.thunderBg).stop();
        if (this.thunderImg?.isValid) tween(this.thunderImg).stop();
    }

    start() {
        this._prepareHidden();
    }

    private _ensureAudio() {
        if (!this.thunderClip) return;
        this._audio = this.getComponent(AudioSource);
        if (!this._audio) {
            this._audio = this.addComponent(AudioSource);
            this._audio.playOnAwake = false;
        }
    }

    private _prepareHidden() {
        this._setVisualAlpha(this.thunderBg, 0);
        this._setVisualAlpha(this.thunderImg, 0);
    }

    /** 0~1，优先 UIOpacity，否则改 Sprite 的 color.a */
    private _setVisualAlpha(node: Node | null, alpha01: number) {
        if (!node || !node.isValid) return;
        const a = Math.max(0, Math.min(255, Math.round(alpha01 * 255)));
        const ui = node.getComponent(UIOpacity);
        if (ui) {
            ui.opacity = a;
            return;
        }
        const sp = node.getComponent(Sprite);
        if (sp) {
            const c = sp.color.clone();
            c.a = a;
            sp.color = c;
        }
    }

    private _scheduleNextStrike() {
        const min = Math.min(this.minStrikeInterval, this.maxStrikeInterval);
        const max = Math.max(this.minStrikeInterval, this.maxStrikeInterval);
        const gap = min + Math.random() * (max - min);
        this.scheduleOnce(() => this._playStrike(), gap);
    }

    private _ensureBoltBase() {
        if (!this.thunderImg?.isValid || this._boltBaseReady) return;
        Vec3.copy(this._boltBaseScale, this.thunderImg.scale);
        this._boltBaseAngle = this.thunderImg.angle;
        this._boltBaseReady = true;
    }

    /** 每次闪击：随机 X 向缩放 + 旋转，相对场景里设的基准 */
    private _applyBoltVariation() {
        if (!this.thunderImg?.isValid) return;
        this._ensureBoltBase();
        const lo = Math.min(this.boltScaleXMulMin, this.boltScaleXMulMax);
        const hi = Math.max(this.boltScaleXMulMin, this.boltScaleXMulMax);
        const mul = lo + Math.random() * (hi - lo);
        const sx = this._boltBaseScale.x * mul;
        this.thunderImg.setScale(sx, this._boltBaseScale.y, this._boltBaseScale.z);
        const aLo = Math.min(this.boltAngleJitterMin, this.boltAngleJitterMax);
        const aHi = Math.max(this.boltAngleJitterMin, this.boltAngleJitterMax);
        this.thunderImg.angle = this._boltBaseAngle + (aLo + Math.random() * (aHi - aLo));
    }

    private _restoreBoltTransform() {
        if (!this.thunderImg?.isValid || !this._boltBaseReady) return;
        this.thunderImg.setScale(this._boltBaseScale);
        this.thunderImg.angle = this._boltBaseAngle;
    }

    private _playStrike() {
        const doDouble = this.doubleFlash && Math.random() < 0.38;

        const peakHold = Math.max(0.05, this.peakHoldSec);
        const dimHold = Math.max(0.04, this.dimHoldSec);
        const doubleHold = Math.max(0.05, this.doubleFlashHoldSec);
        const tailHold = Math.max(0.05, this.tailHoldSec);

        // 闪电主闪 + 背景亮 → 保持可读 → 变暗 →（可选）弱闪 → 渐暗 → 关闭
        tween(this.node)
            .call(() => {
                this._applyBoltVariation();
                this._setVisualAlpha(this.thunderImg, 1);
                this._setVisualAlpha(this.thunderBg, 0.42);
            })
            .delay(peakHold)
            .call(() => {
                this._setVisualAlpha(this.thunderImg, 0.38);
                this._setVisualAlpha(this.thunderBg, 0.14);
            })
            .delay(dimHold)
            .call(() => {
                if (doDouble) {
                    this._setVisualAlpha(this.thunderImg, 0.72);
                    this._setVisualAlpha(this.thunderBg, 0.22);
                } else {
                    this._setVisualAlpha(this.thunderImg, this.tailImgAlpha);
                    this._setVisualAlpha(this.thunderBg, this.tailBgAlpha);
                }
            })
            .delay(doDouble ? doubleHold : 0)
            .call(() => {
                if (doDouble) {
                    this._setVisualAlpha(this.thunderImg, this.tailImgAlpha);
                    this._setVisualAlpha(this.thunderBg, this.tailBgAlpha);
                }
            })
            .delay(doDouble ? tailHold : tailHold)
            .call(() => {
                this._setVisualAlpha(this.thunderImg, 0);
                this._setVisualAlpha(this.thunderBg, 0);
                this._restoreBoltTransform();
            })
            .call(() => this._playThunderSoundDelayed())
            .call(() => this._scheduleNextStrike())
            .start();
    }

    private _playThunderSoundDelayed() {
        if (!this.thunderClip || !this._audio) return;
        const dMin = Math.min(this.thunderSoundDelayMin, this.thunderSoundDelayMax);
        const dMax = Math.max(this.thunderSoundDelayMin, this.thunderSoundDelayMax);
        const delay = dMin + Math.random() * (dMax - dMin);
        this.scheduleOnce(() => {
            if (this._audio && this.thunderClip) {
                this._audio.playOneShot(this.thunderClip, 0.85 + Math.random() * 0.15);
            }
        }, delay);
    }
}
