import { _decorator, Camera, director, find, ImageAsset, Layers, mat4, Mat4, Node, Rect, RenderTexture, Scene, Sprite, SpriteFrame, sys, Texture2D, UITransform, v3, Vec3, view } from 'cc';
const { ccclass, property } = _decorator;

interface IRect {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

/**
 * 节点基础信息
 */
interface INodeInfo {
    width?: number;
    height?: number;
    anchorX?: number;
    anchorY?: number;
    scaleX?: number;
    scaleY?: number;
    scaleZ?: number;
}

@ccclass('CaptureUtils')
export class CaptureUtils {
    /**
     * 全局摄像机
     */
    private static _camera: Camera;
    /**
     * 画布
     */
    private static _canvas: HTMLCanvasElement;
    /**
     * 临时变量
     */
    private static _tmpMat4: Mat4 = mat4();
    /**
     * 临时变量
     */
    private static _tmpVec3: Vec3 = v3();
    /**
     * 临时变量
     */
    private static _tmpInfo: INodeInfo = {};

    /**
 * 屏幕捕捉，核心功能——摄像机的锚点在中心点，设置捕捉区域的属性需要注意
 * @param area 捕捉区域，同时也是摄像机的父节点，以及渲染节点
 * @param rect 需要捕捉的内部区域
 */
    private static _capture(area: Scene | Node, rect: IRect): RenderTexture {
        var camera = CaptureUtils.getCamera(), cNode = camera.node, texture = new RenderTexture;
        texture.reset({ width: rect.width, height: rect.height });
        cNode.setPosition(rect.x, rect.y);
        area.addChild(cNode);
        camera.orthoHeight = rect.height / 2;
        camera.targetTexture = texture;
        // 执行渲染，单个渲染会报错，那就直接全部渲染一次吧（单个渲染：cc.director.root.pipeline.render([camera.camera]);）
        director.root.frameMove(0);
        camera.targetTexture = null;
        cNode.parent = null;
        return texture;
    }


    /**
     * 获取节点信息
     * @param node 
     */
    private static _getNodeInfo(node: Node | Scene): INodeInfo {
        var tmpInfo = CaptureUtils._tmpInfo, scale = node.getWorldMatrix(CaptureUtils._tmpMat4).getScale(CaptureUtils._tmpVec3);
        tmpInfo.scaleX = scale.x;
        tmpInfo.scaleY = scale.y;
        tmpInfo.scaleZ = scale.z;
        if (node == director.getScene()) {
            let s = view['_visibleRect'] as Rect;// 可以用cc.view.getVisibleSize()，不过每次调用都会新建一个Size
            tmpInfo.anchorX = tmpInfo.anchorY = 0;
            tmpInfo.width = s.width;
            tmpInfo.height = s.height;
            tmpInfo.scaleX = tmpInfo.scaleY = 1;
        }
        else {
            let ui = node.getComponent(UITransform);
            if (ui) {
                tmpInfo.anchorX = ui.anchorX;
                tmpInfo.anchorY = ui.anchorY;
                tmpInfo.width = ui.width;
                tmpInfo.height = ui.height;
            }
            else {
                tmpInfo.anchorX = tmpInfo.anchorY = 0.5;
                tmpInfo.width = tmpInfo.height = 1;
            }
        }
        return tmpInfo;
    }

    /**
 * 获取摄像机
 */
    protected static getCamera(): Camera {
        var camera = CaptureUtils._camera;
        if (!camera) {
            let node = new Node('CaptureUtils');
            camera = CaptureUtils._camera = node.addComponent(Camera);
            // 采取自动适配尺寸，非全屏
            camera.projection = Camera.ProjectionType.ORTHO;
            camera.near = 0;/* 默认1，必须改为0否则黑屏 */
            camera.visibility = 1 << 0;/* 显示2D和3D，显示不同分组需要调整，cc.Layers.Enum.UI_2D | cc.Layers.Enum.UI_3D */
        }
        return camera;
    }

    /**
 * 获取画布——不支持document形式创建，则替换成对应平台提供的方式来创建即可
 */
    protected static getCanvas(): HTMLCanvasElement {
        return CaptureUtils._canvas || (CaptureUtils._canvas = document.createElement('canvas'));
    }

    /**
 * 捕捉节点的内部区域
 * @param area 需要捕捉的节点，默认当前场景下的Canvas；用Canvas的原因是它有宽高，而场景没有，这样rect也可不传
 * @param rect 需要捕捉的内部区域，坐标默认捕捉区域的中心点，宽高默认节点的宽高；注意若节点本身宽高为0，会导致捕捉异常，因此必须手动传入rect的宽高；
 */
    public static capture(area?: Scene | Node, rect?: IRect, flipUVY: boolean = false): SpriteFrame {
        var void0 = void 0, spf = new SpriteFrame, info: INodeInfo;
        area === void0 && (area = find('Canvas') || director.getScene());
        rect === void0 && (rect = {});
        // 获取节点信息
        info = CaptureUtils._getNodeInfo(area);
        if (rect.width === void0) {
            rect.width = info.width * info.scaleX;
        }
        if (rect.height === void0) {
            rect.height = info.height * info.scaleY;
        }
        if (rect.x === void0) {
            rect.x = (.5 - info.anchorX) * info.width;
        }
        if (rect.y === void0) {
            rect.y = (.5 - info.anchorY) * info.height;
        }
        spf.texture = CaptureUtils._capture(area, rect);
        // 此处做了翻转，也可根据官方给的示例将像素点数据进行翻转（调用toImgurl来转换）
        spf.flipUVY = flipUVY;
        return spf;
    }

