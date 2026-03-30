import { _decorator, assetManager, Button, Canvas, Color, Component, director, EditBox, EventHandler, EventMouse, EventTouch, find , Graphics, Input, input, Label, log, Node, Prefab, RenderTexture, SceneAsset, ScrollView, Sprite, SpriteFrame, sys, Texture2D, UITransform, Vec2, Vec3, view } from 'cc';
import { CaptureUtils } from './CaptureUtils';
import { MapManager, ActionStatus } from './MapManager';
import { MapEditorUIConfig, NpcActionConfigs } from 'db://assets/src/common/MapEditorUIConfig';
import { EventType } from 'db://assets/src/EventType';
import { MapAssetsManager } from '../../../src/common/MapAssetsManager';
import { PrefabLoad } from '../../../scripts/Utils/PrefabLoad';
import { InfiniteList } from '../../../plugin/InfiniteList/InfiniteList';
import { GroundDataSource } from './UI/GroundDataSource';
import { MapModel } from '../../../scripts/Model/MapModel';
import { AppConst } from 'db://assets/scripts/AppConst';
import { CustomizeInput } from './CustomizeMap/CustomizeInput';
import { EditHead } from './EditHead';

const { ccclass, property } = _decorator;

@ccclass('MapEditorUI')
export class MapEditorUI extends Component {
    @property(Prefab)
    tileIcon: Prefab = null;

    @property(Node)
    saveConfirmDialog: Node = null;

    @property(Node)
    npcDesignDialog: Node = null;

    @property(Node)
    scene_Camera: Node = null;

    @property(Node)
    backBtn: Node = null;

    @property(Node)
    cancelBtn: Node = null;

    @property(Node)
    npcHeadNode: Node = null;

    @property(Node)
    npcHeads: Node = null;

    /**
     * 手指松手位置先转到「世界坐标」，再转到该节点的本地坐标作为依据。
     * 不拖则用 npcHeads 的父节点；再没有则用 MapEditorUI 根节点（与 editor_test 中 UI 层一致）。
     */
    @property(Node)
    npcHeadsUiCoordinateRoot: Node = null;

    @property({ displayName: 'npcHeads 位置偏移 X', tooltip: '松手换算后的本地坐标再叠加，单位与父节点一致，可微调左右' })
    npcHeadsPositionOffsetX = 0;

    @property({ displayName: 'npcHeads 位置偏移 Y', tooltip: '松手换算后的本地坐标再叠加，可微调上下' })
    npcHeadsPositionOffsetY = 0;

    @property({ displayName: 'npcHeads 位置偏移 Z', tooltip: '一般为 0，仅特殊层级需要时再改' })
    npcHeadsPositionOffsetZ = 0;

    @property(Node)
    GameUI: Node = null;

    @property(Node)
    buttonStepPack: Node[] = [];

    @property(InfiniteList)
    groundList : InfiniteList

    @property(InfiniteList)
    plantList : InfiniteList

    @property(InfiniteList)
    wallList : InfiniteList

    @property(InfiniteList)
    floorList : InfiniteList

    @property(InfiniteList)
    decorList : InfiniteList

    @property(InfiniteList)
    wallDecorList : InfiniteList

    @property(InfiniteList)
    decorOrnament : InfiniteList

    @property(InfiniteList)
    decorAppliance : InfiniteList

    @property(Canvas)
    public mapCanvas : Canvas

    @property(Label)
    public gridNumLabel : Label

    @property(Node)
    public bottomAddNode : Node

    private mapToolNode: { tool: Node; switch: Node; }[] = [];
    private tileMenu: Map<string, Node> = new Map;
    private tileContent: Node = null;

    private dramaSet: { name: string, script: string, intro: { npcId: string, npcName: string }[] } = { name: "Untitled", script: 'Untitled', intro: [] };


    private buttonActive: boolean[] = [false, false, false, false];

    private npcImageUrl: string = "https://dramai.world/img/npc/";

    private isSave: boolean = false;
    private saveIndex: number = 0;
    private isWaittingEpisodeData: boolean = false;
    private isDramaAction: boolean = false; // 是否开拍
    private regionSelectMode = false;
    private regionDragging = false;
    private regionStartGrid: Vec2 | null = null;
    private regionEndGrid: Vec2 | null = null;
    private pendingRegionRect: { minX: number, minY: number, maxX: number, maxY: number } | null = null;
    /** 仅当前「未确认」框选区域绑定的 npc id，与已写入 mapRegions[].npcIds 分离，避免多区域混用 */
    private pendingRegionNpcIds: string[] = [];
    private regionGraphicsNode: Node | null = null;
    private regionGraphics: Graphics | null = null;
    private customizeInputComp: CustomizeInput | null = null;
    /** 旧逻辑曾把 npcHeads 挂到 mapContainer，隐藏时还原 */
    private npcHeadsSavedParent: Node | null = null;
    private npcHeadsSavedSiblingIndex = 0;
    private static readonly REGION_MIN_GRID = 3;

