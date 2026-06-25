import { _decorator, Component, Label } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Label 末尾为 "..." 时，将最后 3 个点循环显示为 . / .. / ...
 * 在 update 中检测 label.string 是否被外部修改。
 */
@ccclass('LabelEllipsisLoop')
export class LabelEllipsisLoop extends Component {
    @property(Label)
    label: Label = null;

    /** 点号切换间隔（毫秒） */
    @property
    intervalMs = 400;

    private sourceText = '';
    private baseText = '';
    private animating = false;
    private dotPhase = 0;
    private elapsedMs = 0;
    private isInternalUpdate = false;

    onLoad() {
        if (!this.label) {
            this.label = this.getComponent(Label);
        }
        if (this.label?.isValid) {
            this.sourceText = this.normalizeToSource(this.label.string);
            this.setupAnimation(this.sourceText);
        }
    }

    update(dt: number) {
        if (!this.label?.isValid) {
            return;
        }

        if (this.isInternalUpdate) {
            this.isInternalUpdate = false;
        } else {
            const current = this.label.string;
            const normalized = this.normalizeToSource(current);
            if (normalized !== this.sourceText) {
                this.sourceText = normalized;
                this.setupAnimation(this.sourceText);
            }
        }

        if (!this.animating) {
            return;
        }

        this.elapsedMs += dt * 1000;
        if (this.elapsedMs < this.intervalMs) {
            return;
        }
        this.elapsedMs = 0;
        this.dotPhase = (this.dotPhase + 1) % 3;
        this.applyDots();
    }

    /** 将 . / .. / ... 统一归一为以 ... 结尾的源文案，便于判断外部是否改字 */
    private normalizeToSource(text: string): string {
        const str = String(text ?? '');
        if (str.endsWith('...')) {
            return str;
        }
        if (str.endsWith('..')) {
            return str.slice(0, -2) + '...';
        }
        if (str.endsWith('.')) {
            return str.slice(0, -1) + '...';
        }
        return str;
    }

    private setupAnimation(source: string) {
        if (source.endsWith('...')) {
            this.baseText = source.slice(0, -3);
            this.animating = true;
            this.dotPhase = 0;
            this.elapsedMs = 0;
            this.applyDots();
            return;
        }

        this.animating = false;
        this.baseText = '';
        this.dotPhase = 0;
        this.elapsedMs = 0;
    }

    private applyDots() {
        if (!this.label?.isValid || !this.animating) {
            return;
        }
        const dots = '.'.repeat(this.dotPhase + 1);
        this.isInternalUpdate = true;
        this.label.string = this.baseText + dots;
    }
}
