// 将此组件挂载到一个包含 Button 和 Sprite 的节点上
import { _decorator, Component, Node, Sprite, SpriteFrame, Texture2D, ImageAsset, sys } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LoadLocalImage')
export class LoadLocalImage extends Component {
    @property(Sprite)
    targetSprite: Sprite = null; // 用于显示图片的 Sprite 组件

    @property(Node)
    nullShowNode: Node = null;

    private input: HTMLInputElement = null;
    private lastDataUrl = "";

    /** 最近一次选中的图片 Data URL（供图生图接口使用） */
    public getSelectedDataUrl(): string {
        return this.lastDataUrl;
    }

    public hasSelectedImage(): boolean {
        return !!this.lastDataUrl;
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
        this.lastDataUrl = dataURL;
        const image = new Image();
        image.onload = () => {
            if (!this.targetSprite?.isValid) return;

            const imgAsset = new ImageAsset(image);
            const texture = new Texture2D();
            texture.image = imgAsset;

            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;

            this.targetSprite.spriteFrame = spriteFrame;
            this.targetSprite.sizeMode = Sprite.SizeMode.TRIMMED;

            if (this.nullShowNode) {
                this.nullShowNode.active = false;
            }
            this.targetSprite.node.active = true;
        };
        image.onerror = () => {
            console.error('[LoadLocalImage] 图片加载失败');
        };
        image.src = dataURL;
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