    protected onLoad(): void {
        this.bottomAddNode.active = false
        this.gridNumLabel.string = `${AppConst.UIRoot.MapEditorWidth} x ${AppConst.UIRoot.MapEditorHeight}`;
        MapManager.GetInstance().setMapEditorUI(this);
        
        const content = this.node.getChildByName('toolUI').getChildByName('content');
        this.tileContent = this.node.getChildByName('tliePanel');

        for (let i = 0; i < content.children.length; i++) {
            const element = content.children[i];
            this.mapToolNode.push({ tool: element, switch: element.getChildByName('switch') ? element.getChildByName('switch') : null });
        }

        for (let i = 0; i < this.tileContent.children.length; i++) {
            const element = this.tileContent.children[i];
            element.active = false;
            element.children.forEach((child) => {
                if (child.name.indexOf('button') != -1) {
                    child.on(Node.EventType.TOUCH_END, this.onClickSwitchTileMenu, this);
                }
            })
            this.tileMenu.set(element.name, element);
        }

        for (let i = 0; i < this.mapToolNode.length; i++) {
            const element = this.mapToolNode[i];
            element.tool.active = true;
            if (element.switch) {
                element.switch.active = false;
                // element.tool.on(Node.EventType.TOUCH_END, this.onClickTool, this);
            }
            element.tool.on(Node.EventType.TOUCH_END, this.onClickTool, this);
        }

        this.buttonStepPack.forEach((child) => {
            child.getComponentsInChildren(Sprite).forEach((in_child) => {
                in_child.grayscale = true;
            })
            child.off(Node.EventType.TOUCH_END, this.onClickTool, this);
        })

        this.tileContent.active = false;
        this.saveConfirmDialog.active = false;

        if (!this.npcHeads) {
            this.npcHeads = this.node.getChildByName('npcHeads');
        }
        this.setNpcHeadsVisible(false);

        this.backBtn.active = false;
        if(MapModel.getInstance().showEditMapType == 0){
            this.node.active = false

            AppConst.PanelManager.openView("res/View/Game/GameView" , null , null , null , this.GameUI)
        }
    }

    protected onDestroy(): void {
        input.off(Input.EventType.MOUSE_DOWN, this.onRegionMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onRegionMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onRegionMouseUp, this);
        input.off(Input.EventType.TOUCH_START, this.onRegionTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onRegionTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onRegionTouchEnd, this);
    }

    start() {
        // EventSystem.addListent("OnClickTileIcon" , this.OnClickTileIcon , this)
        EventSystem.addListent("OnClickTileGroundIcon" , this.OnClickTileGroundIcon , this)
        EventSystem.addListent("OnClickTileOhterIcon" , this.OnClickTileOhterIcon , this)
        EventSystem.addListent("OnClickFloorIcon" , this.OnClickFloorIcon , this)

        this.groundList.Init(this.groundList.node.getComponent("GroundDataSource") as GroundDataSource)
        this.plantList.Init(this.plantList.node.getComponent("GroundDataSource") as GroundDataSource)
        this.wallList.Init(this.wallList.node.getComponent("GroundDataSource") as GroundDataSource)
        this.floorList.Init(this.floorList.node.getComponent("GroundDataSource") as GroundDataSource)
        this.decorList.Init(this.decorList.node.getComponent("GroundDataSource") as GroundDataSource)
        this.wallDecorList.Init(this.wallDecorList.node.getComponent("GroundDataSource") as GroundDataSource)
        this.decorOrnament.Init(this.decorOrnament.node.getComponent("GroundDataSource") as GroundDataSource)
        this.decorAppliance.Init(this.decorAppliance.node.getComponent("GroundDataSource") as GroundDataSource)
        input.on(Input.EventType.MOUSE_DOWN, this.onRegionMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onRegionMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onRegionMouseUp, this);
        input.on(Input.EventType.TOUCH_START, this.onRegionTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onRegionTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onRegionTouchEnd, this);
    }

    update(deltaTime: number) {
        if (this.isSave && this.saveIndex == 3) {
            this.saveIndex = 0;
            this.isSave = false;
        }
    }

    OnClickFloorIcon(){
        this.tileContent.active = false;

        this.setBottomNode();
    }

    OnClickTileOhterIcon(data){
        this.tileContent.active = false;

        this.setBottomNode();
    }

    OnClickTileGroundIcon(data){
        MapManager.GetInstance().tileId = data;
        MapManager.GetInstance().RefreshTileGroundById();
        this.tileContent.active = false;

        this.setBottomNode();
    }

    // OnClickTileIcon(data){
    //     MapManager.GetInstance().tileId = data;
    //     MapManager.GetInstance().RefreshTileById();
    //     this.tileContent.active = false;
    // }

    onClickTile(event: EventTouch) {
        const target = event.target as Node;
        MapManager.GetInstance().tileId = target.name;
        MapManager.GetInstance().RefreshTileById();
        this.tileContent.active = false;
    }

