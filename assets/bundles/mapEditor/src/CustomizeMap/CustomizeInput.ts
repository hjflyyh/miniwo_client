import { _decorator, Component, EventMouse, EventTouch, Input, input, Node, sys, UITransform, Vec2, Vec3 } from 'cc';
import { ActionStatus, MapManager } from '../MapManager';
import { MapEditor } from '../MapEditor';
import { MapModel } from '../../../../scripts/Model/MapModel';
// import { EventSystem } from 'db://assets/scripts/Utils/EventSystem';

const { ccclass, property } = _decorator;

@ccclass('CustomizeInput')
export class CustomizeInput extends Component {
    @property(MapEditor)
    mapEditor : MapEditor = null

    /** 与 MapEditor.placeBuilding / 预览遮罩一致：含农场农田 FRAM */
    private isPlacementDragOffsetAction(status: ActionStatus): boolean {
        return (
            status === ActionStatus.MOVE ||
            status === ActionStatus.PLANT ||
            status === ActionStatus.DECOR ||
            status === ActionStatus.WALL_DECOR ||
            status === ActionStatus.FRAM
        );
    }

    private tryBindMapEditor(): boolean {
        if (this.mapEditor && this.mapEditor.isValid) return true;
        const mgr = MapManager.GetInstance();
        if (!mgr) return false;
        const editor = mgr.getMapEditor() as MapEditor;
        if (!editor || !editor.isValid) return false;
        this.mapEditor = editor;
        return true;
    }

    private ensureMapEditor(): boolean {
        const ok = this.tryBindMapEditor();
        if (!ok) {
            // 第二次进入场景时如果时序较早，这里会短暂拿不到，后续输入再尝试绑定
            console.warn('[CustomizeInput] mapEditor not ready yet');
        }
        return ok;
    }

    /** 手机 App / 手机浏览器：已选道具时可在地图任意位置按下并跟手拖动 */
    private isPlacementFingerDragActive(manager: ReturnType<typeof MapManager.GetInstance>): boolean {
        if (!this.mapEditor?.isTouchPlacementDevice()) {
            return false;
        }
        if (!this.mapEditor.enablePlacementDragOffset) {
            return false;
        }
        if (!this.isPlacementDragOffsetAction(manager.actionStatus)) {
            return false;
        }
        return this.mapEditor.isBuildSwitch || this.mapEditor.hasPlacementItemSelected();
    }

    private beginPlacementFingerDrag(event: EventTouch): void {
        if (!this.mapEditor.isBuildSwitch) {
            this.mapEditor.isBuildSwitch = true;
        }
        const loc = event.getLocation();
        const gridPos = MapModel.getInstance().worldPosToGride(loc, this.mapEditor);
        this.mapEditor.applyTileMaskPreviewWorldPosition(gridPos, loc);
        this.mapEditor.isMousePoint = true;
        this.mapEditor.startMousePosition = loc.clone();
    }

    private beginDeleteFingerDrag(loc: Vec2): void {
        if (!this.mapEditor.isBuildSwitch) {
            this.mapEditor.isBuildSwitch = true;
        }
        const gridPos = MapModel.getInstance().worldPosToGride(loc, this.mapEditor);
        this.mapEditor.signDeteleTile(gridPos, loc);
        this.mapEditor.isMousePoint = true;
        this.mapEditor.startMousePosition = loc.clone();
    }

    private shouldKeepBuildSwitchOnTouchEnd(manager: ReturnType<typeof MapManager.GetInstance>): boolean {
        return this.isPlacementFingerDragActive(manager) || manager.actionStatus === ActionStatus.DETELE;
    }