    // 修正倒置的像素数据
    public static fixInvertedPixels(pixels: Uint8Array, width: number, height: number): Uint8Array {
        const fixedPixels = new Uint8Array(pixels.length);
        const pixelSize = 4; // RGBA

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // 计算原始位置和翻转后的位置
                const originalIndex = (y * width + x) * pixelSize;
                const flippedY = height - 1 - y; // 关键：翻转Y轴
                const flippedIndex = (flippedY * width + x) * pixelSize;

                // 复制像素值
                fixedPixels[originalIndex] = pixels[flippedIndex];       // R
                fixedPixels[originalIndex + 1] = pixels[flippedIndex + 1]; // G
                fixedPixels[originalIndex + 2] = pixels[flippedIndex + 2]; // B
                fixedPixels[originalIndex + 3] = pixels[flippedIndex + 3]; // A
            }
        }

        return fixedPixels;
    }

    public static convertRenderTextureToBinary(texture: RenderTexture,
        callback: (binaryData: ArrayBuffer | null, contentType: string) => void) {
        const canvas = document.createElement('canvas');
        canvas.width = texture.width;
        canvas.height = texture.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            callback(null, '');
            return;
        }

        // 获取像素数据
        const pixels = texture.readPixels();
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);

        // 转换为Base64
        const base64 = canvas.toDataURL('image/png');

        // 转换为Blob
        // canvas.toBlob(blob => {
        //     if (!blob) {
        //         callback(null, '');
        //         return;
        //     }

        //     const reader = new FileReader();
        //     reader.onloadend = () => {
        //         const arrayBuffer = reader.result as ArrayBuffer;
        //         callback(arrayBuffer, blob.type);
        //     };
        //     reader.readAsArrayBuffer(blob);
        // }, 'image/png');
    }

    public static captureScreenToBase64(texture: RenderTexture): Promise<string | null> {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = texture.width;
            canvas.height = texture.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject('无法创建Canvas上下文');
                return;
            }

            // 获取像素数据
            const pixels = texture.readPixels();
            const imageData = ctx.createImageData(canvas.width, canvas.height);
            imageData.data.set(pixels);
            ctx.putImageData(imageData, 0, 0);

            // 转换为Base64
            const base64 = canvas.toDataURL('image/png', 0.1);
            resolve(base64);
        });
    }

    public static captureScreenToBlob(texture: RenderTexture, callback: (blob) => void) {
        const canvas = document.createElement('canvas');
        canvas.width = texture.width;
        canvas.height = texture.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return;
        }

        // 获取像素数据
        const pixels = CaptureUtils.fixInvertedPixels(texture.readPixels(), canvas.width, canvas.height);
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);

        // 转换为Blob
        canvas.toBlob(blob => {
            if (!blob) {
                return;
            }
            callback(blob);
        }, 'image/png');
    }

    // 从Texture2D转换为Base64
    public static convertTextureToBase64(texture: Texture2D): Promise<string | null> {
        if (!texture) {
            console.error('Texture is null');
            return Promise.resolve(null);
        }

        return new Promise((resolve) => {
            // 创建Canvas并设置尺寸
            const canvas = document.createElement('canvas');
            canvas.width = texture.width;
            canvas.height = texture.height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                console.error('Failed to get canvas context');
                resolve(null);
                return;
            }

            // 获取纹理的HTML元素
            const imageElement = texture.image.data as HTMLImageElement;

            if (!imageElement) {
                console.error('Failed to get image element from texture');
                resolve(null);
                return;
            }

            // 确保图像已加载
            if (imageElement.complete && imageElement.naturalWidth > 0) {
                // 直接绘制
                ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/png'));
            } else {
                // 等待图像加载完成
                imageElement.onload = () => {
                    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/png'));
                };

                imageElement.onerror = () => {
                    console.error('Image load error');
                    resolve(null);
                };
            }
        });
    }

    public static captureAndUpload(renderTexture: RenderTexture | null = null, call: Function) {
        // 1. 获取渲染纹理（如果未提供，则创建一个捕获主窗口的纹理）
        const texture = renderTexture;
        if (!texture) {
            return;
        }

        this.captureScreenToBase64(renderTexture).then((base64Data) => {
            // const base64Image = base64Data.split(';base64,').pop() || '';
            call && call(base64Data);
        })
    }

    public static displayBase64Image(base64Data: string, targetSprite: Sprite) {
        let image = new Image();
        image.onload = function () {
            let img = new ImageAsset(image)
            var texture = new Texture2D()
            texture.image = img
            let spriteFrame = new SpriteFrame()
            spriteFrame.texture = texture;
            spriteFrame.flipUVY = true;
            targetSprite.spriteFrame = spriteFrame;
            targetSprite.sizeMode = Sprite.SizeMode.TRIMMED;
        }

        image.src = base64Data;
    }
}


