// 将此组件挂载到一个包含 Button 和 Sprite 的节点上
import { _decorator, Component, Node, Sprite, SpriteFrame, Texture2D, ImageAsset, sys, UITransform } from 'cc';
const { ccclass, property } = _decorator;

/** 用户上传参考图最小宽高（像素） */
export const MIN_UPLOAD_IMAGE_WIDTH = 240;
export const MIN_UPLOAD_IMAGE_HEIGHT = 240;

@ccclass('LoadLocalImage')
export class LoadLocalImage extends Component {
    @property(Sprite)
    targetSprite: Sprite = null; // 用于显示图片的 Sprite 组件

    @property(Node)
    nullShowNode: Node = null;

    private input: HTMLInputElement = null;
    private lastDataUrl = "";
    private lastImageWidth = 0;
    private lastImageHeight = 0;

    /** 最近一次选中的图片 Data URL（供图生图接口使用） */
    public getSelectedDataUrl(): string {
        return this.lastDataUrl;
    }

    public hasSelectedImage(): boolean {
        return !!this.lastDataUrl;
    }

    /** 已选图且宽高均不小于 240 */
    public meetsMinUploadSize(): boolean {
        return (
            !!this.lastDataUrl &&
            this.lastImageWidth >= MIN_UPLOAD_IMAGE_WIDTH &&
            this.lastImageHeight >= MIN_UPLOAD_IMAGE_HEIGHT
        );
    }

    start() {
        if (this.nullShowNode) {
            this.nullShowNode.active = true;
        }
        if (this.targetSprite?.node) {
            this.targetSprite.node.active = false;
        }

        if (!sys.isBrowser) {
            return;
        }

        this.input = document.createElement('input');
        this.input.type = 'file';
        this.input.accept = 'image/*';
        this.input.style.display = 'none';
        document.body.appendChild(this.input);

        this.input.onchange = (event: Event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
                const imgData = e.target?.result as string;
                if (imgData) {
                    this.createSpriteFrameFromDataURL(imgData);
                }
            };
            reader.readAsDataURL(file);
            this.input.value = '';
        };
    }

    createSpriteFrameFromDataURL(dataURL: string) {
        const image = new Image();
        image.onload = () => {
            if (!this.targetSprite?.isValid) {
                return;
            }

            const w = image.width;
            const h = image.height;
            if (w < MIN_UPLOAD_IMAGE_WIDTH || h < MIN_UPLOAD_IMAGE_HEIGHT) {
                this.clearSelection();
                EventSystem.send(
                    "ShowTips",
                    `上传图片不能小于${MIN_UPLOAD_IMAGE_WIDTH}×${MIN_UPLOAD_IMAGE_HEIGHT}`,
                );
                return;
            }

            this.lastDataUrl = dataURL;
            this.lastImageWidth = w;
            this.lastImageHeight = h;

            const imgAsset = new ImageAsset(image);
            const texture = new Texture2D();
            texture.image = imgAsset;

            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;

            this.targetSprite.spriteFrame = spriteFrame;
            this.fitSpriteInsideParent(w, h);

            if (this.nullShowNode) {
                this.nullShowNode.active = false;
            }
            this.targetSprite.node.active = true;
        };
        image.onerror = () => {
            console.error('[LoadLocalImage] 图片加载失败');
            this.clearSelection();
        };
        image.src = dataURL;
    }

    /**
     * 在父节点范围内等比缩放展示，宽高均不超过父节点 UITransform。
     */
    private fitSpriteInsideParent(imgW: number, imgH: number) {
        const sprite = this.targetSprite;
        if (!sprite?.isValid || imgW <= 0 || imgH <= 0) {
            return;
        }

        let ui = sprite.getComponent(UITransform);
        if (!ui) {
            ui = sprite.node.addComponent(UITransform);
        }

        const parentUi = sprite.node.parent?.getComponent(UITransform);
        let maxW = parentUi?.width ?? 0;
        let maxH = parentUi?.height ?? 0;
        if (maxW <= 0 || maxH <= 0) {
            maxW = ui.width > 0 ? ui.width : 512;
            maxH = ui.height > 0 ? ui.height : 512;
        }

        const scale = Math.min(maxW / imgW, maxH / imgH);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        ui.setContentSize(imgW * scale, imgH * scale);
    }

    private clearSelection() {
        this.lastDataUrl = "";
        this.lastImageWidth = 0;
        this.lastImageHeight = 0;
        if (this.targetSprite) {
            this.targetSprite.spriteFrame = null;
            if (this.targetSprite.node) {
                this.targetSprite.node.active = false;
            }
        }
        if (this.nullShowNode) {
            this.nullShowNode.active = true;
        }
    }

    onClick() {
        if (!sys.isBrowser || !this.input) {
            return;
        }
        this.input.click();
    }

    onDestroy() {
        if (this.input?.parentNode) {
            this.input.parentNode.removeChild(this.input);
        }
        this.input = null;
    }
}
