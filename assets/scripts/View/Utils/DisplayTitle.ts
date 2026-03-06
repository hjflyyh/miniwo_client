import { _decorator, Camera, Component, UITransform, Vec3, view, Sprite, v3, Rect, Color , Node, SpriteFrame, log, director} from 'cc';
// import {MapManager} from "db://assets/bundles/mapEditor/src/MapManager";
import { GridPoolManager } from '../../Manager/GridPoolManager';
import {MapAssetsManager} from "db://assets/src/common/MapAssetsManager";
import {PrefabLoad} from "db://assets/scripts/Utils/PrefabLoad";
// import { MapEditor } from '../../../bundles/mapEditor/src/MapEditor';
const { ccclass, property } = _decorator;

/**
 * 根据节点是否在摄像机显示范围内，自动显示或隐藏渲染内容。
 * 不在范围内时通过 UIOpacity 隐藏，避免标题等在屏幕外仍被渲染。
 */
@ccclass('DisplayTitle')
export class DisplayTitle extends Component {
    @property(Camera)
    camera: Camera | null = null;

    @property(Sprite)
    sp: Sprite | null = null;

    /** 视口边距（0~1），用于避免贴边闪烁，如 0.1 表示左右下上各留 10% 余量 */
    @property({ tooltip: '视口边距 0~1，避免贴边闪烁' })
    viewportMargin: number = 0;

    public gridKey

    public poolNode = null

    public poolNodeSize

    public spriteFrame : SpriteFrame

    public spframeName : string

    private viewRect = null
    private localCorners = null

    private textureLoad : PrefabLoad

    onLoad(){
        this.textureLoad = this.addComponent("PrefabLoad") as PrefabLoad;
        this.textureLoad.isTexture = true
        this.textureLoad.isSetSize = true
        this.textureLoad.sizeH = 32
        this.textureLoad.sizeW = 32
        this.textureLoad.bundleName = "mapEditor"
    }

    start() {
        if (!this.camera) {
            // this.camera = MapManager.GetInstance().getMapEditor().mainCamera
        }
    }


    // 检测sprite边界是否在摄像机视野内（更精确）
    isSpriteBoundsInView(): boolean {
        if (!this.camera || !this.sp) {
            return false;
        }

        const node = this.sp.node;
        const uiTransform = node.getComponent(UITransform);
        if (!uiTransform) {
            return false;
        }

        if(this.localCorners == null){
            // 获取sprite的大小
            const spriteSize = uiTransform.contentSize;

            // 计算sprite的四个角点（局部坐标）
            this.localCorners = [
                new Vec3(-spriteSize.width, -spriteSize.height, 0), // 左下
                new Vec3(spriteSize.width, -spriteSize.height, 0),  // 右下
                new Vec3(spriteSize.width, spriteSize.height, 0),   // 右上
                new Vec3(-spriteSize.width, spriteSize.height, 0)   // 左上
            ];
        }

        // 获取视口范围
        if(this.viewRect == null){
            const viewport = view.getVisibleSize();
            this.viewRect = {
                left: 0,
                right: viewport.width,
                bottom: 0,
                top: viewport.height
            };
        }


        // 检查每个角点是否在视野内
        for (const corner of this.localCorners) {
            // 局部坐标转世界坐标
            const worldCorner = corner.clone();
            Vec3.transformMat4(worldCorner, worldCorner, node.worldMatrix);

            // 世界坐标转屏幕坐标
            const screenCorner = this.camera.worldToScreen(worldCorner);

            // 如果有一个角点在视野内，则认为sprite可见
            if (screenCorner.x >= this.viewRect.left && screenCorner.x <= this.viewRect.right &&
                screenCorner.y >= this.viewRect.bottom && screenCorner.y <= this.viewRect.top) {
                return true;
            }
        }

        return false;
    }

    update(_dt: number) {
        // if(!MapAssetsManager.isCheckGridDisplay){
        //     return
        // }
        this.textureLoad.url = this.spframeName
        // if(this.isSpriteBoundsInView()){
            // if(this.sp.spriteFrame != this.spriteFrame){
            //     this.sp.spriteFrame = this.spriteFrame
            // }
            // this.textureLoad.url = this.spframeName
        // }else if(this.sp.spriteFrame != null){
            // this.textureLoad.url = null
        // }
    }

}