    onClickTool(event: EventTouch) {
        const target = event.target as Node;
        if (target.name !== "region") {
            this.disableRegionSelectionMode();
        }

        this.mapToolNode.forEach((pt) => {
            pt.tool.active = true;
            if (pt.switch)
                pt.switch.active = false;
        })
        this.tileMenu.forEach((pt) => {
            pt.active = false;
        })

        this.bottomAddNode.active = false;
        this.tileContent.active = true;
        MapManager.GetInstance().restTouch();

        let _index = 0;
        if (target.name == 'move') {
            _index = 0;
            this.tileContent.active = false;
            MapManager.GetInstance().actionStatus = ActionStatus.MOVE;
            MapManager.GetInstance().setMove();

            this.setBottomNode();
        } 
        // else if (target.name == 'delete') {
        //     _index = 1;
        //     this.tileContent.active = false;
        //     MapManager.GetInstance().actionStatus = ActionStatus.DETELE;
        //     MapManager.GetInstance().setDetele();

        //     this.setBottomNode();
        // } 
        else if (target.name == 'ground') {
            _index = 2;
            this.tileMenu.get('panel_ground').active = true;
            MapManager.GetInstance().actionStatus = ActionStatus.GROUND;
        } else if (target.name == 'plant') {
            _index = 3;
            this.tileMenu.get('panel_plant').active = true;
            MapManager.GetInstance().actionStatus = ActionStatus.PLANT;
        } else if (target.name == 'house') {
            _index = 4;
            this.tileMenu.get('panel_floor').active = true;
            this.tileMenu.get('panel_wall').active = false;

            if (MapManager.GetInstance().actionStatus != ActionStatus.FLOOR && MapManager.GetInstance().actionStatus != ActionStatus.WALL) {
                const floor_1 = this.tileMenu.get('panel_floor').getSiblingIndex();
                const floor_2 = this.tileMenu.get('panel_wall').getSiblingIndex();
                if (floor_1 < floor_2) {
                    this.tileMenu.get('panel_floor').setSiblingIndex(floor_2);
                    this.tileMenu.get('panel_wall').setSiblingIndex(floor_1);
                } else {
                    this.tileMenu.get('panel_floor').setSiblingIndex(floor_1);
                    this.tileMenu.get('panel_wall').setSiblingIndex(floor_2);
                }
                this.tileMenu.get('panel_floor').getComponent(Sprite).color = new Color("#FFFFFF");
                this.tileMenu.get('panel_wall').getComponent(Sprite).color = new Color("#929292");

                MapManager.GetInstance().actionStatus = ActionStatus.FLOOR;
            }
        } else if (target.name == 'decor') {
            _index = 5;
            this.tileMenu.get('panel_decor').active = true;
            MapManager.GetInstance().actionStatus = ActionStatus.DECOR;
        } else if (target.name == 'save') {
            _index = 10;
            this.onShowSaveDialog();

            this.onClickBack();
        } else if (target.name == 'back') {
            _index = 11;
            MapManager.GetInstance().actionStatus = ActionStatus.Back;
            MapManager.GetInstance().getMapEditor().hideTileMask();
            this.bottomAddNode.active = false;
        } else if (target.name == 'wallDacoration') {
            _index = 12;
            this.tileMenu.get('panel_wall_decor').active = true;
            MapManager.GetInstance().actionStatus = ActionStatus.WALL_DECOR;
        }else if (target.name == 'decor_ornament') {
            _index = 13;
            this.tileMenu.get('panel_decor_ornament').active = true;
            MapManager.GetInstance().actionStatus = ActionStatus.DECOR;
        }else if (target.name == 'appliance') {
            _index = 14;
            this.tileMenu.get('panel_appliance').active = true;
            MapManager.GetInstance().actionStatus = ActionStatus.DECOR;
        }else if(target.name == "region"){
            _index = 15;
            this.tileContent.active = false;
            MapManager.GetInstance().actionStatus = ActionStatus.REGION;
            this.enableRegionSelectionMode();

            this.setBottomNode();
        }


        // if (this.mapToolNode[_index].switch) {
        //     this.mapToolNode[_index].switch.active = true;
        // }
    }

    @property(Node)
    confirmBtn: Node = null;

    @property(Node)
    fanzhuangBtn: Node = null;

    setBottomNode(){
        this.confirmBtn.active = MapManager.GetInstance().actionStatus == ActionStatus.DECOR || MapManager.GetInstance().actionStatus == ActionStatus.PLANT
            || MapManager.GetInstance().actionStatus == ActionStatus.REGION
        this.fanzhuangBtn.active = MapManager.GetInstance().actionStatus == ActionStatus.DECOR  || MapManager.GetInstance().actionStatus == ActionStatus.PLANT

        this.bottomAddNode.active = MapManager.GetInstance().actionStatus != ActionStatus.MOVE
            && MapManager.GetInstance().actionStatus != ActionStatus.Back
    }

    private getOrCreateRegionGraphics(editor: any): Graphics | null {
        if (!editor || !editor.mapContainer) return null;
        if (this.regionGraphics && this.regionGraphics.isValid) return this.regionGraphics;

        this.regionGraphicsNode = new Node("RegionHighlightOverlay");
        this.regionGraphics = this.regionGraphicsNode.addComponent(Graphics);
        this.regionGraphics.lineWidth = 2;
        editor.mapContainer.addChild(this.regionGraphicsNode);
        this.regionGraphicsNode.setSiblingIndex(editor.mapContainer.children.length - 1);
        return this.regionGraphics;
    }

    private getGridFromScreen(screenPos: Vec2): Vec2 | null {
        const editor: any = MapManager.GetInstance().getMapEditor();
        if (!editor) return null;
        const grid = MapModel.getInstance().worldPosToGride(screenPos, editor);
        if (!grid) return null;
        const x = Math.max(0, Math.min(editor.mapWidth - 1, Math.round(grid.x)));
        const y = Math.max(0, Math.min(editor.mapHeight - 1, Math.round(grid.y)));
        return new Vec2(x, y);
    }

    private drawRegionHighlight(start: Vec2, end: Vec2, finalized: boolean) {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        this.pendingRegionRect = { minX, minY, maxX, maxY };
        this.redrawAllRegions(finalized ? 90 : 45);
    }

