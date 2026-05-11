import {
    Component,
    ImageAsset,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
    Vec2,
    assetManager,
    resources,
    _decorator,
} from 'cc';
import { HttpManager } from '../Manager/HttpManager';

const { ccclass, property } = _decorator;

/** 非 http(s) 且非 res/ 开头的路径会拼 HttpManager.baseUrl（与 Utils.loadCover 一致） */
export function resolveDynamicImageUrl(url: string): string {
    const t = String(url ?? '').trim();
    if (!t) return t;
    if (t.startsWith('http://') || t.startsWith('https://')) return t;
    if (t.startsWith('res/')) return t;
    return HttpManager.baseUrl + (t.startsWith('/') ? t.slice(1) : t);
}

function isBundleResourcesPath(src: string): boolean {
    return src.trim().startsWith('res/');
}

function isRemoteSource(src: string): boolean {
    const t = src.trim();
    if (t.startsWith('http://') || t.startsWith('https://')) return true;
    if (isBundleResourcesPath(t)) return false;
    /** 含路径分隔符视为服务端相对地址（如 uploads/a.png），非纯动作名 */
    return t.includes('/');
}

/**
 * zuozhu：每个动作一张横向条带整图，按列数均分宽度为序列帧。
 * 键与 png 文件名一致（无后缀），如 running-left → running-left.png
 */
export const ZUOZHU_ACTION_HORIZONTAL_SLICES: Readonly<Record<string, number>> = {
    base: 1,
    failed: 8,
    idle: 6,
    jumping: 5,
    review: 6,
    'running-left': 7,
    /** 未在需求里写出，与 running-left 对称 */
    'running-right': 7,
    running: 6,
    waiting: 6,
    /** 未在需求里写出，可按资源改 map */
    waving: 4,
};

/**
 * zuozhu 条带图：一张整图横向均分为 N 列循环播放。
 */
@ccclass('GenericSpritesheetAnimator')
export class GenericSpritesheetAnimator extends Component {
    @property(Sprite)
    targetSprite: Sprite | null = null;

    /** 例如 res/NPCImage/zuozhu，其下为 base.png、idle.png、running-left.png … */
    @property
    zuozhuRoot = 'res/NPCImage/zuozhu';

    @property
    fps = 10;

    @property
    autoContentSize = true;

    private _frames: SpriteFrame[] = [];
    private _frameIndex = 0;
    /** 本轮 load 动态创建的帧，切换动作时销毁 */
    private _builtSpriteFrames: SpriteFrame[] = [];
    /** 仅 ImageAsset → new Texture2D() 时持有，便于释放 */
    private _ownedTexture: Texture2D | null = null;

    onLoad(): void {
        if (!this.targetSprite) {
            this.targetSprite = this.getComponent(Sprite);
        }
        if (this.targetSprite) {
            this.targetSprite.type = Sprite.Type.SIMPLE;
            /** RAW：每帧按 SpriteFrame 原始像素尺寸显示，避免 CUSTOM + 整纹理缩放造成「横向拖动」错觉 */
            this.targetSprite.sizeMode = Sprite.SizeMode.RAW;
        }
    }

    onDestroy(): void {
        this.stop();
        this.releaseBuiltAssets();
    }

