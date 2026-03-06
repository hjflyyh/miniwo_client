import { _decorator, Component, Label, Color , EffectAsset, Material, Texture2D } from 'cc';
const { ccclass, property, executeInEditMode, requireComponent } = _decorator;

/**
 * GradientLabel — N 色横向渐变文字组件 (Cocos Creator 3.8)
 *
 * 使用方式：
 *   1. 将 GradientLabel.effect 导入项目（放在同目录即可）
 *   2. 将此组件挂载到含有 Label 的节点上
 *   3. 将 GradientLabel.effect 拖入 gradientEffect 属性
 *   4. 在 colors 数组中添加 N 个渐变色（≥2）
 *
 * 原理：
 *   组件将 colors 数组生成一张 256×1 的渐变纹理，
 *   通过自定义 Shader 在片元阶段按 UV.x 采样该纹理，
 *   实现像素级精确的多色渐变。
 */
@ccclass('GradientLabel')
@executeInEditMode
@requireComponent(Label)
export class GradientLabel extends Component {

    @property({ type: [Color], tooltip: '渐变色列表（从左到右），至少 2 个颜色' })
    public colors: Color[] = [
        new Color(255, 220, 100, 255),
        new Color(100, 200, 255, 255),
        new Color(255, 80, 50, 255),
    ];

    @property({ type: EffectAsset, tooltip: '拖入同目录下的 GradientLabel.effect' })
    gradientEffect: EffectAsset | null = null;

    private _label: Label | null = null;
    private _material: Material | null = null;
    private _gradientTex: Texture2D | null = null;
    private _lastColorHash = '';

    // ─── 生命周期 ────────────────────────────────

    onLoad () {
        this._label = this.getComponent(Label)!;
    }

    onEnable () {
        this._setupMaterial();
    }

    onDisable () {
        // if (this._label) {
        //     this._label.customMaterial = null;
        // }
    }

    onDestroy () {
        this._gradientTex?.destroy();
        this._gradientTex = null;
        this._material = null;
    }

    lateUpdate () {
        // 如果 effect 还没设置，但后续被赋值了，自动初始化
        if (!this._material && this.gradientEffect) {
            this._setupMaterial();
        }

        // 检测颜色是否变化（编辑器中拖动颜色时实时更新）
        const hash = this._colorHash();
        if (hash !== this._lastColorHash) {
            this._lastColorHash = hash;
            this._updateGradientTexture();
        }
    }

    // ─── 公共方法 ────────────────────────────────

    /** 运行时动态设置渐变颜色（可传入任意数量 ≥2） */
    public setColors (...newColors: Color[]) {
        this.colors = newColors.map(c => c.clone());
        this._lastColorHash = ''; // 强制下帧更新
    }

    // ─── 内部实现 ────────────────────────────────

    /** 创建自定义 Material 并赋给 Label */
    private _setupMaterial () {
        if (!this.gradientEffect || !this._label) return;

        if (!this._material) {
            const mat = new Material();
            mat.initialize({
                effectAsset: this.gradientEffect,
                defines: { USE_TEXTURE: true },
                technique: 0,
            });
            this._material = mat;
        }

        this._label.customMaterial = this._material;
        this._lastColorHash = ''; // 强制更新纹理
    }

    /** 从 colors 数组生成 256×1 渐变纹理并设置到材质 */
    private _updateGradientTexture () {
        if (!this._material) return;
        const colors = this.colors;
        if (!colors || colors.length < 2) return;

        const width = 256;
        const data = new Uint8Array(width * 4);
        const segments = colors.length - 1;

        for (let x = 0; x < width; x++) {
            const t = x / (width - 1);
            const rawSeg = t * segments;
            let segIdx = Math.floor(rawSeg);
            if (segIdx >= segments) segIdx = segments - 1;
            const localT = rawSeg - segIdx;

            const cA = colors[segIdx];
            const cB = colors[segIdx + 1];

            const offset = x * 4;
            data[offset]     = Math.round(cA.r + (cB.r - cA.r) * localT);
            data[offset + 1] = Math.round(cA.g + (cB.g - cA.g) * localT);
            data[offset + 2] = Math.round(cA.b + (cB.b - cA.b) * localT);
            data[offset + 3] = Math.round(cA.a + (cB.a - cA.a) * localT);
        }

        // 创建 / 更新纹理
        if (!this._gradientTex) {
            this._gradientTex = new Texture2D();
        }

        this._gradientTex.reset({
            width: width,
            height: 1,
            format: Texture2D.PixelFormat.RGBA8888,
        });
        this._gradientTex.uploadData(data);

        // 线性过滤 + 边缘钳制，确保平滑且不重复
        this._gradientTex.setFilters(
            Texture2D.Filter.LINEAR,
            Texture2D.Filter.LINEAR
        );
        this._gradientTex.setWrapMode(
            Texture2D.WrapMode.CLAMP_TO_EDGE,
            Texture2D.WrapMode.CLAMP_TO_EDGE
        );

        // 设置到材质
        this._material.setProperty('gradientTexture', this._gradientTex);
    }

    /** 简单颜色哈希，用于检测变化 */
    private _colorHash (): string {
        if (!this.colors) return '';
        let h = '';
        for (let i = 0; i < this.colors.length; i++) {
            const c = this.colors[i];
            h += `${c.r},${c.g},${c.b},${c.a}|`;
        }
        return h;
    }
}