    private redrawAllRegions(pendingAlpha: number = 45) {
        const editor: any = MapManager.GetInstance().getMapEditor();
        if (!editor) return;
        const graphics = this.getOrCreateRegionGraphics(editor);
        if (!graphics) return;

        graphics.clear();
        const mm = MapModel.getInstance();
        /** 区域内每个格子画一个仅描边的方块（无底色） */
        const drawRegionCells = (minX: number, minY: number, maxX: number, maxY: number, strokeAlpha: number) => {
            graphics.strokeColor = new Color(42, 130, 255, strokeAlpha);
            const half = editor.tileSize * 0.5;
            const ts = editor.tileSize;
            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    const local = mm.gridToWorld(new Vec2(x, y), null, editor);
                    graphics.rect(local.x - half, local.y - half, ts, ts);
                    graphics.stroke();
                }
            }
        };

        const savedRegions = Array.isArray(editor.mapRegions) ? editor.mapRegions : [];
        for (let i = 0; i < savedRegions.length; i++) {
            const region = savedRegions[i];
            drawRegionCells(region.minX, region.minY, region.maxX, region.maxY, 255);
        }
        if (this.pendingRegionRect) {
            drawRegionCells(
                this.pendingRegionRect.minX,
                this.pendingRegionRect.minY,
                this.pendingRegionRect.maxX,
                this.pendingRegionRect.maxY,
                pendingAlpha
            );
        }
    }

    private beginRegionSelect(screenPos: Vec2) {
        if (!this.regionSelectMode) return;
        const grid = this.getGridFromScreen(screenPos);
        if (!grid) return;
        this.clearPendingRegionNpcIds();
        this.getNpcHeadEditComponent()?.resetRegionNpcUi();
        this.setNpcHeadsVisible(false);
        this.regionDragging = true;
        this.regionStartGrid = grid;
        this.regionEndGrid = grid.clone();
        this.drawRegionHighlight(this.regionStartGrid, this.regionEndGrid, false);
    }

    private updateRegionSelect(screenPos: Vec2) {
        if (!this.regionSelectMode || !this.regionDragging || !this.regionStartGrid) return;
        const grid = this.getGridFromScreen(screenPos);
        if (!grid) return;
        this.regionEndGrid = grid;
        this.drawRegionHighlight(this.regionStartGrid, this.regionEndGrid, false);
    }

    /**
     * @param screenPos getLocation，给格子用
     * @param npcHeadsScreenPos 可选：松手点在屏幕/视口内的坐标（触摸建议 getUILocation）；不传则沿用 screenPos
     */
    private finishRegionSelect(screenPos: Vec2, npcHeadsScreenPos?: Vec2) {
        if (!this.regionSelectMode || !this.regionDragging || !this.regionStartGrid) return;
        const grid = this.getGridFromScreen(screenPos);
        if (grid) {
            this.regionEndGrid = grid;
        }
        if (this.regionEndGrid && this.regionStartGrid) {
            const minX = Math.min(this.regionStartGrid.x, this.regionEndGrid.x);
            const maxX = Math.max(this.regionStartGrid.x, this.regionEndGrid.x);
            const minY = Math.min(this.regionStartGrid.y, this.regionEndGrid.y);
            const maxY = Math.max(this.regionStartGrid.y, this.regionEndGrid.y);
            const editor: any = MapManager.GetInstance().getMapEditor();
            const gw = maxX - minX + 1;
            const gh = maxY - minY + 1;
            if (gw < MapEditorUI.REGION_MIN_GRID || gh < MapEditorUI.REGION_MIN_GRID) {
                EventSystem.send("ShowTips", "区域至少为 3×3 格，请重新框选");
                this.pendingRegionRect = null;
                this.redrawAllRegions(45);
                this.setNpcHeadsVisible(false);
                this.clearPendingRegionNpcIds();
                editor?.clearPendingRegionNpcHeads?.();
                this.getNpcHeadEditComponent()?.resetRegionNpcUi();
                this.regionDragging = false;
                return;
            }
            if (editor?.isMapRegionOverlap(minX, minY, maxX, maxY)) {
                EventSystem.send("ShowTips", "区域与已有范围重叠，请重新框选");
                this.pendingRegionRect = null;
                this.redrawAllRegions(45);
                this.setNpcHeadsVisible(false);
                this.clearPendingRegionNpcIds();
                editor?.clearPendingRegionNpcHeads?.();
                this.getNpcHeadEditComponent()?.resetRegionNpcUi();
                this.regionDragging = false;
                return;
            }
            this.drawRegionHighlight(this.regionStartGrid, this.regionEndGrid, true);
            if (this.npcHeads?.isValid) {
                this.npcHeads.active = true;
            }
            this.moveNpcHeadsToFinger(npcHeadsScreenPos ?? screenPos);
            this.getNpcHeadEditComponent()?.refreshRegionSlotsFromUi();
        }
        this.regionDragging = false;
    }

    /** 坐标系：editor_test 里指定的 UI 节点（或 npcHeads 父 / this.node）的本地空间 */
    private getNpcHeadsUiCoordinateRoot(): Node | null {
        if (this.npcHeadsUiCoordinateRoot?.isValid) {
            return this.npcHeadsUiCoordinateRoot;
        }
        if (this.npcHeads?.parent?.isValid) {
            return this.npcHeads.parent;
        }
        return this.node;
    }

    /**
     * 不用 Camera：用参考 UITransform 四角的世界坐标 + 视口内归一化 (u,v) 双线性插值得到世界点。
     * 适用于参考节点铺满或与视口对齐的全屏 UI；参考节点见 npcHeadsUiCoordinateRoot。
     */
    private fingerScreenToWorldViaUiQuad(refUi: UITransform, fingerScreen: Vec2): Vec3 | null {
        if (!fingerScreen || !Number.isFinite(fingerScreen.x) || !Number.isFinite(fingerScreen.y)) {
            return null;
        }
        const w = refUi.contentSize.width;
        const h = refUi.contentSize.height;
        const ax = refUi.anchorPoint.x;
        const ay = refUi.anchorPoint.y;
        const bl = new Vec3(-ax * w, -ay * h, 0);
        const br = new Vec3((1 - ax) * w, -ay * h, 0);
        const tl = new Vec3(-ax * w, (1 - ay) * h, 0);
        const tr = new Vec3((1 - ax) * w, (1 - ay) * h, 0);
        const wbl = refUi.convertToWorldSpaceAR(bl);
        const wbr = refUi.convertToWorldSpaceAR(br);
        const wtl = refUi.convertToWorldSpaceAR(tl);
        const wtr = refUi.convertToWorldSpaceAR(tr);

        const vp = view.getViewportRect();
        if (vp.width <= 0 || vp.height <= 0) {
            return null;
        }
        let u = (fingerScreen.x - vp.x) / vp.width;
        let v = (fingerScreen.y - vp.y) / vp.height;
        u = Math.max(0, Math.min(1, u));
        v = Math.max(0, Math.min(1, v));

        const bottom = new Vec3();
        const top = new Vec3();
        const world = new Vec3();
        Vec3.lerp(bottom, wbl, wbr, u);
        Vec3.lerp(top, wtl, wtr, u);
        Vec3.lerp(world, bottom, top, v);
        return world;
    }

    /** 松手屏幕点 → 世界点（仅 UITransform）→ npcHeads 父节点本地坐标 */
    private moveNpcHeadsToFinger(screenPos: Vec2) {
        const heads = this.npcHeads;
        const refNode = this.getNpcHeadsUiCoordinateRoot();
        const refUi = refNode?.getComponent(UITransform);
        if (!heads?.isValid || !refUi) {
            return;
        }
        const world = this.fingerScreenToWorldViaUiQuad(refUi, screenPos);
        if (!world) {
            return;
        }
        const parentUi = heads.parent?.getComponent(UITransform);
        if (!parentUi) {
            return;
        }
        const local = parentUi.convertToNodeSpaceAR(world);
        heads.setPosition(
            local.x + this.npcHeadsPositionOffsetX,
            local.y + this.npcHeadsPositionOffsetY,
            local.z + this.npcHeadsPositionOffsetZ
        );
        heads.active = true;
    }

    private restoreNpcHeadsParent() {
        const heads = this.npcHeads;
        const editor: any = MapManager.GetInstance().getMapEditor();
        if (!heads?.isValid) {
            return;
        }

        if (!editor?.mapContainer || !this.npcHeadsSavedParent) {
            return;
        }
        if (heads.parent !== editor.mapContainer) {
            return;
        }
        heads.setParent(this.npcHeadsSavedParent, false);
        const idx = Math.min(this.npcHeadsSavedSiblingIndex, Math.max(0, this.npcHeadsSavedParent.children.length - 1));
        heads.setSiblingIndex(idx);
    }

    private setNpcHeadsVisible(visible: boolean) {
        if (!this.npcHeads?.isValid) {
            return;
        }
        if (!visible) {
            this.restoreNpcHeadsParent();
        }
        this.npcHeads.active = visible;
    }

    /** 每次点击底部确认按钮时调用：先收起头像条 */
    public hideNpcHeadsOnConfirm() {
        this.setNpcHeadsVisible(false);
    }

    public getPendingRegionRect(): { minX: number, minY: number, maxX: number, maxY: number } | null {
        return this.pendingRegionRect;
    }

    /**
     * 框选确认前若需对已存在区域增删 NPC，可返回 region id；当前流程为松手后选 NPC 再确认，默认 null。
     */
    public getPendingRegionNpcBindId(): string | null {
        return null;
    }

    public getPendingRegionNpcIds(): string[] {
        return [...this.pendingRegionNpcIds];
    }

    /** 切换当前待确认区域内的 npc（仅 pending 框选阶段使用） */
    public togglePendingRegionNpcId(npcId: string): void {
        const id = String(npcId);
        const idx = this.pendingRegionNpcIds.indexOf(id);
        if (idx >= 0) {
            this.pendingRegionNpcIds.splice(idx, 1);
            return;
        }
        const rect = this.pendingRegionRect;
        if (rect) {
            const gw = rect.maxX - rect.minX + 1;
            const gh = rect.maxY - rect.minY + 1;
            if (this.pendingRegionNpcIds.length >= gw * gh) {
                EventSystem.send('ShowTips', '该区域格子已满');
                return;
            }
        }
        this.pendingRegionNpcIds.push(id);
    }

    private clearPendingRegionNpcIds() {
        this.pendingRegionNpcIds.length = 0;
    }

    private getNpcHeadEditComponent(): EditHead | null {
        return this.npcHeads?.getComponent(EditHead) ?? null;
    }

    public confirmRegionSelection(): boolean {
        if (!this.regionSelectMode || !this.pendingRegionRect) {
            return false;
        }
        const editor: any = MapManager.GetInstance().getMapEditor();
        if (!editor) return false;

        const rect = this.pendingRegionRect;
        const gw = rect.maxX - rect.minX + 1;
        const gh = rect.maxY - rect.minY + 1;
        if (gw < MapEditorUI.REGION_MIN_GRID || gh < MapEditorUI.REGION_MIN_GRID) {
            EventSystem.send("ShowTips", "区域至少为 3×3 格");
            return false;
        }
        const npcIdsStr = this.pendingRegionNpcIds.map((id) => String(id));
        const added = editor.addMapRegion(rect.minX, rect.minY, rect.maxX, rect.maxY, npcIdsStr);
        if (!added) {
            EventSystem.send("ShowTips", "区域不可重叠");
            return false;
        }
        const lastRegion = editor.mapRegions?.[editor.mapRegions.length - 1];
        if (lastRegion?.id && npcIdsStr.length > 0) {
            MapModel.getInstance().sendMapRegionNpcBind(lastRegion.id, npcIdsStr);
        }
        editor.clearPendingRegionNpcHeads?.();
        if (lastRegion?.id) {
            editor.layoutRegionNpcHeadsForRegion?.(lastRegion.id, rect, npcIdsStr);
        }
        this.clearPendingRegionNpcIds();
        this.getNpcHeadEditComponent()?.resetRegionNpcUi();
        this.pendingRegionRect = null;
        this.redrawAllRegions();
        return true;
    }

    public cancelPendingRegionSelection() {
        this.pendingRegionRect = null;
        this.clearPendingRegionNpcIds();
        MapManager.GetInstance().getMapEditor()?.clearPendingRegionNpcHeads?.();
        this.getNpcHeadEditComponent()?.resetRegionNpcUi();
        this.redrawAllRegions();
    }

    public refreshRegionHighlightsFromData() {
        this.pendingRegionRect = null;
        this.clearPendingRegionNpcIds();
        MapManager.GetInstance().getMapEditor()?.clearPendingRegionNpcHeads?.();
        this.getNpcHeadEditComponent()?.resetRegionNpcUi();
        this.redrawAllRegions();
    }

    public setRegionHighlightVisible(visible: boolean) {
        if (!this.regionGraphicsNode || !this.regionGraphicsNode.isValid) return;
        this.regionGraphicsNode.active = visible;
    }

    private onRegionMouseDown(event: EventMouse) {
        if (!this.regionSelectMode) return;
        if (event.getButton() !== EventMouse.BUTTON_LEFT) return;
        this.beginRegionSelect(event.getLocation());
    }

    private onRegionMouseMove(event: EventMouse) {
        if (!this.regionSelectMode) return;
        this.updateRegionSelect(event.getLocation());
    }

    private onRegionMouseUp(event: EventMouse) {
        if (!this.regionSelectMode) return;
        if (event.getButton() !== EventMouse.BUTTON_LEFT) return;
        const loc = new Vec2();
        event.getLocation(loc);
        this.finishRegionSelect(loc);
    }

    private onRegionTouchStart(event: EventTouch) {
        if (!this.regionSelectMode) return;
        this.beginRegionSelect(event.getLocation());
    }

    private onRegionTouchMove(event: EventTouch) {
        if (!this.regionSelectMode) return;
        this.updateRegionSelect(event.getLocation());
    }

    private onRegionTouchEnd(event: EventTouch) {
        if (!this.regionSelectMode) return;
        const loc = new Vec2();
        const ui = new Vec2();
        event.getLocation(loc);
        event.getUILocation(ui);
        this.finishRegionSelect(loc, ui);
    }

    private enableRegionSelectionMode() {
        this.regionSelectMode = true;
        this.regionDragging = false;
        this.regionStartGrid = null;
        this.regionEndGrid = null;
        this.pendingRegionRect = null;
        MapManager.GetInstance().actionStatus = ActionStatus.REGION;
        MapManager.GetInstance().getMapEditor()?.hideTileMask();
        const editor: any = MapManager.GetInstance().getMapEditor();
        if (editor) {
            this.getOrCreateRegionGraphics(editor);
        }
        if (!this.customizeInputComp || !this.customizeInputComp.isValid) {
            this.customizeInputComp = director.getScene().getComponentInChildren(CustomizeInput);
        }
        if (this.customizeInputComp && this.customizeInputComp.isValid) {
            this.customizeInputComp.enabled = false;
        }
        this.setNpcHeadsVisible(false);
        this.clearPendingRegionNpcIds();
        MapManager.GetInstance().getMapEditor()?.clearPendingRegionNpcHeads?.();
        this.getNpcHeadEditComponent()?.resetRegionNpcUi();
    }

    private disableRegionSelectionMode() {
        if (!this.regionSelectMode && MapManager.GetInstance().actionStatus !== ActionStatus.REGION) {
            return;
        }
        this.regionSelectMode = false;
        this.regionDragging = false;
        this.regionStartGrid = null;
        this.regionEndGrid = null;
        this.pendingRegionRect = null;
        if (this.customizeInputComp && this.customizeInputComp.isValid) {
            this.customizeInputComp.enabled = true;
        }
        this.setNpcHeadsVisible(false);
        this.clearPendingRegionNpcIds();
        MapManager.GetInstance().getMapEditor()?.clearPendingRegionNpcHeads?.();
        this.getNpcHeadEditComponent()?.resetRegionNpcUi();
    }

    OnClickDelete(){
        this.disableRegionSelectionMode();
        this.tileContent.active = false;
        MapManager.GetInstance().actionStatus = ActionStatus.DETELE;
        MapManager.GetInstance().setDetele();

        this.setBottomNode();
    }

    onClickSwitchTileMenu(event: EventTouch) {
        const target = event.target as Node;

        if (target.name == 'button_floor') {
            const floor_1 = this.tileMenu.get('panel_floor').getSiblingIndex();
            const floor_2 = this.tileMenu.get('panel_wall').getSiblingIndex();
            if (floor_1 < floor_2) {
                this.tileMenu.get('panel_floor').setSiblingIndex(floor_2);
                this.tileMenu.get('panel_wall').setSiblingIndex(floor_1);
            } else {
                this.tileMenu.get('panel_floor').setSiblingIndex(floor_1);
                this.tileMenu.get('panel_wall').setSiblingIndex(floor_2);
            }
            this.tileMenu.get('panel_floor').getComponent(Sprite).color = new Color("#FFFFFF");
            this.tileMenu.get('panel_wall').getComponent(Sprite).color = new Color("#929292");

            MapManager.GetInstance().actionStatus = ActionStatus.FLOOR;
        } else if (target.name == 'button_wall') {
            const floor_1 = this.tileMenu.get('panel_floor').getSiblingIndex();
            const floor_2 = this.tileMenu.get('panel_wall').getSiblingIndex();
            if (floor_1 < floor_2) {
                this.tileMenu.get('panel_floor').setSiblingIndex(floor_1);
                this.tileMenu.get('panel_wall').setSiblingIndex(floor_2);
            } else {
                this.tileMenu.get('panel_floor').setSiblingIndex(floor_2);
                this.tileMenu.get('panel_wall').setSiblingIndex(floor_1);
            }
            this.tileMenu.get('panel_floor').getComponent(Sprite).color = new Color("#929292");
            this.tileMenu.get('panel_wall').getComponent(Sprite).color = new Color("#FFFFFF");

            MapManager.GetInstance().actionStatus = ActionStatus.WALL;
        }
    }

    // 检查当前地图的房屋内是否有
    isInCludeNpcHouse(npcId: string): boolean {
        let active = false;
        const editor = MapManager.GetInstance().getMapEditor();
        editor.getAllHouseData().forEach((pt) => {
            if (pt.npc && pt.npc.id == npcId) {
                active = true;
                return;
            }
        })

        return active;
    }

    onClickNpcDesignCancel() {
        this.npcDesignDialog.active = false;
    }

    onClickScriptConfirm() {
        this.tileMenu.get('panel_script').active = false;
        this.checkButtonVisible();
    }

    onClickScriptCancel() {
        this.tileMenu.get('panel_script').active = false;
    }

    onSetDramaName(editor: EditBox, custom) {
        this.dramaSet.name = editor.string;
    }

    onSetDramaIntro(editor: EditBox, custom) {
        this.dramaSet.script = editor.string;
    }

    // 发送地图数据保存
    sendSaveMapData() {
        const editor = MapManager.GetInstance().getMapEditor();
        const visible = view.getVisibleSize();
        const rt = new RenderTexture();
        rt.reset({
            width: Math.max(1, Math.floor(visible.width)),
            height: Math.max(1, Math.floor(visible.height)),
        });
        const prevTarget = editor.mainCamera.targetTexture;
        editor.mainCamera.targetTexture = rt;
        director.root.frameMove(0);
        editor.mainCamera.targetTexture = prevTarget;
        
        CaptureUtils.captureScreenToBlob(rt, (blob) => {
            if (!blob) return;
            const reader = new FileReader();
            reader.onloadend = () => {
            let base64Image = String(reader.result || '');
                if (base64Image) {
                    console.log(base64Image)
                    // sys.localStorage.setItem("MapDataPreview", base64Image);
                    MapModel.getInstance().saveMapData(editor , base64Image);
                }
            };
            reader.readAsDataURL(blob);
        });        
    }

    onClickBack() {
        if (MapManager.GetInstance().actionStatus == ActionStatus.REGION) {
            this.cancelPendingRegionSelection();
            this.disableRegionSelectionMode();
        }
        this.mapToolNode.forEach((pt) => {
            pt.tool.active = true;
            if (pt.switch)
                pt.switch.active = false;
        })
        this.tileMenu.forEach((pt) => {
            pt.active = false;
        })

        MapManager.GetInstance().actionStatus = ActionStatus.Back;
        MapManager.GetInstance().getMapEditor().hideTileMask();
        this.bottomAddNode.active = false;
    }

    checkButtonVisible(agin: boolean = false) {
        const manager = MapManager.GetInstance();
        const house = manager.getMapEditor().getAllHouseData();

        if (!this.buttonActive[0] || agin) {
            if (house.size > 0) {
                let islike = false;
                house.forEach((value, key) => {
                    if (value.decor.size > 0) {
                        islike = true;
                        return;
                    }
                })

                if (islike) {
                    this.ButtonStep(0, true);
                    this.buttonActive[0] = true;
                } else {
                    this.ButtonStep(0, false);
                    this.buttonActive[0] = false;

                    this.ButtonStep(1, false);
                    this.buttonActive[1] = false;

                    this.ButtonStep(2, false);
                    this.buttonActive[2] = false;
                }
            } else {
                this.ButtonStep(0, false);
                this.buttonActive[0] = false;

                this.ButtonStep(1, false);
                this.buttonActive[1] = false;

                this.ButtonStep(2, false);
                this.buttonActive[2] = false;
                return;
            }
        }

        if (!this.buttonActive[1]) {
            if (house.size > 0) {
                house.forEach((value, key) => {
                    if (value.npc) {
                        this.ButtonStep(1, true);
                        this.buttonActive[1] = true;
                        return;
                    }
                })
            }
        }

        if (!this.buttonActive[2]) {
            if (this.dramaSet.name != "Untitled" || this.dramaSet.script != "Untitled") {
                this.ButtonStep(2, true);
                this.buttonActive[2] = true;

                this.buttonActive[3] = true;
                this.buttonStepPack[3].on(Node.EventType.TOUCH_END, this.onClickTool, this);
            }
        }
    }

    ButtonStep(_index: number, is: boolean) {
        if (is) {
            this.buttonStepPack[_index].on(Node.EventType.TOUCH_END, this.onClickTool, this);
        } else {
            this.buttonStepPack[_index].off(Node.EventType.TOUCH_END, this.onClickTool, this);
        }
        this.buttonStepPack[_index].getComponentsInChildren(Sprite).forEach((child) => {
            child.grayscale = !is;
        })
    }

    onShowSaveDialog() {
        this.saveConfirmDialog.active = true;
    }

    onClickConfirmSave() {
        this.saveConfirmDialog.active = false;
        MapManager.GetInstance().getMapEditor().hideTileMask();
        this.sendSaveMapData();
        // this.sendDramaConfig();
    }

    onClickCancelSave() {
        this.saveConfirmDialog.active = false;
    }

    onClickMenu() {
        let lobbyBundle = assetManager.getBundle("lobby")
        lobbyBundle.loadScene("lobbyScene", (err, scene: SceneAsset) => {
            if (err) {
                console.log("loadScene error" + err)
                return;
            }
            else {
                director.runScene(scene);
            }
        });
    }

    setButtonYes() {
        for (let i = 0; i < this.buttonStepPack.length; i++) {
            this.buttonActive[i] = true;
        }

        this.buttonStepPack.forEach((child) => {
            if (child.name == "videoStop") {
                child.getComponentsInChildren(Sprite).forEach((in_child) => {
                    in_child.grayscale = true;
                })
                child.off(Node.EventType.TOUCH_END, this.onClickTool, this);
            } else {
                child.getComponentsInChildren(Sprite).forEach((in_child) => {
                    in_child.grayscale = false;
                })
                child.on(Node.EventType.TOUCH_END, this.onClickTool, this);
            }
        })
    }

    // 关闭除停止开拍按钮其他按钮
    closeToolBtn() {
        for (let i = 0; i < this.mapToolNode.length; i++) {
            const element = this.mapToolNode[i];
            element.tool.active = true;
            if (element.tool.name == "videoStop") {
                element.tool.getComponentsInChildren(Sprite).forEach((in_child) => {
                    in_child.grayscale = false;
                })
                element.tool.on(Node.EventType.TOUCH_END, this.onClickTool, this);
            } else {
                if (element.switch) element.switch.active = false;
                element.tool.getComponentsInChildren(Sprite).forEach((in_child) => {
                    in_child.grayscale = true;
                })
                element.tool.off(Node.EventType.TOUCH_END, this.onClickTool, this);
            }
        }

        this.cancelBtn.getComponentsInChildren(Sprite).forEach((child) => {
            child.grayscale = true;
        })
        this.cancelBtn.getChildByName("icon").getComponent(Button).interactable = false;
    }

    // 开启除停止开拍按钮其他按钮
    openToolBtn() {
        for (let i = 0; i < this.mapToolNode.length; i++) {
            const element = this.mapToolNode[i];
            element.tool.active = true;
            if (element.tool.name == "videoStop") {
                element.tool.getComponentsInChildren(Sprite).forEach((in_child) => {
                    in_child.grayscale = true;
                })
            } else {
                if (element.switch) element.switch.active = false;
                element.tool.getComponentsInChildren(Sprite).forEach((in_child) => {
                    in_child.grayscale = false;
                })
            }
            element.tool.on(Node.EventType.TOUCH_END, this.onClickTool, this);
        }

        this.cancelBtn.getComponentsInChildren(Sprite).forEach((child) => {
            child.grayscale = false;
        })
        this.cancelBtn.getChildByName("icon").getComponent(Button).interactable = true;
    }

    onCaptureCurrentScene(npcId: number, oid: string = "") {
        const _frame = CaptureUtils.capture(find("Canvas"), { x: this.scene_Camera.position.x, y: this.scene_Camera.position.y, width: 15 * 32, height: 15 * 32 }, false);
        CaptureUtils.captureScreenToBlob(_frame.texture as RenderTexture, (blob) => {
            const mapEditor = MapManager.GetInstance().getMapEditor();
            const all_house = mapEditor.getAllHouseData();

            let cur_house = null;
            all_house.forEach((value, key) => {
                if (value.npc.id == `npc_${npcId}`) {
                    cur_house = value;
                    return;
                }
            })

            if (!cur_house) {
                return;
            }

            const pos = mapEditor.getGridToPosition(mapEditor.getCenterPos(cur_house.grid));

            let pack = [];
            let single = {};
            cur_house.decor.forEach((value, key) => {
                const config = NpcActionConfigs.get(value.tile.name.split("_")[1]);
                const position = this.getNineGridDirection(value.tile.getPosition(), pos, new Vec2(32, 32));
                pack.push({
                    "name": config.name,
                    "position": position === null ? "middle" : position,
                    "actions": config.actions
                })

                if (oid == value.tile.name.split("_")[1]) {
                    single = {
                        "name": config.name,
                        "position": position === null ? "middle" : position,
                        "actions": config.actions
                    }
                }
            })

            const content = {
                "objects": pack
            }

            const action = {
                "objects": single
            }

            const formData = new FormData();
            formData.append('file', blob, 'screenshot.png'); // 文件名为 screenshot.png
            formData.append("content", JSON.stringify(content));
            formData.append("action", JSON.stringify(action));
            // 使用 XMLHttpRequest 上传
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://dramai.world/npc/upload-image', true);
            xhr.onload = () => {
                if (xhr.status === 200) {
                    console.log('Upload Success:', xhr.responseText);
                } else {
                    console.log('Upload Failed:', xhr.responseText);
                }
            };
            xhr.send(formData);
        })
    }

    getNineGridDirection(worldPos: Vec3, gridCenter: Vec3, cellSize: Vec2): string {
        // 计算相对中心点的偏移量
        const offsetX = worldPos.x - gridCenter.x;
        const offsetY = worldPos.y - gridCenter.y;

        // 计算单个格子的半宽和半高（用于判断区域）
        const halfWidth = cellSize.x / 2;
        const halfHeight = cellSize.y / 2;

        // 判断列方向（左右）
        let colDir: 'left' | 'middle' | 'right' | null = null;
        if (offsetX < -halfWidth) {
            colDir = 'left';
        } else if (offsetX > halfWidth) {
            colDir = 'right';
        } else if (Math.abs(offsetX) <= halfWidth) {
            colDir = 'middle';
        }

        // 判断行方向（上下）
        let rowDir: 'top' | 'middle' | 'bottom' | null = null;
        if (offsetY > halfHeight) {
            rowDir = 'top';  // Y轴向上，值越大越靠上
        } else if (offsetY < -halfHeight) {
            rowDir = 'bottom';
        } else if (Math.abs(offsetY) <= halfHeight) {
            rowDir = 'middle';
        }

        // 组合方位（处理边界情况）
        if (colDir && rowDir) {
            // 特殊处理中心
            if (colDir === 'middle' && rowDir === 'middle') {
                return 'middle-middle';
            }
            return `${rowDir}-${colDir}`;
        }

        // 超出九宫格范围
        return null;
    }

    onSaveMapDataCallBack(param) {
        this.saveIndex += 1;
    }

    onSaveDramaDataCallBack(param) {
        this.saveIndex += 1;
    }

    onSaveNpcDataCallBack(param) {
        this.saveIndex += 1;
    }
}