    /**
     * @param path 图路径：`res/...` bundle、`http(s)://` / 站点相对路径、`idle` 等与 `{zuozhuRoot}` 拼接
     * @param actionName 播放动作名，用于查 {@link ZUOZHU_ACTION_HORIZONTAL_SLICES} 得横向列数
     * @param sliceColsOrDone 可选：强制横向列数；或省略则由动作名查表，没有再默认为 1
     */
    public loadAndPlay(path: string, actionName: string, onDone?: (err: Error | null) => void): void;
    public loadAndPlay(
        path: string,
        actionName: string,
        sliceCols: number,
        onDone?: (err: Error | null) => void,
    ): void;
    public loadAndPlay(
        path: string,
        actionName: string,
        arg3?: number | ((err: Error | null) => void),
        arg4?: (err: Error | null) => void,
    ): void {
        let sliceCols: number | undefined;
        let onDone: ((err: Error | null) => void) | undefined;

        if (typeof arg3 === 'function') {
            onDone = arg3;
        } else if (typeof arg3 === 'number') {
            sliceCols = arg3;
            onDone = arg4;
        } else {
            onDone = arg4;
        }

        const pathStr = String(path ?? '').trim();
        const actionKey = String(actionName ?? '').trim();
        if (!pathStr || !actionKey) {
            onDone?.(new Error('路径或动作名为空'));
            return;
        }

        const cols =
            sliceCols != null && sliceCols > 0
                ? Math.floor(sliceCols)
                : ZUOZHU_ACTION_HORIZONTAL_SLICES[actionKey] ?? 1;

        if (cols < 1) {
            onDone?.(new Error(`横向列数无效`));
            return;
        }

        this.stop();
        this.releaseBuiltAssets();

        const finishPlay = (frames: SpriteFrame[]) => {
            this._builtSpriteFrames = frames;
            this._frames = frames;
            this._frameIndex = 0;

            if (!this.targetSprite?.isValid || !frames.length) {
                onDone?.(new Error('Sprite 无效或无帧'));
                return;
            }
            this.applyFrame(frames[0]);

            const interval = 1 / Math.max(1, this.fps);
            this.schedule(this.tickFrames, interval);
            onDone?.(null);
        };

        const fromImageAsset = (img: ImageAsset) => {
            const tex = new Texture2D();
            tex.image = img;
            this._ownedTexture = tex;
            finishPlay(this.buildStripFromTexture(tex, cols));
        };

        /** 远端：下载 ImageAsset → Texture2D → 横切 */
        if (isRemoteSource(pathStr)) {
            const url = resolveDynamicImageUrl(pathStr);
            const tryRemote = (ext?: string) => {
                const opts = ext ? { ext } : {};
                assetManager.loadRemote<ImageAsset>(url, opts as { ext: string }, (err, img) => {
                    if (!err && img?.width > 0) {
                        fromImageAsset(img);
                        return;
                    }
                    if (ext === undefined) {
                        tryRemote('.png');
                        return;
                    }
                    if (ext === '.png') {
                        tryRemote('.jpg');
                        return;
                    }
                    onDone?.(err || new Error(`远程图加载失败: ${url}`));
                });
            };
            tryRemote();
            return;
        }

        /** resources：完整 res/ 路径，或 zuozhu 短名拼根目录 */
        const bundlePath = isBundleResourcesPath(pathStr)
            ? pathStr.replace(/\/$/, '')
            : `${this.zuozhuRoot.replace(/\/$/, '')}/${pathStr}`;

        resources.load(bundlePath, ImageAsset, (err, img) => {
            if (!err && img?.width > 0) {
                fromImageAsset(img);
                return;
            }
            resources.load(`${bundlePath}/spriteFrame`, SpriteFrame, (err2, sf) => {
                if (!err2 && sf?.texture) {
                    finishPlay(this.buildStripFromTexture(sf.texture as Texture2D, cols));
                    return;
                }
                resources.load(bundlePath, SpriteFrame, (err3, sf2) => {
                    if (!err3 && sf2?.texture) {
                        finishPlay(this.buildStripFromTexture(sf2.texture as Texture2D, cols));
                        return;
                    }
                    onDone?.(err || err2 || err3 || new Error(`无法加载: ${bundlePath}`));
                });
            });
        });
    }

    public stop(): void {
        this.unschedule(this.tickFrames);
    }

    /** 像素对齐列宽，最后一列吃掉余数，避免浮点缝导致 UV 飘移 */
    private columnWidths(totalW: number, cols: number): number[] {
        const base = Math.floor(totalW / cols);
        const widths: number[] = [];
        let used = 0;
        for (let c = 0; c < cols - 1; c++) {
            widths.push(base);
            used += base;
        }
        widths.push(Math.max(1, totalW - used));
        return widths;
    }

    /** 按 Texture2D 手写 rect，整数列宽 */
    private buildStripFromTexture(texture: Texture2D, cols: number): SpriteFrame[] {
        const tw = texture.width;
        const th = texture.height;
        const widths = this.columnWidths(tw, cols);
        const out: SpriteFrame[] = [];
        let x = 0;
        for (let c = 0; c < cols; c++) {
            const w = widths[c];
            const rect = new Rect(x, 0, w, th);

            const sf = new SpriteFrame();
            sf.texture = texture;
            sf.rect = rect;
            sf.originalSize = new Size(w, th);
            sf.offset = new Vec2(0, 0);
            sf.packable = false;
            out.push(sf);
            x += w;
        }
        return out;
    }

    private releaseBuiltAssets(): void {
        for (const sf of this._builtSpriteFrames) {
            if (sf?.isValid) sf.destroy();
        }
        this._builtSpriteFrames = [];
        this._frames = [];
        if (this._ownedTexture?.isValid) {
            this._ownedTexture.destroy();
        }
        this._ownedTexture = null;
    }

    private tickFrames = (): void => {
        if (!this._frames.length || !this.targetSprite?.isValid) return;
        this._frameIndex = (this._frameIndex + 1) % this._frames.length;
        this.applyFrame(this._frames[this._frameIndex]);
    };

    private applyFrame(sf: SpriteFrame): void {
        const sp = this.targetSprite!;
        sp.spriteFrame = sf;
        /** 同一纹理多 SpriteFrame 切换时强制刷新绘制数据，否则会沿用上一帧 UV，看起来像条带在滑 */
        sp.markForUpdateRenderData();

        if (!this.autoContentSize) return;
        /** RAW 下列表尺寸随帧变化；若仍不对再用手动宽高兜底 */
        if (sp.sizeMode === Sprite.SizeMode.RAW) return;

        const ui = sp.getComponent(UITransform);
        if (!ui || !sf) return;
        const rw = sf.rect?.width ?? sf.texture?.width ?? 0;
        const rh = sf.rect?.height ?? sf.texture?.height ?? 0;
        if (rw > 0 && rh > 0) {
            ui.setContentSize(rw, rh);
        }
    }
}