    start() {
        this.tryBindMapEditor();
        const useTouchInput = this.mapEditor?.isTouchPlacementDevice?.() ?? sys.isMobile;
        if (useTouchInput) {
            input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
            input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
            input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        } else {
            input.on(Input.EventType.MOUSE_WHEEL , (event : EventMouse)=>{
                if (!this.ensureMapEditor()) return;
                const manager = MapManager.GetInstance();
                if(manager.actionStatus == ActionStatus.REGION){
                    return
                }
                if(manager.actionStatus != ActionStatus.Back){
                    return
                }
                const dir = Math.sign(event.getScrollY())
                if(dir === 0) return;

                this.mapEditor.zoomCamera(-dir * this.mapEditor.wheelZoomStep)
            })
            input.on(Input.EventType.MOUSE_MOVE, (event: EventMouse) => {
                if (!this.ensureMapEditor()) return;
                const manager = MapManager.GetInstance();
                if (manager.actionStatus == ActionStatus.REGION) return;

                if (manager.actionStatus == ActionStatus.DETELE) {
                    if (!this.mapEditor.isBuildSwitch) {
                        this.mapEditor.isBuildSwitch = true;
                    }
                    const gridPos = MapModel.getInstance().worldPosToGride(event.getLocation(), this.mapEditor);
                    this.mapEditor.signDeteleTile(gridPos);
                    return;
                }

                // 仅在开启「格子拖动偏移」且为可偏移模式时记录指针本地坐标
                if (this.mapEditor.enablePlacementDragOffset && this.isPlacementDragOffsetAction(manager.actionStatus)) {
                    const loc = event.getLocation();
                    const w = this.mapEditor.mainCamera.screenToWorld(new Vec3(loc.x, loc.y, 0));
                    const lp = this.mapEditor.mapContainer.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(w.x, w.y, 0));
                    this.mapEditor.lastPointerLocalPos = new Vec2(lp.x, lp.y);
                }

                if (this.mapEditor.isBuildSwitch) {
                    const gridPos = MapModel.getInstance().worldPosToGride(event.getLocation() , this.mapEditor);
                    const localPos = MapModel.getInstance().gridToWorld(gridPos , null , this.mapEditor);
                    const worldPos = this.mapEditor.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(localPos);
                    // 树/家具/墙饰/移动：开启偏移时跟手指；关闭时预览吸格心
                    // 注意：不能直接用 screenToWorld(near plane) 作为 worldPosition，否则会跑到错误平面导致“看不见”
                    const dragOffsetModes = this.isPlacementDragOffsetAction(manager.actionStatus);
                    if (this.mapEditor.enablePlacementDragOffset && dragOffsetModes) {
                        this.mapEditor.applyTileMaskPreviewWorldPosition(gridPos, event.getLocation());
                    } else {
                        this.mapEditor.tileMaskNode.setWorldPosition(worldPos);
                    }

                    this.mapEditor.showMaskColor(gridPos);
                    if (manager.actionStatus == ActionStatus.MOVE) {
                        if (this.mapEditor.moveActionIndex == 2) {
                            this.mapEditor.buildMap(gridPos);
                        } else {
                            this.mapEditor.signMoveTile(gridPos);
                        }
                    } else if (manager.actionStatus == ActionStatus.DETELE) {
                        this.mapEditor.signDeteleTile(gridPos);
                    } else if (manager.actionStatus == ActionStatus.FLOOR) {
                        if (this.mapEditor.isMousePoint) {
                            if(this.mapEditor.mapGraphics != null){
                                this.mapEditor._currentPoint = localPos
                                this.mapEditor._currentGrad = gridPos;
                                this.mapEditor.drawSelectionBox();
                            }
                        }
                    } else if (manager.actionStatus == ActionStatus.GROUND) {
                        if (this.mapEditor.isMousePoint) {
                            this.mapEditor.buildMap(gridPos);
                        }
                    }
                }

                if (manager.actionStatus == ActionStatus.Back) {
                    if (this.mapEditor.isDragging) {
                        const currentPosition = new Vec3(event.getLocation().x, event.getLocation().y, 0);
                        const delta = new Vec3(0, 0, 0);
                        delta.x = currentPosition.x - this.mapEditor.lastMousePosition.x;
                        delta.y = currentPosition.y - this.mapEditor.lastMousePosition.y;

                        // 将屏幕坐标差异转换为世界坐标差异
                        const cameraWorldPos = this.mapEditor.mainCamera.node.getPosition();
                        const newWorldPos = new Vec3(
                            cameraWorldPos.x - delta.x * 20,
                            cameraWorldPos.y - delta.y * 20,
                            cameraWorldPos.z
                        );

                        this.mapEditor.targetPos = newWorldPos;
                        this.mapEditor.lastMousePosition.set(currentPosition);

                        this.mapEditor.clampCameraTarget(this.mapEditor.targetPos);
                    }
                }
            }, this);

            input.on(Input.EventType.MOUSE_DOWN, (event: EventMouse) => {
                if (!this.ensureMapEditor()) return;
                const manager = MapManager.GetInstance();
                if (manager.actionStatus == ActionStatus.REGION) return;

                const gridPos = MapModel.getInstance().worldPosToGride(event.getLocation() , this.mapEditor);
                const localPos = MapModel.getInstance().gridToWorld(gridPos , null , this.mapEditor);
                // 转换到当前节点的局部坐标
                // this._startPoint = Utils.screenToLocal(event.getUILocation() , this.node.getComponent(UITransform));
                // this._startPoint = this.worldPosToGride(event.getLocation())
                this.mapEditor._startPoint = localPos
                this.mapEditor._startGrad = gridPos
                this.mapEditor._currentPoint = this.mapEditor._startPoint.clone();
                this.mapEditor._currentGrad = this.mapEditor._startGrad.clone();

                if (manager.actionStatus == ActionStatus.DETELE) {
                    this.beginDeleteFingerDrag(event.getLocation());
                } else if (!this.mapEditor.isBuildSwitch) {
                    const mouseWorldPoint = this.mapEditor.mainCamera.screenToWorld(new Vec3(event.getLocation().x, event.getLocation().y, 0))
                    if (this.mapEditor.tileMaskNode.getComponent(UITransform).getBoundingBoxToWorld().contains(new Vec2(mouseWorldPoint.x, mouseWorldPoint.y))) {
                        const gridPos = MapModel.getInstance().worldPosToGride(event.getLocation() , this.mapEditor);
                        const localPos = MapModel.getInstance().gridToWorld(gridPos , null , this.mapEditor);
                        const worldPos = this.mapEditor.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(localPos)
                        if (this.mapEditor.enablePlacementDragOffset && this.isPlacementDragOffsetAction(manager.actionStatus)) {
                            this.mapEditor.applyTileMaskPreviewWorldPosition(gridPos, event.getLocation());
                        } else {
                            this.mapEditor.tileMaskNode.setWorldPosition(worldPos);
                        }

                        this.mapEditor.isBuildSwitch = true;
                    } else if (manager.actionStatus == ActionStatus.WALL) {
                        this.mapEditor.isMousePoint = true;
                    }

                } else {
                    this.mapEditor.isMousePoint = true;
                    this.mapEditor.startMousePosition = event.getLocation();
                }

                if (manager.actionStatus == ActionStatus.Back) {
                    this.mapEditor.isDragging = true;
                    this.mapEditor.lastMousePosition.set(event.getLocation().x, event.getLocation().y, 0);
                }
            }, this);

            input.on(Input.EventType.MOUSE_UP, (event: EventMouse) => {
                if (!this.ensureMapEditor()) return;
                const manager = MapManager.GetInstance();
                if (manager.actionStatus == ActionStatus.REGION) return;
                this.mapEditor.mapGraphics.clear()
                if (!this.mapEditor.isBuildSwitch) {
                    const mouseWorldPoint = this.mapEditor.mainCamera.screenToWorld(new Vec3(event.getLocation().x, event.getLocation().y, 0))
                    if (this.mapEditor.tileMaskNode.getComponent(UITransform).getBoundingBoxToWorld().contains(new Vec2(mouseWorldPoint.x, mouseWorldPoint.y))) {
                        this.mapEditor.isBuildSwitch = true;
                    }
                } else {
                    if (manager.actionStatus != ActionStatus.MOVE) {
                        const dis = Vec2.distance(event.getLocation(), this.mapEditor.startMousePosition);
                        if (dis > 10) {
                            this.mapEditor.isMousePoint = false;
                        }

                        if (this.mapEditor.isMousePoint) {
                            const manager = MapManager.GetInstance();
                            if (manager.actionStatus == ActionStatus.MOVE) {
                                this.mapEditor.moveStatus = 2;
                            }

                            if(manager.actionStatus != ActionStatus.FLOOR){
                                const gridPos = MapModel.getInstance().worldPosToGride(event.getLocation() , this.mapEditor);
                                this.mapEditor.buildMap(gridPos);
                            }

                        }else{
                            if(manager.actionStatus == ActionStatus.FLOOR){
                                const startGrad = this.mapEditor._startGrad;
                                const endGrad = this.mapEditor._currentGrad;
                                const hasDraggedAtLeastOneGrid = !!startGrad && !!endGrad &&
                                    (Math.abs(endGrad.x - startGrad.x) >= 1 || Math.abs(endGrad.y - startGrad.y) >= 1);
                                if (hasDraggedAtLeastOneGrid) {
                                    this.mapEditor.autoGraphicsWall();
                                    this.mapEditor.drawAutoBuildWall();
                                }
                            }
                        }

                        this.mapEditor.isMousePoint = false;
                    } else {
                        if (this.mapEditor.moveActionIndex == 1) {
                            this.mapEditor.moveActionIndex = 2;
                        } else if (this.mapEditor.moveActionIndex == 2) {
                            this.mapEditor.moveActionIndex = 0;

                            const manager = MapManager.GetInstance();
                            if (manager.actionStatus == ActionStatus.MOVE) {
                                this.mapEditor.moveStatus = 2;
                            }
                        }
                    }
                }

                this.mapEditor.isDragging = false;

                this.mapEditor._startGrad = new Vec2(0,0)
                this.mapEditor._currentGrad = new Vec2(0,0)
            }, this);
        }
    }

    OnClickUICheckBtn(){
        MapManager.GetInstance().getMapEditorUI()?.hideNpcHeadsOnConfirm?.();
        if (!this.ensureMapEditor()) return;
        const manager = MapManager.GetInstance();
        if (manager.actionStatus == ActionStatus.REGION) {
            const mapEditorUI = manager.getMapEditorUI();
            const npcIds = mapEditorUI?.getPendingRegionNpcIds?.() ?? [];
            if (!npcIds || npcIds.length <= 0) {
                EventSystem.send("ShowTips", "区域内需要选定npc");
                return;
            }
            mapEditorUI?.confirmRegionSelection?.();
            return;
        }
        if (!this.mapEditor.tileMaskNode || !this.mapEditor.mapContainer) return;

        this.mapEditor.tileMaskNode.active = true;
        const gridPos = this.mapEditor.resolvePlacementGridFromMask();
        if (!gridPos) {
            EventSystem.send("ShowTips", "摆放位置无效，请拖动到可放置区域");
            return;
        }
        this.mapEditor.buildMap(gridPos);
    }

    //翻转x轴物品
    OnClickUIFanzhuan(){
        if (!this.ensureMapEditor()) return;
        const previewNode = this.mapEditor["curTileNode"] as Node;
        if (!previewNode || !previewNode.isValid) return;
        const curScale = previewNode.getScale();
        const nextScaleX = curScale.x >= 0 ? -1 : 1;
        previewNode.setScale(nextScaleX, curScale.y, curScale.z);
    }

    private getActiveTouches(e: EventTouch): any[] {
        const anyEvent = e as any;
        const touches = typeof anyEvent.getAllTouches === "function" ? anyEvent.getAllTouches() : e.getTouches();
        return touches || [];
    }

    private getTouchDistance(e :EventTouch) : number{
        const touches = this.getActiveTouches(e)
        if(!touches || touches.length < 2) return 0
        const p1 = touches[0].getLocation()
        const p2 = touches[1].getLocation()
        return Vec2.distance(new Vec2(p1.x , p1.y) , new Vec2(p2.x,p2.y))
    }

    private isPinching: boolean = false
    private lastPinchDistance: number = 0
    private onTouchStart(event: EventTouch) {
        if (!this.ensureMapEditor()) return;
        const manager = MapManager.GetInstance();
        if (manager.actionStatus == ActionStatus.REGION) return;
        const activeTouches = this.getActiveTouches(event);
        if(activeTouches.length >= 2 && manager.actionStatus == ActionStatus.Back){
            this.isPinching = true
            this.lastPinchDistance = this.getTouchDistance(event)
            // 双指开始时，关闭单指拖拽/建造状态，避免手势串扰
            // this.mapEditor.isDragging = false;
            // this.mapEditor.isMousePoint = false;
            // this.mapEditor.isBuildSwitch = false;
            return;
        }
        this.isPinching = false;
        this.lastPinchDistance = 0;
        let eventLocation = event.getLocation()
        eventLocation.y += 100
        const gridPos = MapModel.getInstance().worldPosToGride(eventLocation , this.mapEditor);
        const localPos = MapModel.getInstance().gridToWorld(gridPos , null , this.mapEditor);
        this.mapEditor._startPoint = localPos
        this.mapEditor._startGrad = gridPos
        this.mapEditor._currentPoint = this.mapEditor._startPoint.clone();
        this.mapEditor._currentGrad = this.mapEditor._startGrad.clone();


        if(manager.actionStatus == ActionStatus.FLOOR){
            this.mapEditor.isBuildSwitch = true
            const worldPos = this.mapEditor.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(localPos)
            this.mapEditor.tileMaskNode.setWorldPosition(worldPos);
            this.mapEditor.isMousePoint = true;
            return
        }

        if (manager.actionStatus == ActionStatus.DETELE) {
            this.beginDeleteFingerDrag(eventLocation);
        } else if (this.isPlacementFingerDragActive(manager)) {
            this.beginPlacementFingerDrag(event);
        } else if (!this.mapEditor.isBuildSwitch) {
            const mouseWorldPoint = this.mapEditor.mainCamera.screenToWorld(new Vec3(eventLocation.x, eventLocation.y, 0))
            if (this.mapEditor.tileMaskNode.getComponent(UITransform).getBoundingBoxToWorld().contains(new Vec2(mouseWorldPoint.x, mouseWorldPoint.y))) {
                this.mapEditor.isBuildSwitch = true;
                this.mapEditor.isMousePoint = true;
                this.mapEditor.startMousePosition = eventLocation;
            } else if (manager.actionStatus == ActionStatus.WALL) {
                this.mapEditor.isMousePoint = true;
            }
        }

        if (manager.actionStatus == ActionStatus.Back) {
            this.mapEditor.isDragging = true;
            this.mapEditor.lastMousePosition.set(event.getLocation().x, event.getLocation().y, 0);
        }
    }

    private onTouchMove(event: EventTouch) {
        if (!this.ensureMapEditor()) return;
        const activeTouches = this.getActiveTouches(event);
        const manager = MapManager.GetInstance();
        if (manager.actionStatus == ActionStatus.REGION) return;
        if(this.isPinching || activeTouches.length >= 2){
            if(manager.actionStatus == ActionStatus.Back){
                this.isPinching = true;
                this.mapEditor.isDragging = false;
                const dist = this.getTouchDistance(event)
                if(this.lastPinchDistance > 0 && dist > 0){
                    const delta = dist - this.lastPinchDistance
                    // 过滤微抖动，避免缩放和位移手感冲突
                    if (Math.abs(delta) < 2) {
                        this.lastPinchDistance = dist
                        return
                    }
                    const zoomDelta = -delta * 1.2
                    this.mapEditor.zoomCamera(zoomDelta)
                }
                this.lastPinchDistance = dist
                return
            }
        }
        if(activeTouches.length >= 2){
            return
        }
        let eventLocation = event.getLocation()
        eventLocation.y += 100
        if (manager.actionStatus == ActionStatus.DETELE) {
            if (!this.mapEditor.isBuildSwitch) {
                this.mapEditor.isBuildSwitch = true;
            }
            const touchLoc = eventLocation;
            const gridPos = MapModel.getInstance().worldPosToGride(touchLoc, this.mapEditor);
            this.mapEditor.signDeteleTile(gridPos, touchLoc);
            return;
        }

        const placementFingerDrag = this.isPlacementFingerDragActive(manager);
        if (placementFingerDrag || this.mapEditor.isBuildSwitch) {
            if (placementFingerDrag && !this.mapEditor.isBuildSwitch) {
                this.mapEditor.isBuildSwitch = true;
            }

            const touchLoc = eventLocation;
            const gridPos = MapModel.getInstance().worldPosToGride(touchLoc, this.mapEditor);
            const localPos = MapModel.getInstance().gridToWorld(gridPos, null, this.mapEditor);

            if (this.mapEditor.enablePlacementDragOffset && this.isPlacementDragOffsetAction(manager.actionStatus)) {
                const w = this.mapEditor.mainCamera.screenToWorld(new Vec3(touchLoc.x, touchLoc.y, 0));
                const lp = this.mapEditor.mapContainer.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(w.x, w.y, 0));
                this.mapEditor.lastPointerLocalPos = new Vec2(lp.x, lp.y);
                this.mapEditor.applyTileMaskPreviewWorldPosition(gridPos, touchLoc);
                if (!this.mapEditor.usePlacementFingerFollow()) {
                    this.mapEditor.showMaskColor(gridPos);
                }
            } else if (this.mapEditor.isBuildSwitch) {
                const worldPos = this.mapEditor.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(localPos);
                this.mapEditor.tileMaskNode.setWorldPosition(worldPos);
                this.mapEditor.showMaskColor(gridPos);
            }

            if (manager.actionStatus == ActionStatus.MOVE) {
                this.mapEditor.signMoveTile(gridPos);
                this.mapEditor.buildMap(gridPos);
            } else if (manager.actionStatus == ActionStatus.FLOOR) {
                if (this.mapEditor.isMousePoint) {
                    // this.buildMap(gridPos);
                    if(this.mapEditor.mapGraphics != null){
                        this.mapEditor._currentPoint = localPos
                        this.mapEditor._currentGrad = gridPos;
                        // this._currentPoint = this.worldPosToGride(event.getLocation());
                        // this._currentPoint = Utils.screenToLocal(event.getLocation() , this.node.getComponent(UITransform))
                        // this._currentPoint = event.getLocation()
                        this.mapEditor.drawSelectionBox();
                    }
                }
            } else if (manager.actionStatus == ActionStatus.GROUND) {
                // if (this.mapEditor.isMousePoint) {
                    this.mapEditor.buildMap(gridPos);
                // }
            }
        }

        if (this.mapEditor.isDragging) {
            const currentPosition = new Vec3(event.getLocation().x, event.getLocation().y, 0);
            const delta = new Vec3(0, 0, 0);
            delta.x = currentPosition.x - this.mapEditor.lastMousePosition.x;
            delta.y = currentPosition.y - this.mapEditor.lastMousePosition.y;

            // 将屏幕坐标差异转换为世界坐标差异
            const cameraWorldPos = this.mapEditor.mainCamera.node.getPosition();
            const newWorldPos = new Vec3(
                cameraWorldPos.x - delta.x * 20,
                cameraWorldPos.y - delta.y * 20,
                cameraWorldPos.z
            );

            this.mapEditor.targetPos = newWorldPos;
            this.mapEditor.lastMousePosition.set(currentPosition);

            this.mapEditor.clampCameraTarget(this.mapEditor.targetPos);
        }
    }

    private onTouchEnd(event: EventTouch) {
        if (!this.ensureMapEditor()) return;
        const manager = MapManager.GetInstance();
        if (manager.actionStatus == ActionStatus.REGION) return;
        if(this.isPinching && manager.actionStatus == ActionStatus.Back){
            const activeTouches = this.getActiveTouches(event);
            if(activeTouches.length < 2){
                this.lastPinchDistance = 0
                this.isPinching = false
            }
            // 双指结束时不触发单指建造/点击提交
            return
        }
        this.mapEditor.mapGraphics.clear()
        if (manager.actionStatus != ActionStatus.MOVE) {
            const dis = Vec2.distance(event.getLocation(), this.mapEditor.startMousePosition);
            if (dis > 10) {
                this.mapEditor.isMousePoint = false;
            }
        }

        if (this.mapEditor.isMousePoint) {
            const manager = MapManager.GetInstance();
            if (manager.actionStatus == ActionStatus.MOVE) {
                this.mapEditor.moveStatus = 2;
            }

            const localPos = this.mapEditor.mapContainer.getComponent(UITransform).convertToNodeSpaceAR(this.mapEditor.tileMaskNode.worldPosition);
            const gridPos = this.mapEditor.getPositionToGrid(new Vec2(localPos.x, localPos.y), this.mapEditor.tileMaskNode.getComponent(UITransform).contentSize);
            if(manager.actionStatus != ActionStatus.FLOOR){
                this.mapEditor.buildMap(gridPos);
            }
        }else{
            if(manager.actionStatus == ActionStatus.FLOOR){
                this.mapEditor.autoGraphicsWall();
                this.mapEditor.drawAutoBuildWall();
            }
        }

        // 摆放/删除模式保持 isBuildSwitch，下次可在地图任意位置按下继续跟手拖（与 PC 鼠标一致）
        if (manager.actionStatus != ActionStatus.GROUND && !this.shouldKeepBuildSwitchOnTouchEnd(manager)) {
            this.mapEditor.isBuildSwitch = false;
        } else if (manager.actionStatus == ActionStatus.GROUND) {
            const gridPos = MapModel.getInstance().worldPosToGride(event.getLocation() , this.mapEditor);
            const localPos = MapModel.getInstance().gridToWorld(gridPos , null , this.mapEditor);
            const worldPos = this.mapEditor.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(localPos)
            this.mapEditor.tileMaskNode.setWorldPosition(worldPos);
            this.mapEditor.buildMap(gridPos);
        }
        this.mapEditor.isMousePoint = false;
        this.mapEditor.isDragging = false;
    }
}


