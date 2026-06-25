import { _decorator, Component, Label } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 打字机效果 Label：逐字显示文本。
 * 挂到含 Label 的节点上，将 Label 拖到 label 属性（或留空自动取同节点 Label）。
 */
@ccclass('TypewriterLabel')
export class TypewriterLabel extends Component {
    @property(Label)
    label: Label = null;

    /** 每个字符间隔（毫秒） */
    @property
    intervalMs = 50;

    private fullText = '';
    private timer: ReturnType<typeof setTimeout> | null = null;
    private charIndex = 0;
    private playing = false;

    onLoad() {
        if (!this.label) {
            this.label = this.getComponent(Label);
        }
    }

    onDestroy() {
        this.stop(false);
    }

    /** 开始打字机播放；immediate=true 时直接显示全文 */
    play(text: string, immediate = false) {
        this.stop(false);
        this.fullText = String(text ?? '');
        if (!this.label?.isValid) {
            return;
        }
        if (immediate || !this.fullText) {
            this.label.string = this.fullText;
            this.charIndex = this.fullText.length;
            this.playing = false;
            return;
        }

        this.charIndex = 0;
        this.label.string = '';
        this.playing = true;
        this.scheduleNextChar();
    }

    /** 立即显示全部文字 */
    skipToEnd() {
        this.stop(false);
        if (this.label?.isValid) {
            this.label.string = this.fullText;
        }
        this.charIndex = this.fullText.length;
        this.playing = false;
    }

    /** 停止播放；clearLabel=true 时清空 Label 与缓存全文 */
    stop(clearLabel = true) {
        this.playing = false;
        if (this.timer != null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (clearLabel) {
            if (this.label?.isValid) {
                this.label.string = '';
            }
            this.fullText = '';
            this.charIndex = 0;
        }
    }

    /** 仅取消定时器，保留当前已显示文字 */
    cancelPlayback() {
        this.playing = false;
        if (this.timer != null) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    getFullText(): string {
        if (this.fullText) {
            return this.fullText;
        }
        return String(this.label?.string ?? '');
    }

    isPlaying(): boolean {
        return this.playing;
    }

    private scheduleNextChar() {
        if (!this.playing || !this.label?.isValid) {
            return;
        }
        if (this.charIndex >= this.fullText.length) {
            this.playing = false;
            return;
        }

        this.charIndex += 1;
        this.label.string = this.fullText.slice(0, this.charIndex);

        this.timer = setTimeout(() => {
            this.timer = null;
            this.scheduleNextChar();
        }, Math.max(1, this.intervalMs));
    }
}
