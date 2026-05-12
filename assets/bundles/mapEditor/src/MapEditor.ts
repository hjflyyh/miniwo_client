import { _decorator, Animation, Camera, CCBoolean, CCInteger, Color, Component, director, EventMouse, EventTouch, find, Graphics, Input, input, instantiate, Label, Layers, log, math, Node, Prefab, RenderTexture, size, Size, Sprite, SpriteFrame, sys, Texture2D, tween, UITransform, v2, Vec2, Vec3, view } from 'cc';
import { TileObjectData } from './TileItem';
import { ActionStatus, MapManager } from './MapManager';
import {DisplayTitle} from "db://assets/scripts/View/Utils/DisplayTitle";
import {AppConst} from "db://assets/scripts/AppConst";
import { PrefabLoad } from '../../../scripts/Utils/PrefabLoad';
import { Utils } from '../../../scripts/Utils/Utils';
import { MapModel } from '../../../scripts/Model/MapModel';
import { computeSameTypeClosedFillCells } from './RoadClosureFillUtil';
import { RectangleHouseBuilder } from './RectangleHouseBuilder';
import { MapLoadMap } from './MapLoadMap';
import { RegionNpcCellBinder } from './RegionNpcCellBinder';
import { network } from '../../../scripts/Model/RequestData';
import { FARM_MAP_GRID_HEIGHT, FARM_MAP_GRID_WIDTH } from './farm/FarmMapConstants';
import { FarmMapEditorModule, setMapBgGrassSpriteVisible } from './farm/FarmMapEditorModule';

const { ccclass, property } = _decorator;

enum GridCellType {
    EMPTY,   // 空
    WALL,    // 墙
    VISITED  // 已访问
}

// 墙体贴图配置
interface WallSpriteConfig {
    [key: number]: SpriteFrame;
}

export interface MapData {
    Ground: { id: string, _type: string, position: string , cfgId : number}[],
    Plant: { id: string, _type: string, position: string, flipX?: number, scaleX?: number, offsetX?: number, offsetY?: number }[],
    /** mapEditor 分包 mapEdit 配置的农田/外景摆件（与 Plant 同级存在 mapItems） */
    Fram?: { id: string, _type: string, position: string, flipX?: number, scaleX?: number, offsetX?: number, offsetY?: number }[],
    Region?: { id: string, minX: number, minY: number, maxX: number, maxY: number, npcIds?: string[] }[],
    Floor: { id: string, _type: string, position: string }[],
    House: {
        houseName?: string,
        Floor: { id: string, _type: string, position: string }[],
        OpenWall: { position: string, doorDecorId?: string }[],
        Wall: { id: string, _type: string, position: string }[],
        Decor: { id: string, oid: string, _type: string, position: string, flipX?: number, scaleX?: number, offsetX?: number, offsetY?: number }[],
    }[],
    Walkable?: {
        width: number,
        height: number,
        cells: string[],
    },
    mapWidth?: number,
    mapHeight?: number,
    gridWidth?: number,
    gridHeight?: number
}

export interface NpcDebugTileData {
    tile_x?: number;
    tile_y?: number;
    target_tile_x?: number;
    target_tile_y?: number;
}

@ccclass('MapEditor')
export class MapEditor extends Component {
    @property(Camera)
    mainCamera: Camera = null;

    @property(Camera)
    uiCamera: Camera = null;

    @property(Node)
    public mapContainer: Node = null!;

    @property(Node)
    public npcLayer: Node = null!;

    @property(Node)
    public disMapContainer: Node = null!;

    @property(Node)
    public homeWallTilemap: Node = null

    @property(Node)
    public tileMaskNode: Node = null;

    @property(UITransform)
    public mapBgTransform: UITransform = null;

    @property(Prefab)
    wallPrefab: Prefab = null;

    @property({ type: Prefab, displayName: '区域NPC格子预制体', tooltip: '若指定，则区域内每个 npc 格子优先实例化此预制体（可挂 RegionNpcCellBinder）；未指定时仍按 mapEditNpc 的 prefab/tileId 或占位格' })
    public regionNpcCellPrefab: Prefab = null;

    @property([SpriteFrame])
    public outWallSprites: SpriteFrame[] = [];

    @property
    public bottomDoorOffsetX: number = 0;

    @property
    public bottomDoorOffsetY: number = 16;

    @property
    public sideDoorOffsetX: number = 0;

    @property
    public sideDoorOffsetY: number = 0;

    @property
    public sideDoorInsetX: number = 10;
    

    private buildFloorPoints: Vec2[] = [];
    public houseItems: Map<string, { tile: Node, tileType: string, belong?: string }> = new Map();
    public mapItems: Map<string, { id: string, tile: Node, tileType: string, belong?: string, flipX?: number, offsetX?: number, offsetY?: number }> = new Map();
    public mapData: number[][] = [];
    public mapRegions: { id: string, minX: number, minY: number, maxX: number, maxY: number, npcIds: string[] }[] = [];
    public tileSize = 32;
    public mapWidth = 46;
    public mapHeight = 88;

    @property({ displayName: '启用格子拖动偏移', tooltip: '关闭时预览与摆放严格按格子中心；开启后手指/鼠标可带偏移（与逻辑占格无关）' })
    public enablePlacementDragOffset : boolean = false;

    @property({ displayName: '允许道具堆叠摆放', tooltip: '勾选后可在合法地板格上叠放家具，可摆放判断放宽（不再要求 place_type 与下层家具 decor_type 一一匹配）。不勾选则沿用原有不可堆叠与类型匹配规则。' })
    public enableDecorStackPlacement : boolean = false;

    /** 最近一次鼠标/触摸在 mapContainer 下的本地坐标（用于格子内偏移摆放） */
    public lastPointerLocalPos: Vec2 | null = null;
    private graphics: Graphics = null;
    private curTileNode: Node = null;
    private maskSp: Sprite = null;
    private buildIcon: Node = null;
    private buildControl: {
        move: Animation,
        detele: Animation,
        frame: UITransform,
        sign: { up: Node, down: Node, left: Node, right: Node },
        npc_banner1: Node,
    } = { move: null, detele: null, frame: null, sign: null, npc_banner1: null };

    moveItem: { id: string, tile: Node, tileType: string, initGride: Vec2, belong?: string, decorKey?: string, offsetX?: number, offsetY?: number, initOffsetX?: number, initOffsetY?: number, grabOffsetX?: number, grabOffsetY?: number } = null;
    deteleItem: { tile: Node | null, tileType: string, belong?: string, decorKey?: string, doorPos?: Vec2, doorDir?: string, anchorPos?: Vec2 } = null;
    moveStatus: number = 0;

    public groundType: number = 1;
    public _houseIndex: number = 100;
    private readonly houseMinWidth = 8;
    private readonly houseMinHeight = 10;
    private readonly houseInsetTop = 4;
    private readonly houseInsetBottom = 1;
    private readonly houseInsetLeft = 1;
    private readonly houseInsetRight = 1;
    private lastSelectionFailReason: '' | 'size' | 'placement' = '';

    private NEIGHBOURS: Vec2[] = [
        new Vec2(0, 0),
        new Vec2(1, 0),
        new Vec2(0, -1),
        new Vec2(1, -1)
    ]

    public allHouse: Map<string, {
        grid: Vec2[],
        surround: GridCellType[][],
        inWall: Vec2[],
        outWall: Vec2[],
        openWall: Vec2[],
        openWallDoorDecorIdMap?: Map<string, string>,
        base: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string }>,
        decor: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string, position?: string, flipX?: number, offsetX?: number, offsetY?: number }>,
        npc: { id: string, _node: Node, position: string, design: { npcName: string, npcIntro: string } },
        horWalls: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string }>,
        verWalls: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string }>,
        cfgId : number,
        floorTileId?: string,
        floorRenderNode?: Node,
        floorPatchRenderNodes?: Node[]
    }> = new Map();

    private displayTilemap: Map<string, { tileNode: Node, _type: number , cfgId : number}> = new Map();
    public placeholderTilemap: Map<string, { _type: number, empty: boolean, _tileType: number , cfgId ?: number}> = new Map();
    public neighbourTupleToTile: {
        type1: number;
        type2: number;
        type3: number;
        type4: number;
        sp: string
    }[] = [];

    public allMapAssetsData: MapData = {
        Ground: [],
        Plant: [],
        Fram: [],
        Region: [],
        Floor: [],
        House: [],
        Walkable: {
            width: 0,
            height: 0,
            cells: [],
        }
    };

    private boundaryMin: Vec3 = new Vec3(0, 0, 0);
    private boundaryMax: Vec3 = new Vec3(0, 0, 0);

    public isBuildSwitch: boolean = false;
    public isMousePoint: boolean = false;
    public moveActionIndex: number = 0;

    private currentOrthoSize: number = 800;
    private decorStackSeed = 0;
    private lastDecorHoverLogState = '';
    

    isDragging: boolean = false;

    
    minXCamera: number = 0;
    maxXCamera: number = 0;
    minYCamera: number = 0;
    maxYCamera: number = 0;
    lastMousePosition: Vec3 = new Vec3(0, 0, 0);
    startMousePosition: Vec2 = new Vec2(0, 0);

    public _startPoint
    public _currentPoint

    public _startGrad
    public _currentGrad

    @property(Graphics)
    public mapGraphics : Graphics

    //当前地图的id
    public chooseGroundId = 1

    @property
    public debugShowWalkable = false;

    /** Cocos Graphics 单次 fill 顶点缓冲有上限；大地图_walkable 调试需分批 fill */
    private static readonly WALKABLE_DEBUG_MAX_RECTS_PER_FILL = 1500;

    @property
    public map_data_test = false;

    private walkableDebugNode: Node | null = null;
    private walkableDebugGraphics: Graphics | null = null;
    private npcTileDebugNode: Node | null = null;
    private npcTileDebugGraphics: Graphics | null = null;
    private lastWebMapInfoPayload = '';


    public mapGameType = 0; //农场

    /** mapGameType===0 时农场专属逻辑（底图、mapBg 草地显隐等），见 farm/FarmMapEditorModule */
    private farmModule: FarmMapEditorModule | null = null;

    /**
     * 绘制选择框
     */
    private isDrawSelectionBox = false
    public drawSelectionBox(): void {
        if (!this.mapGraphics) return;
        const manager = MapManager.GetInstance();

        // 清除之前的绘制
        this.mapGraphics.clear();

        // 计算框的尺寸和位置
        const x = Math.min(this._startPoint.x, this._currentPoint.x);
        const y = Math.min(this._startPoint.y, this._currentPoint.y);
        const width = Math.abs(this._currentPoint.x - this._startPoint.x);
        const height = Math.abs(this._currentPoint.y - this._startPoint.y);

        // 如果框太小，不绘制
        if (width < 5 || height < 5) return;

        let canDraw = false;
        if (manager.actionStatus === ActionStatus.FLOOR) {
            canDraw = this.canReplaceIndoorFloorRect();
            if (!canDraw) {
                canDraw = this.autoGraphicsWall();
            }
        } else {
            canDraw = this.autoGraphicsWall();
        }
        this.mapGraphics.strokeColor = canDraw ? Color.GREEN : Color.RED;
        this.isDrawSelectionBox = canDraw;
        // let localPos = this.gridToWorld(v2(x , y));
        // 绘制矩形框
        this.mapGraphics.rect(x, y, width, height);
        this.mapGraphics.fill(); // 填充
        this.mapGraphics.stroke(); // 边框

    }

    start() {
        this.mapWidth = AppConst.UIRoot.MapEditorWidth
        this.mapHeight = AppConst.UIRoot.MapEditorHeight
        this.applyExternalGridSizeIfNeeded();
        if (this.mapGameType == 0) {
            this.mapWidth = FARM_MAP_GRID_WIDTH;
            this.mapHeight = FARM_MAP_GRID_HEIGHT;
        }
        console.log("地图格子尺寸：" + this.mapWidth + ":" + this.mapHeight)

        this.mapBgTransform.contentSize = new Size(this.mapWidth * this.tileSize , this.mapHeight * this.tileSize)
        if (this.mapGameType === 0) {
            this.farmModule = new FarmMapEditorModule();
            this.farmModule.onEditorStart({
                disMapContainer: this.disMapContainer,
                mapBgNode: this.mapBgTransform?.node ?? null,
                mapPixelWidth: this.mapWidth * this.tileSize,
                mapPixelHeight: this.mapHeight * this.tileSize,
            });
        } else {
            setMapBgGrassSpriteVisible(this.mapBgTransform?.node, true);
        }

        this.init();
        
        this.initGridData();
        this.applyEntryCameraOrthoPreferred();
        this.updateSizeLabel();
        this.snapCameraToMapTopLeftOnEnter();
        MapModel.getInstance().setMapGround(MapManager.GetInstance().getGroundAssetsStr()[this.chooseGroundId], 0 , this);
        this.initMapGround();

        EventSystem.addListent("OnClickTileOhterIcon" , this.OnClickTileOhterIcon , this)
        EventSystem.addListent("OnClickFloorIcon" , this.OnClickFloorIcon , this)

    
        const matchId = MapModel.getInstance().match_id;
        if (matchId) {
            let MatchJoinEequest = new network.MatchJoinEequest();
            AppConst.WebSocketManager.send(MatchJoinEequest.toJSON(matchId))
        }
    }

    protected onDestroy(): void {
        this.disposeFarmBackgroundResources();
    }

    /**
     * 离开地图或组件销毁时调用：销毁农场分包底图节点，并恢复场景 mapBg 默认草地 Sprite。
     */
    public disposeFarmBackgroundResources(): void {
        this.farmModule?.dispose(this.mapBgTransform?.node ?? null);
        this.farmModule = null;
    }

    private parseGridSizeFromMapData(data: any): { width: number, height: number } | null {
        if (!data || typeof data !== 'object') {
            return null;
        }
        const rawWidth = data.mapWidth ?? data.gridWidth ?? data.width ?? data?.Walkable?.width;
        const rawHeight = data.mapHeight ?? data.gridHeight ?? data.height ?? data?.Walkable?.height;
        const width = Number(rawWidth);
        const height = Number(rawHeight);
        if (!Number.isFinite(width) || !Number.isFinite(height)) {
            return null;
        }
        if (width <= 0 || height <= 0) {
            return null;
        }
        return { width: Math.floor(width), height: Math.floor(height) };
    }

    private getBootMapDataForGridSize(): any | null {
        // 进入地图：优先使用服务器 map_detail 里的地图数据
        if (MapModel.getInstance().showEditMapType == 0) {
            const mapRaw = MapModel.getInstance().map_detail?.map_data;
            if (mapRaw && String(mapRaw).trim() !== '') {
                try {
                    return JSON.parse(mapRaw);
                } catch (e) {
                    console.warn('[MapEditor] parse map_detail.map_data failed', e);
                }
            }
            return null;
        }

        // 编辑器测试模式：优先本地 MapData
        if (this.map_data_test) {
            const localRaw = sys.localStorage.getItem("MapData");
            if (localRaw && localRaw.trim() !== "") {
                try {
                    return JSON.parse(localRaw);
                } catch (e) {
                    console.warn('[MapEditor] parse local MapData failed', e);
                }
            }
        }

        // Web 编辑模式：使用外部注入 mapEditData
        if (AppConst.SDKManager.isEditMapingWeb && MapModel.getInstance().mapEditData) {
            try {
                return JSON.parse(MapModel.getInstance().mapEditData);
            } catch (e) {
                console.warn('[MapEditor] parse mapEditData failed', e);
            }
        }

        return null;
    }

    private applyExternalGridSizeIfNeeded() {
        const data = this.getBootMapDataForGridSize();
        const size = this.parseGridSizeFromMapData(data);
        if (!size) {
            return;
        }
        this.mapWidth = size.width;
        this.mapHeight = size.height;
    }

    smoothTime: number = 0.35;
    targetPos: Vec3 = new Vec3(0, 0, 0);

    protected update(dt: number): void {
        // 平滑移动相机到目标位置
        if (!Vec3.equals(this.mainCamera.node.getPosition(), this.targetPos)) {
            const moveStep = 1 - Math.exp(-dt / this.smoothTime);
            let m = new Vec3(0, 0, 0);
            Vec3.lerp(m, this.mainCamera.node.getPosition(), this.targetPos, moveStep);
            this.mainCamera.node.setPosition(m);
        }

    }

    private init() {
        MapManager.GetInstance().setMapEditor(this);

        this.maskSp = this.tileMaskNode.getChildByName('di').getComponent(Sprite);
        this.buildIcon = this.tileMaskNode.getChildByName('icon');

        this.buildControl.move = this.tileMaskNode.getChildByName("move").getComponent(Animation);
        this.buildControl.detele = this.tileMaskNode.getChildByName("detele").getComponent(Animation);
        this.buildControl.frame = this.tileMaskNode.getChildByName("frame").getComponent(UITransform);
        this.buildControl.npc_banner1 = this.tileMaskNode.getChildByName("npc_banner1");
        this.buildControl.sign = {
            up: this.tileMaskNode.getChildByName("arrows_up"),
            down: this.tileMaskNode.getChildByName("arrows_down"),
            left: this.tileMaskNode.getChildByName("arrows_left"),
            right: this.tileMaskNode.getChildByName("arrows_right")
        }

        this.buildControl.move.node.active = false;
        this.buildControl.detele.node.active = false;
        this.buildControl.npc_banner1.active = false;
        this.tileMaskNode.active = false;
        this.targetPos = this.mainCamera.node.getPosition();

        this.setArrowSignActive(false);
    }

    private initGridData() {
        // 初始化网格数据，0表示空，1表示已占用
        for (let x = 0; x < this.mapWidth; x++) {
            this.mapData[x] = [];
            for (let y = 0; y < this.mapHeight; y++) {
                this.mapData[x][y] = 0;
            }
        }
    }

    buildMap(gridPos: Vec2) {
        if(gridPos.x <= 0 || gridPos.y <= 0){
            return
        }
        const manager = MapManager.GetInstance();
        log(manager.actionStatus)
        switch (manager.actionStatus) {
            case ActionStatus.MOVE:
                this.moveTile(gridPos);
                break;
            case ActionStatus.DETELE:
                this.deteleTile(gridPos);
                break;
            case ActionStatus.GROUND:
                this.buildGround(gridPos);
                break;
            case ActionStatus.WALL:
                
                break;
            case ActionStatus.PLANT:
                this.buildGoods(gridPos);
                break;
            case ActionStatus.FRAM:
                this.buildGoods(gridPos);
                break;
            case ActionStatus.REGION_NPC:
                // 区域 NPC 头像由 EditHead 调用 layoutRegionNpcHeadsForPending / layoutRegionNpcHeadsForRegion 同步到地图
                break;
            case ActionStatus.DECOR:
                this.buildDecor(gridPos);
                break;
            case ActionStatus.WALL_DECOR:
                if (this.isCurrentWallDacoration()) {
                    this.buildWallDacoration(gridPos);
                }
                break;
            default:
                break;
        }

        this.refreshWalkableDebugOverlayIfNeeded();
        this.sendWebMapInfoIfChanged();
    }

    /**
     * 指针在「锚点格」内的偏移（相对单格中心），再叠到 gridToWorld(建筑尺寸) 上。
     * 多格家具时不会让整张图的几何中心贴在手指上；1×1 时与「相对建筑中心」等价。逻辑占格仍只由 gridPos 决定。
     */
    private getPointerOffsetForGrid(gridPos: Vec2, _size: Size | null): Vec2 {
        if (!this.enablePlacementDragOffset) {
            return new Vec2(0, 0);
        }
        if (!this.lastPointerLocalPos) {
            return new Vec2(0, 0);
        }
        const ptr = this.lastPointerLocalPos;
        const cellCenter = MapModel.getInstance().gridToWorld(gridPos, new Size(this.tileSize, this.tileSize), this);
        return new Vec2(ptr.x - cellCenter.x, ptr.y - cellCenter.y);
    }

    /**
     * 预览遮罩：尺寸优先与 curTileNode 一致（与 placeBuilding/buildDecor 同源）。
     * 开启拖动偏移时：建筑锚点 + 相对单格中心的偏移，与 getPointerOffsetForGrid 一致。
     */
    public applyTileMaskPreviewWorldPosition(gridPos: Vec2, screenPos?: Vec2) {
        const mapUi = this.mapContainer?.getComponent(UITransform);
        if (!mapUi || !this.tileMaskNode) {
            return;
        }
        const maskUi = this.tileMaskNode.getComponent(UITransform);
        if (!maskUi) {
            return;
        }
        const previewUi = this.curTileNode?.getComponent(UITransform);
        const size = previewUi?.contentSize ?? maskUi.contentSize;

        if (this.enablePlacementDragOffset) {
            if (screenPos) {
                const w = this.mainCamera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0));
                const lp = mapUi.convertToNodeSpaceAR(new Vec3(w.x, w.y, 0));
                this.lastPointerLocalPos = new Vec2(lp.x, lp.y);
            }
            if (this.lastPointerLocalPos) {
                const off = this.getPointerOffsetForGrid(gridPos, size);
                const base = MapModel.getInstance().gridToWorld(gridPos, size, this);
                const local = new Vec3(base.x + off.x, base.y + off.y, base.z);
                this.tileMaskNode.setWorldPosition(mapUi.convertToWorldSpaceAR(local));
                return;
            }
        }

        const base = MapModel.getInstance().gridToWorld(gridPos, size, this);
        this.tileMaskNode.setWorldPosition(mapUi.convertToWorldSpaceAR(base));
    }

    /** 调试用：单格中心，不受 tileMask 当前尺寸影响（避免 gridToWorld(..., null) 随预览家具尺寸整体偏移） */
    private gridCellCenterForDebug(gridPos: Vec2): Vec3 {
        return MapModel.getInstance().gridToWorld(gridPos, new Size(this.tileSize, this.tileSize), this);
    }

    private refreshWalkableDebugOverlayIfNeeded() {
        if (!this.debugShowWalkable) {
            return;
        }
        const walkableCells = MapModel.getInstance().buildWalkableCells(this);
        this.renderWalkableDebugOverlay(walkableCells);
    }

    private formatGridRange(startX: number, startY: number, endX: number, endY: number): string {
        return `${startX},${startY}#${endX},${endY}`;
    }

    private getNodeGridSize(node: Node | null): Vec2 {
        if (!node || !node.isValid) {
            return new Vec2(1, 1);
        }
        const ui = node.getComponent(UITransform);
        if (!ui) {
            return new Vec2(1, 1);
        }
        return MapModel.getInstance().getBuildingSize(ui.contentSize, this);
    }

    private buildMapInfoPayload(): any {
        const houses: any[] = [];
        this.allHouse.forEach((house, houseName) => {
            if (!house.grid || house.grid.length === 0) {
                return;
            }
            let minX = Number.POSITIVE_INFINITY;
            let minY = Number.POSITIVE_INFINITY;
            let maxX = Number.NEGATIVE_INFINITY;
            let maxY = Number.NEGATIVE_INFINITY;
            for (let i = 0; i < house.grid.length; i++) {
                const p = house.grid[i];
                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }

            const items: string[] = [];
            house.decor.forEach((decor) => {
                let stary = decor?.tile?.name.split("#")
                let cfgName = "mapOutsideRenovation"
                let type = stary[1]
                if(type == "OutsideRenovation"){
                    cfgName = "mapOutsideRenovation"
                }
                if(type == "Floor"){
                    cfgName = "mapFloor"
                }
                if(type == "Decor" || type == "DecorOrnament" || type == "Appliance"){
                    cfgName = "mapDecor"
                }
                if(type == "WallDacoration" || type == "WallDecor"){
                    cfgName = "mapWallDecor"
                }
                let decCfg = AppConst.JSONManager.getItem(cfgName , stary[0])
                const name = decCfg["name_cn"];
                if (name) {
                    items.push(name);
                }
            });

            houses.push({
                house_id: String(houseName),
                position: this.formatGridRange(minX, minY, maxX, maxY),
                "belongs to": house.npc?.id || '',
                items
            });
        });

        const items: any[] = [];
        this.mapItems.forEach((item, key) => {
            if (!item || item.tileType === "Floor") {
                return;
            }
            const x = parseInt(key.split(',')[0]);
            const y = parseInt(key.split(',')[1]);
            const gridSize = this.getNodeGridSize(item.tile);
            let stary = item.id.split("#")
            let cfgName = "mapOutsideRenovation"
            let type = stary[1]
            if(type == "OutsideRenovation"){
                cfgName = "mapOutsideRenovation"
            }
            if(type == "Floor"){
                cfgName = "mapFloor"
            }
            if(type == "Decor" || type == "DecorOrnament" || type == "Appliance"){
                cfgName = "mapDecor"
            }
            if(type == "WallDacoration" || type == "WallDecor"){
                cfgName = "mapWallDecor"
            }
            let decCfg = AppConst.JSONManager.getItem(cfgName , stary[0])
            items.push({
                item_id: String(item.id || item.tile?.name || ''),
                name: decCfg["name_cn"],
                location: this.formatGridRange(x, y, x + gridSize.x - 1, y - (gridSize.y - 1))
            });
        });

        return {
            map_info: {
                houses,
                items,
                locations: [
                    {
                        location_id: "",
                        name: "",
                        "belongs to": ""
                    }
                ]
            }
        };
    }

    private sendWebMapInfoIfChanged() {
        if (!AppConst.SDKManager.isEditMapingWeb || MapModel.getInstance().showEditMapType !== 1) {
            return;
        }
        const payload = this.buildMapInfoPayload();
        const payloadStr = JSON.stringify(payload);
        if (payloadStr === this.lastWebMapInfoPayload) {
            return;
        }
        this.lastWebMapInfoPayload = payloadStr;

        window.parent.postMessage({
            channel: 'miniwo-map-editor',
            source: 'miniwo-cocos',
            type: 'COCOS_MAP_INFO_UPDATE',
            ...payload
        }, '*');
    }

    hideTileMask() {
        this.moveActionIndex = 0;
        this.isBuildSwitch = false;
        this.isMousePoint = false;
        this.tileMaskNode.active = false;
        if (this.curTileNode) this.curTileNode.destroy();
    }

    showMaskColor(gridPos: Vec2) {
        const manager = MapManager.GetInstance();
        if (manager.actionStatus == ActionStatus.DECOR) {
            if (this.isCurrentHouseDoorDecor()) {
                const canPlaceDoor = this.canPlaceHouseDoor(gridPos).ok;
                if (canPlaceDoor) {
                    this.maskSp.color = new Color('#00FF296A');
                    this.curGride = gridPos;
                } else if (this.curGride.x != gridPos.x || this.curGride.y != gridPos.y) {
                    this.maskSp.color = new Color('#FF00006A');
                }
                return
            }
            if (this.isCurrentWallDacoration()) {
                if (this.checkPlacementWallDacorationValidity(gridPos)) {
                    this.maskSp.color = new Color('#00FF296A');
                    this.curGride = gridPos;
                } else {
                    if (this.curGride.x != gridPos.x || this.curGride.y != gridPos.y) {
                        this.maskSp.color = new Color('#FF00006A');
                    }
                }
                return;
            }
            const floorBelong = this.getDecorPlacementFloorBelong(gridPos);
            const hoverItem = this.houseItems.get(`${gridPos.x},${gridPos.y}`);
            this.logDecorHoverDebug(gridPos, hoverItem?.belong ?? floorBelong);
            if (this.checkPlacementDecorValidity(gridPos)) {
                if (floorBelong) {
                    const islike = this.enableDecorStackPlacement || this.isCanPlaceDecor(floorBelong);
                    if (islike) {
                        this.maskSp.color = new Color('#00FF296A');
                        this.curGride = gridPos;
                    } else {
                        if (this.curGride.x != gridPos.x || this.curGride.y != gridPos.y) {
                            this.maskSp.color = new Color('#FF00006A');
                        }
                    }
                }
            } else {
                if (this.curGride.x != gridPos.x || this.curGride.y != gridPos.y) {
                    this.maskSp.color = new Color('#FF00006A');
                }
            }
        } else if (manager.actionStatus == ActionStatus.WALL_DECOR) {
            if (this.isCurrentWallDacoration() && this.checkPlacementWallDacorationValidity(gridPos)) {
                this.maskSp.color = new Color('#00FF296A');
                this.curGride = gridPos;
            } else {
                if (this.curGride.x != gridPos.x || this.curGride.y != gridPos.y) {
                    this.maskSp.color = new Color('#FF00006A');
                }
            }
        } else if (manager.actionStatus == ActionStatus.MOVE) {
            if (this.moveItem) {
                if (this.moveItem.belong) {
                    const canPlaceDecor = this.isWallDacorationTileType(this.moveItem.tileType)
                        ? this.checkPlacementWallDacorationValidity(gridPos)
                        : this.checkPlacementDecorValidity(gridPos);
                    if (canPlaceDecor) {
                        this.maskSp.color = new Color('#00FF296A');
                        this.curGride = gridPos;
                    } else {
                        if (this.curGride.x != gridPos.x || this.curGride.y != gridPos.y) {
                            this.maskSp.color = new Color('#FF00006A');
                        }
                    }
                } else {
                    if (this.checkPlacementValidity(gridPos)) {
                        this.maskSp.color = new Color('#00FF296A');
                        this.curGride = gridPos;
                    } else {
                        if (this.curGride.x != gridPos.x || this.curGride.y != gridPos.y) {
                            this.maskSp.color = new Color('#FF00006A');
                        }
                    }
                }
            }
        } else if (manager.actionStatus == ActionStatus.WALL) {
            
        } else {
            if (this.checkPlacementValidity(gridPos) && this.checkPlaceTreeValidity(gridPos)) {
                this.maskSp.color = new Color('#00FF296A');
                this.curGride = gridPos;
            } else {
                if (this.curGride.x != gridPos.x || this.curGride.y != gridPos.y) {
                    this.maskSp.color = new Color('#FF00006A');
                }
            }
        }
    }

    public map_id = 0

    // 初始化地图
    initMapGround() {
        for (let x = 0; x < this.mapWidth; x++) {
            for (let y = 0; y < this.mapHeight; y++) {
                this.placeholderTilemap.set(`${x},${y}`, { _type: 1, empty: true, _tileType: this.groundType , cfgId : this.chooseGroundId})
            }
        }

        // 农场(mapGameType==0)：不全图铺通用草地接缝层，否则 disMapContainer 会盖住 FarmBgLayer 分包底图；马路仍由 buildGround / MapLoadMap 按需 setDisplayTile
        if (this.mapGameType != 0) {
            for (let x = 0; x < this.mapWidth; x++) {
                for (let y = 0; y < this.mapHeight; y++) {
                    this.setDisplayTile(new Vec2(x, y), new Size(32, 32), this.groundType);
                }
            }
        }

        //进入地图，根据地图显示内容
        if(MapModel.getInstance().showEditMapType == 0){
            this.map_id = MapModel.getInstance().map_detail.id
            let data = JSON.parse(MapModel.getInstance().map_detail.map_data)
            MapLoadMap.loadMapData(data , this)
            return
        }

        //编辑器进入，如果有编辑数据，显示之前编辑的内容
        if (this.map_data_test) {
            const localMapData = sys.localStorage.getItem("MapData");
            if (localMapData && localMapData.trim() !== "") {
                try {
                    const data = JSON.parse(localMapData);
                    MapModel.getInstance().showEditMapType = 1;
                    MapLoadMap.loadMapData(data, this);

                    this.sendWebMapInfoIfChanged();
                    return;
                } catch (e) {
                    console.warn("[map_data_test] parse local MapData failed", e);
                }
            }
        }

        //编辑器进入，如果有编辑数据，显示之前编辑的内容
        if(AppConst.SDKManager.isEditMapingWeb && MapModel.getInstance().mapEditData != null && MapModel.getInstance().mapEditData != ""){
            MapLoadMap.loadMapData(JSON.parse(MapModel.getInstance().mapEditData) , this)
            this.sendWebMapInfoIfChanged();
        }
    }

    // 建造地板
    buildGround(gridPos: Vec2) {
        if (this.placeholderTilemap.get(`${gridPos.x},${gridPos.y}`).empty) {
            let islike = false;
            const _list = [new Vec2(0, -1), new Vec2(0, 1), new Vec2(-1, 0), new Vec2(1, 0), new Vec2(-1, -1), new Vec2(1, -1), new Vec2(-1, 1), new Vec2(1, 1)]
            for (let i = 0; i < _list.length; i++) {
                const element = _list[i];
                const pos = new Vec2(gridPos.x + element.x, gridPos.y + element.y);
                if (this.placeholderTilemap.get(`${pos.x},${pos.y}`)._tileType != this.groundType) {
                    islike = true;
                    break;
                }
            }

            if (!islike) {
                this.placeholderTilemap.set(`${gridPos.x},${gridPos.y}`, { _type: 2, empty: false, _tileType: this.groundType , cfgId : this.chooseGroundId });
                this.setDisplayTile(gridPos, new Size(this.tileSize, this.tileSize), this.groundType);

                const fillCells = computeSameTypeClosedFillCells({
                    mapWidth : this.mapWidth,
                    mapHeight : this.mapHeight,
                    placeholderTilemap : this.placeholderTilemap as any,
                    cfgId : this.chooseGroundId,
                    seed : gridPos,
                    padding : 1
                })
                // console.log(fillCells)
                if(fillCells.length > 0){
                    for(let f = 0 ; f < fillCells.length ; f++){
                        let cellGrid = fillCells[f]
                        this.placeholderTilemap.set(`${cellGrid.x},${cellGrid.y}`, { _type: 2, empty: false, _tileType: this.groundType , cfgId : this.chooseGroundId });
                        this.setDisplayTile(cellGrid, new Size(this.tileSize, this.tileSize), this.groundType);
                    }
                }
            }
        }
    }


    // 建造草地
    setDisplayTile(pos: Vec2, _size: Size, _tag: number) {
        for (let i = 0; i < this.NEIGHBOURS.length; i++) {
            const newPos = new Vec2(pos.x + this.NEIGHBOURS[i].x, pos.y + this.NEIGHBOURS[i].y);
            let localPos = MapModel.getInstance().gridToWorld(newPos , null, this);

            //url cfgId
            const tileData = this.calculateDisplayTile(newPos)
            if(tileData["url"] == "ground/texture2d/dirty_road/dirty_road_7/spriteFrame"){
                return
            }
            // 创建新的图块
            const tile = new Node;
            tile.layer = 1 << 0;
            let sprite = tile.addComponent(Sprite);
            tile.setPosition(localPos);
            this.disMapContainer.addChild(tile);

            
            tile.getComponent(Sprite).node.getComponent(UITransform).contentSize = _size;

            let displayTitle = tile.addComponent("DisplayTitle") as DisplayTitle;
            displayTitle.sp = sprite
            displayTitle.spframeName = tileData["url"]
            // console.log(tileData["url"])
            
            displayTitle.gridKey = `${newPos.x},${newPos.y}`
            displayTitle.poolNodeSize = _size
            displayTitle.camera = MapManager.GetInstance().getMapEditor().mainCamera

            this.displayTilemap.set(`${newPos.x},${newPos.y}`, { tileNode: tile, _type: _tag , cfgId : tileData["cfgId"]})
        }
    }

    private ensureWalkableDebugLayer() {
        if (this.walkableDebugNode && this.walkableDebugNode.isValid && this.walkableDebugGraphics) {
            return;
        }
        this.walkableDebugNode = new Node('walkableDebugLayer');
        this.walkableDebugNode.layer = 1 << 0;
        this.walkableDebugGraphics = this.walkableDebugNode.addComponent(Graphics);
        const hostParent = this.mapContainer?.parent ?? this.disMapContainer?.parent ?? this.node;
        hostParent.addChild(this.walkableDebugNode);

        // 与逻辑格子（mapContainer）保持同一局部坐标系，避免半格偏移
        if (this.mapContainer) {
            this.walkableDebugNode.setPosition(this.mapContainer.position);
            const srcUIT = this.mapContainer.getComponent(UITransform);
            if (srcUIT) {
                const dstUIT = this.walkableDebugNode.addComponent(UITransform);
                dstUIT.setContentSize(srcUIT.contentSize);
                dstUIT.setAnchorPoint(srcUIT.anchorPoint);
            }
        }

        // 保证在父节点最上层，压过建筑层
        this.walkableDebugNode.setSiblingIndex(hostParent.children.length - 1);
    }

    public clearWalkableDebugOverlay() {
        if (this.walkableDebugGraphics) {
            this.walkableDebugGraphics.clear();
        }
    }

    public renderWalkableDebugOverlay(cells: string[] | undefined) {
        if (!this.debugShowWalkable) {
            this.clearWalkableDebugOverlay();
            return;
        }
        this.ensureWalkableDebugLayer();
        if (this.mapContainer && this.walkableDebugNode?.isValid) {
            this.walkableDebugNode.setPosition(this.mapContainer.position);
        }
        if (!this.walkableDebugGraphics) return;

        const g = this.walkableDebugGraphics;
        g.clear();

        const walkableSet = new Set<string>();
        if (cells) {
            for (let i = 0; i < cells.length; i++) {
                const key = cells[i];
                if (typeof key === 'string') {
                    walkableSet.add(key);
                }
            }
        }

        const half = this.tileSize * 0.5;
        const gridTmp = new Vec2();
        const maxBatch = MapEditor.WALKABLE_DEBUG_MAX_RECTS_PER_FILL;

        const appendRect = (x: number, y: number) => {
            gridTmp.set(x, y);
            const center = this.gridCellCenterForDebug(gridTmp);
            g.rect(center.x - half, center.y - half, this.tileSize, this.tileSize);
        };

        const red = new Color(255, 0, 0, 110);
        const green = new Color(0, 255, 0, 120);

        // 不可走：仅铺非 Walkable 格（避免整张图重复矩形 + 单次超大 fill）
        g.fillColor = red;
        let batch = 0;
        for (let x = 0; x < this.mapWidth; x++) {
            for (let y = 0; y < this.mapHeight; y++) {
                if (walkableSet.has(`${x},${y}`)) {
                    continue;
                }
                appendRect(x, y);
                batch++;
                if (batch >= maxBatch) {
                    g.fill();
                    g.fillColor = red;
                    batch = 0;
                }
            }
        }
        if (batch > 0) {
            g.fill();
        }

        // 可走：只遍历 Walkable 集合，分批铺绿
        g.fillColor = green;
        batch = 0;
        walkableSet.forEach((key) => {
            const parts = key.split(',');
            if (parts.length < 2) {
                return;
            }
            const x = Number(parts[0]);
            const y = Number(parts[1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return;
            }
            if (x < 0 || y < 0 || x >= this.mapWidth || y >= this.mapHeight) {
                return;
            }
            appendRect(x, y);
            batch++;
            if (batch >= maxBatch) {
                g.fill();
                g.fillColor = green;
                batch = 0;
            }
        });
        if (batch > 0) {
            g.fill();
        }
    }

    private ensureNpcTileDebugLayer() {
        if (this.npcTileDebugNode && this.npcTileDebugNode.isValid && this.npcTileDebugGraphics) {
            return;
        }
        this.npcTileDebugNode = new Node('npcTileDebugLayer');
        this.npcTileDebugNode.layer = 1 << 0;
        this.npcTileDebugGraphics = this.npcTileDebugNode.addComponent(Graphics);
        const hostParent = this.mapContainer?.parent ?? this.disMapContainer?.parent ?? this.node;
        hostParent.addChild(this.npcTileDebugNode);

        // 与逻辑格子（mapContainer）保持同一局部坐标系，避免半格偏移
        if (this.mapContainer) {
            this.npcTileDebugNode.setPosition(this.mapContainer.position);
            const srcUIT = this.mapContainer.getComponent(UITransform);
            if (srcUIT) {
                const dstUIT = this.npcTileDebugNode.addComponent(UITransform);
                dstUIT.setContentSize(srcUIT.contentSize);
                dstUIT.setAnchorPoint(srcUIT.anchorPoint);
            }
        }

        // 保证在父节点最上层，压过建筑层
        this.npcTileDebugNode.setSiblingIndex(hostParent.children.length - 1);
    }

    public clearNpcTileDebugOverlay() {
        if (this.npcTileDebugGraphics) {
            this.npcTileDebugGraphics.clear();
        }
    }

    public renderNpcTileDebugOverlay(npcs: NpcDebugTileData[] | undefined) {
        if (!this.debugShowWalkable) {
            this.clearNpcTileDebugOverlay();
            return;
        }
        this.ensureNpcTileDebugLayer();
        if (this.mapContainer && this.npcTileDebugNode?.isValid) {
            this.npcTileDebugNode.setPosition(this.mapContainer.position);
        }
        if (!this.npcTileDebugGraphics) return;

        this.npcTileDebugGraphics.clear();
        if (!npcs || npcs.length === 0) {
            return;
        }

        const drawKeys = new Set<string>();
        this.npcTileDebugGraphics.fillColor = new Color(255, 255, 0, 140);
        for (let i = 0; i < npcs.length; i++) {
            const npc = npcs[i];
            const coords = [
                [Number(npc?.tile_x), Number(npc?.tile_y)],
                [Number(npc?.target_tile_x), Number(npc?.target_tile_y)],
            ];
            for (let c = 0; c < coords.length; c++) {
                const x = coords[c][0];
                const y = coords[c][1];
                if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
                if (x < 0 || y < 0 || x >= this.mapWidth || y >= this.mapHeight) continue;
                const key = `${x},${y}`;
                if (drawKeys.has(key)) continue;
                drawKeys.add(key);

                const center = this.gridCellCenterForDebug(new Vec2(x, y));
                const half = this.tileSize * 0.5;
                this.npcTileDebugGraphics.rect(center.x - half, center.y - half, this.tileSize, this.tileSize);
            }
        }
        this.npcTileDebugGraphics.fill();
    }

    /** 落地家具所属房间：锚点格为地板时直接取 belong；堆叠模式下占区任一格压在带 belong 的地板上即可 */
    private getDecorPlacementFloorBelong(gridPos: Vec2): string | null {
        const ui = this.curTileNode?.getComponent(UITransform) ?? this.tileMaskNode?.getComponent(UITransform);
        if (!ui) {
            return null;
        }
        const buildingSize = MapModel.getInstance().getBuildingSize(ui.contentSize, this);
        const atAnchor = this.houseItems.get(`${gridPos.x},${gridPos.y}`);
        if (atAnchor && atAnchor.tileType === "Floor" && atAnchor.belong) {
            return atAnchor.belong;
        }
        if (!this.enableDecorStackPlacement) {
            return null;
        }
        for (let x = 0; x < buildingSize.x; x++) {
            for (let y = 0; y < buildingSize.y; y++) {
                const cx = gridPos.x + x;
                const cy = gridPos.y - y;
                const it = this.houseItems.get(`${cx},${cy}`);
                if (it && it.tileType === "Floor" && it.belong) {
                    return it.belong;
                }
            }
        }
        return null;
    }

    // 构建家具
    buildDecor(gridPos: Vec2) {
        if (this.isCurrentHouseDoorDecor()) {
            this.buildWallDacoration(gridPos);
            return;
        }
        if (this.isCurrentWallDacoration()) {
            this.buildWallDacoration(gridPos);
            return;
        }

        const floorBelong = this.getDecorPlacementFloorBelong(gridPos);
        if (!floorBelong) {
            return;
        }

        if (this.checkPlacementDecorValidity(gridPos) && (this.enableDecorStackPlacement || this.isCanPlaceDecor(floorBelong))) {
            const manager = MapManager.GetInstance();
            const tile = MapManager.GetInstance().getMapCurTileNode(this.curTileNode.name , this.curTileNode["tileType"]);
            tile.name = this.curTileNode.name + "#" + this.curTileNode["tileType"]
            const UIT = tile.getComponent(UITransform)
            const size = UIT.contentSize
            const buildingSize = MapModel.getInstance().getBuildingSize(size , this);

            // 放置建筑
            const worldPos = MapModel.getInstance().gridToWorld(gridPos , size , this);
            const offset = this.getPointerOffsetForGrid(gridPos, size);
            tile.setPosition(worldPos.x + offset.x, worldPos.y + offset.y, worldPos.z);
            const previewScaleX = this.curTileNode?.getScale()?.x ?? 1;
            const flipX = previewScaleX < 0 ? -1 : 1;
            const tileScale = tile.getScale();
            tile.setScale(flipX, tileScale.y, tileScale.z);
            this.mapContainer.addChild(tile);

            const house = this.allHouse.get(floorBelong);
            if (!this.enableDecorStackPlacement && this.hasSameDecorAtGrid(house, gridPos, tile.name)) {
                tile.destroy();
                return;
            }
            house.decor.set(this.buildDecorStackKey(gridPos, tile.name), {
                tile: tile,
                tileType: "Decor",
                width: size.width,
                height: size.height,
                belong: floorBelong,
                position: `${gridPos.x},${gridPos.y}`,
                flipX,
                offsetX: offset.x,
                offsetY: offset.y
            });

            // 更新网格数据
            this.markDecorFootprintMapData(gridPos, buildingSize);

            // 检查按钮的显隐
            manager.getMapEditorUI().checkButtonVisible();
        }
    }

    private isCurrentWallDacoration(): boolean {
        return this.isWallDacorationTileType(this.curTileNode?.["tileType"] || "");
    }

    private isWallDacorationTileType(tileType: string): boolean {
        return tileType === "WallDacoration" || tileType === "WallDecor";
    }

    private isCurrentHouseDoorDecor(): boolean {
        const cfgId = this.curTileNode?.name || '';
        if (!cfgId) {
            return false;
        }
        const mapDecor = AppConst.JSONManager.getItem("mapDecor", cfgId);
        return String(mapDecor?.decor_type ?? '') === '6';
    }

    private resolveHouseDoorPlacementTarget(gridPos: Vec2, buildingSize: Vec2): { houseName: string, doorPos: Vec2 } | null {
        const hitHouse = new Set<string>();
        let targetDoorPos: Vec2 = null;
        for (let x = 0; x < buildingSize.x; x++) {
            for (let y = 0; y < buildingSize.y; y++) {
                const checkX = gridPos.x + x;
                const checkY = gridPos.y - y;
                const wallItem = this.houseItems.get(`${checkX},${checkY}`) as any;
                if (!wallItem || wallItem.tileType !== "OutWall" || wallItem.dir !== "down" || !wallItem.belong) {
                    continue;
                }
                hitHouse.add(wallItem.belong);
                if (!targetDoorPos) {
                    targetDoorPos = new Vec2(checkX, checkY);
                }
            }
        }
        if (hitHouse.size !== 1 || !targetDoorPos) {
            return null;
        }
        return { houseName: Array.from(hitHouse)[0], doorPos: targetDoorPos };
    }

    private canPlaceHouseDoor(gridPos: Vec2): { ok: boolean, houseName?: string, doorPos?: Vec2 } {
        const buildingSize = MapModel.getInstance().getBuildingSize(this.tileMaskNode.getComponent(UITransform).contentSize, this);
        const target = this.resolveHouseDoorPlacementTarget(gridPos, buildingSize);
        if (!target) {
            return { ok: false };
        }
        const house = this.allHouse.get(target.houseName);
        if (!house) {
            return { ok: false };
        }

        // 一个房子只允许一个门洞
        if (house.openWall.some((pt) => pt.x !== target.doorPos.x || pt.y !== target.doorPos.y)) {
            return { ok: false };
        }

        const pack: Vec2[] = [];
        for (let x = 0; x < buildingSize.x; x++) {
            for (let y = 0; y < buildingSize.y; y++) {
                pack.push(new Vec2(gridPos.x + x, gridPos.y - y));
            }
        }
        if (this.collectDecorCollisions(pack, this.moveItem?.decorKey || '').length > 0) {
            return { ok: false };
        }
        return { ok: true, houseName: target.houseName, doorPos: target.doorPos };
    }

    private applyHouseDoorOpening(houseName: string, doorPos: Vec2) {
        const house = this.allHouse.get(houseName);
        if (!house) {
            return;
        }
        const key = `${doorPos.x},${doorPos.y}`;
        const localWall = house.base.get(key) as any;
        const globalWall = this.houseItems.get(key) as any;
        const wallTile = (globalWall?.tile || localWall?.tile) as Node | null;
        if (wallTile) {
            const buildingSize = MapModel.getInstance().getBuildingSize(wallTile.getComponent(UITransform).contentSize, this);
            for (let x = 0; x < buildingSize.x; x++) {
                for (let y = 0; y < buildingSize.y; y++) {
                    const gridX = doorPos.x + x;
                    const gridY = doorPos.y - y;
                    if (y > 0) {
                        this.mapData[gridX][gridY] = 1;
                    } else {
                        this.mapData[gridX][gridY] = 0;
                    }
                }
            }
            wallTile.destroy();
        }
        if (localWall) {
            localWall.tile = null;
        }
        if (globalWall) {
            globalWall.tile = null;
        }
        this.reinforceDoorFloor(doorPos, 'down');

        if (!house.openWall.some((pt) => pt.x === doorPos.x && pt.y === doorPos.y)) {
            house.openWall.push(new Vec2(doorPos.x, doorPos.y));
        }
        if (!house.openWallDoorDecorIdMap) {
            house.openWallDoorDecorIdMap = new Map<string, string>();
        }
        if (this.curTileNode?.name) {
            house.openWallDoorDecorIdMap.set(`${doorPos.x},${doorPos.y}`, this.curTileNode.name);
        }
        // 编辑安装时，门节点视觉向下补半格，避免当前编辑态显示偏上
        this.placeDoorForHouse(houseName, doorPos, 'down', this.curTileNode?.name || '', -this.tileSize * 0.5);
    }

    private getWallDacorationBelongByArea(gridPos: Vec2, buildingSize: Vec2): string | null {
        // const neighborOffsets = [
        //     new Vec2(0, 0),
        //     new Vec2(0, 1),
        //     new Vec2(0, -1),
        //     new Vec2(-1, 0),
        //     new Vec2(1, 0),
        //     new Vec2(-1, 1),
        //     new Vec2(1, 1),
        //     new Vec2(-1, -1),
        //     new Vec2(1, -1),
        // ];
        const neighborOffsets: Vec2[] = [];
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                neighborOffsets.push(new Vec2(dx, dy));
            }
        }

        const belongs = new Set<string>();
        for (let x = 0; x < buildingSize.x; x++) {
            for (let y = 0; y < buildingSize.y; y++) {
                const checkX = gridPos.x + x;
                const checkY = gridPos.y - y;
                for (let i = 0; i < neighborOffsets.length; i++) {
                    const nx = checkX + neighborOffsets[i].x;
                    const ny = checkY + neighborOffsets[i].y;
                    if (nx < 0 || ny < 0 || nx >= this.mapWidth || ny >= this.mapHeight) {
                        continue;
                    }
                    const item = this.houseItems.get(`${nx},${ny}`);
                    if (item && item.belong) {
                        belongs.add(item.belong);
                    }
                }
            }
        }

        if (belongs.size === 1) {
            return Array.from(belongs)[0];
        }
        return null;
    }

    private checkPlacementWallDacorationValidity(gridPos: Vec2): boolean {
        if (gridPos.x < 0 || gridPos.y < 0) return false;
        const buildingSize = MapModel.getInstance().getBuildingSize(this.tileMaskNode.getComponent(UITransform).contentSize, this);
        if (gridPos.x + buildingSize.x > this.mapWidth || gridPos.y - (buildingSize.y - 1) < 0) {
            return false;
        }

        if (this.isCurrentHouseDoorDecor()) {
            return this.canPlaceHouseDoor(gridPos).ok;
        }

        const pack: Vec2[] = [];
        let hasWallCell = false;
        for (let x = 0; x < buildingSize.x; x++) {
            for (let y = 0; y < buildingSize.y; y++) {
                const checkX = gridPos.x + x;
                const checkY = gridPos.y - y;
                const cell = this.mapData[checkX][checkY];
                if (cell === 2) {
                    const wallItem = this.houseItems.get(`${checkX},${checkY}`);
                    const wallDir = wallItem ? (wallItem as any).dir : '';
                    if (!(wallItem?.tileType === "OutWall" && (wallDir === "left" || wallDir === "right"))) {
                        hasWallCell = true;
                    }
                }
                pack.push(new Vec2(checkX, checkY));
            }
        }
        if (!hasWallCell) {
            return false;
        }
        
        if (this.collectDecorCollisions(pack, this.moveItem?.decorKey || '').length > 0) {
            return false;
        }

        return this.getWallDacorationBelongByArea(gridPos, buildingSize) !== null;
    }

    private buildWallDacoration(gridPos: Vec2) {
        if (this.isCurrentHouseDoorDecor()) {
            const doorCheck = this.canPlaceHouseDoor(gridPos);
            if (!doorCheck.ok || !doorCheck.houseName || !doorCheck.doorPos) {
                return;
            }
            this.applyHouseDoorOpening(doorCheck.houseName, doorCheck.doorPos);
            MapManager.GetInstance().getMapEditorUI().checkButtonVisible();
            return;
        }

        if (!this.checkPlacementWallDacorationValidity(gridPos)) {
            return;
        }
        const uiTrans = this.curTileNode?.getComponent(UITransform);
        if (!uiTrans) {
            return;
        }
        const buildingSize = MapModel.getInstance().getBuildingSize(uiTrans.contentSize, this);
        const belong = this.getWallDacorationBelongByArea(gridPos, buildingSize);
        if (!belong) {
            return;
        }

        const tile = MapManager.GetInstance().getMapCurTileNode(this.curTileNode.name, this.curTileNode["tileType"]);
        tile.name = this.curTileNode.name + "#" + this.curTileNode["tileType"];
        const size = tile.getComponent(UITransform).contentSize;
        const worldPos = MapModel.getInstance().gridToWorld(gridPos, size, this);
        const offset = this.getPointerOffsetForGrid(gridPos, size);
        tile.setPosition(worldPos.x + offset.x, worldPos.y + offset.y, worldPos.z);
        const previewScaleX = this.curTileNode?.getScale()?.x ?? 1;
        const flipX = previewScaleX < 0 ? -1 : 1;
        const tileScale = tile.getScale();
        tile.setScale(flipX, tileScale.y, tileScale.z);
        this.mapContainer.addChild(tile);

        const house = this.allHouse.get(belong);
        house.decor.set(this.buildDecorStackKey(gridPos, tile.name), {
            tile: tile,
            tileType: "WallDacoration",
            width: size.width,
            height: size.height,
            belong: belong,
            position: `${gridPos.x},${gridPos.y}`,
            flipX,
            offsetX: offset.x,
            offsetY: offset.y
        });

        MapManager.GetInstance().getMapEditorUI().checkButtonVisible();
    }

    // 是否能放家具
    isCanPlaceDecor(belong: string): boolean {
        let islike = true;
        const house = this.allHouse.get(belong);
        house.decor.forEach((pt) => {
            if (pt.tile.name == this.curTileNode.name) {
                islike = false;
                return;
            }
        })

        return islike;
    }

    // 建造物品
    buildGoods(gridPos: Vec2) {
        // 检查放置是否有效
        if (this.checkPlacementValidity(gridPos) && this.checkPlaceTreeValidity(gridPos)) {
            this.placeBuilding(gridPos);
        }
    }

    // 标识当前要移动的物品
    signMoveTile(gridPos: Vec2) {
        const manager = MapManager.GetInstance();
        if (manager.actionStatus == ActionStatus.MOVE) {
            if (sys.isMobile) {
                if (this.moveItem) {
                    return;
                }
            }

            let size = null;
            if (this.mapItems.has(`${gridPos.x},${gridPos.y}`)) {
                const item = this.mapItems.get(`${gridPos.x},${gridPos.y}`);
                const ptr = this.lastPointerLocalPos;
                const tilePos = item.tile?.getPosition?.() ?? new Vec3();
                const grabOffsetX = this.enablePlacementDragOffset && ptr ? (ptr.x - tilePos.x) : 0;
                const grabOffsetY = this.enablePlacementDragOffset && ptr ? (ptr.y - tilePos.y) : 0;
                this.moveItem = {
                    id: item.id,
                    tile: item.tile,
                    tileType: item.tileType,
                    initGride: gridPos,
                    offsetX: (item as any).offsetX ?? 0,
                    offsetY: (item as any).offsetY ?? 0,
                    initOffsetX: (item as any).offsetX ?? 0,
                    initOffsetY: (item as any).offsetY ?? 0,
                    grabOffsetX,
                    grabOffsetY
                };
                console.log(`[MOVE_SELECT] id=${this.moveItem.id}, name=${this.moveItem.tile?.name}, type=${this.moveItem.tileType}, grid=${gridPos.x},${gridPos.y}`);
                size = this.moveItem.tile.getComponent(UITransform).contentSize;
                this.setArrowSignActive(true);
                this.updateArrowSign(size);
                this.maskSp.color = new Color('#00FF296A');
                this.curGride = gridPos;
                this.moveActionIndex = 1;
            } else if (this.houseItems.has(`${gridPos.x},${gridPos.y}`)) {
                const item = this.houseItems.get(`${gridPos.x},${gridPos.y}`);
                if (item.belong) {
                    const house = this.allHouse.get(item.belong);
                    const topDecor = this.getTopDecorAtGrid(house, gridPos);
                    if (topDecor) {
                        const item = topDecor.value;
                        const ptr = this.lastPointerLocalPos;
                        const tilePos = item.tile?.getPosition?.() ?? new Vec3();
                        const grabOffsetX = this.enablePlacementDragOffset && ptr ? (ptr.x - tilePos.x) : 0;
                        const grabOffsetY = this.enablePlacementDragOffset && ptr ? (ptr.y - tilePos.y) : 0;
                        this.moveItem = {
                            id: item.tile.name,
                            tile: item.tile,
                            tileType: item.tileType,
                            initGride: gridPos,
                            belong: item.belong,
                            decorKey: topDecor.key,
                            offsetX: (item as any).offsetX ?? 0,
                            offsetY: (item as any).offsetY ?? 0,
                            initOffsetX: (item as any).offsetX ?? 0,
                            initOffsetY: (item as any).offsetY ?? 0,
                            grabOffsetX,
                            grabOffsetY
                        };
                        console.log(`[MOVE_SELECT] id=${this.moveItem.id}, name=${this.moveItem.tile?.name}, type=${this.moveItem.tileType}, grid=${gridPos.x},${gridPos.y}`);
                        size = this.moveItem.tile.getComponent(UITransform).contentSize;
                        this.setArrowSignActive(true);
                        this.updateArrowSign(size);
                        this.maskSp.color = new Color('#00FF296A');
                        this.curGride = gridPos;
                        this.moveActionIndex = 1;
                    } else {
                        size = new Size(this.tileSize, this.tileSize);
                        this.moveItem = null;
                        this.setArrowSignActive(false);
                    }
                } else {
                    if (item.tile)
                        size = item.tile.getComponent(UITransform).contentSize;
                    else
                        size = new Size(this.tileSize, this.tileSize);

                    this.moveActionIndex = 0;
                    this.moveItem = null;
                    this.setArrowSignActive(false);
                }
            } else {
                this.moveActionIndex = 0;
                size = new Size(this.tileSize, this.tileSize);
                this.moveItem = null;
                this.setArrowSignActive(false);
            }

            this.buildIcon.getComponent(UITransform).setContentSize(size);
            this.maskSp.getComponent(UITransform).setContentSize(size);
            this.tileMaskNode.getComponent(UITransform).setContentSize(size);
            this.buildControl.frame.setContentSize(size.width + 10, size.height + 10);
        }
    }

    private resolveDeleteTarget(gridPos: Vec2): { tile: Node | null, tileType: string, belong?: string, decorKey?: string, doorPos?: Vec2, doorDir?: string, anchorPos?: Vec2 } | null {
        const key = `${gridPos.x},${gridPos.y}`;
        const houseCell = this.houseItems.get(key);
        if (houseCell?.belong) {
            const doorTarget = this.getHouseDoorDeleteTarget(gridPos, houseCell.belong);
            if (doorTarget) {
                return doorTarget;
            }

            const topDecorAny = this.getTopDecorCoveringGridGlobal(gridPos);
            if (topDecorAny && (topDecorAny.value.tileType === "Decor" || this.isWallDacorationTileType(topDecorAny.value.tileType))) {
                return {
                    tile: topDecorAny.value.tile || null,
                    tileType: topDecorAny.value.tileType,
                    belong: topDecorAny.belong,
                    decorKey: topDecorAny.key
                };
            }
            return { tile: null, tileType: "House", belong: houseCell.belong };
        }

        const topDecorAny = this.getTopDecorCoveringGridGlobal(gridPos);
        if (topDecorAny && (topDecorAny.value.tileType === "Decor" || this.isWallDacorationTileType(topDecorAny.value.tileType))) {
            return {
                tile: topDecorAny.value.tile || null,
                tileType: topDecorAny.value.tileType,
                belong: topDecorAny.belong,
                decorKey: topDecorAny.key
            };
        }

        const mapItem = this.mapItems.get(key);
        if (mapItem) {
            return { tile: mapItem.tile || null, tileType: mapItem.tileType, anchorPos: new Vec2(gridPos.x, gridPos.y) };
        }

        // 大尺寸非房屋道具：支持点击占地区域任意格子命中删除（不仅限锚点格）
        for (const [itemKey, item] of this.mapItems.entries()) {
            if (!item) {
                continue;
            }
            const split = itemKey.split(',');
            if (split.length !== 2) {
                continue;
            }
            const anchorX = parseInt(split[0], 10);
            const anchorY = parseInt(split[1], 10);
            if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) {
                continue;
            }
            const gridSize = this.getNodeGridSize(item.tile);
            const inX = gridPos.x >= anchorX && gridPos.x <= anchorX + gridSize.x - 1;
            const inY = gridPos.y <= anchorY && gridPos.y >= anchorY - (gridSize.y - 1);
            if (!inX || !inY) {
                continue;
            }
            return {
                tile: item.tile || null,
                tileType: item.tileType,
                anchorPos: new Vec2(anchorX, anchorY)
            };
        }

        return null;
    }

    private getHouseDoorDeleteTarget(gridPos: Vec2, preferHouseName: string = ''): { tile: Node | null, tileType: string, belong?: string, doorPos?: Vec2, doorDir?: string } | null {
        const key = `${gridPos.x},${gridPos.y}`;
        const houseNames = preferHouseName ? [preferHouseName] : Array.from(this.allHouse.keys());
        for (let i = 0; i < houseNames.length; i++) {
            const houseName = houseNames[i];
            const house = this.allHouse.get(houseName);
            if (!house) {
                continue;
            }
            const opened = house.openWall.some((pt) => pt.x === gridPos.x && pt.y === gridPos.y);
            if (!opened) {
                continue;
            }

            const baseWall = house.base.get(key) as any;
            const doorDir = baseWall?.dir || 'down';
            const sideDoor = this.homeWallTilemap.getChildByName(this.getHouseDoorNodeName(houseName, gridPos, 'cebianDoor1'));
            const bottomDoor = this.homeWallTilemap.getChildByName(this.getHouseDoorNodeName(houseName, gridPos, 'door1'));
            return {
                tile: sideDoor || bottomDoor || null,
                tileType: "HouseDoor",
                belong: houseName,
                doorPos: new Vec2(gridPos.x, gridPos.y),
                doorDir: doorDir
            };
        }
        return null;
    }

    // 标识当前要删除的物品（优先单拆：房门、家具、墙饰；否则拆整屋）
    signDeteleTile(gridPos: Vec2) {
        const manager = MapManager.GetInstance();
        if (manager.actionStatus == ActionStatus.DETELE) {
            const hitRegion = this.getMapRegionByGrid(gridPos);
            if (hitRegion) {
                this.deteleItem = null;
                const size = new Size(
                    (hitRegion.maxX - hitRegion.minX + 1) * this.tileSize,
                    (hitRegion.maxY - hitRegion.minY + 1) * this.tileSize
                );
                const centerLocal = new Vec3(
                    (-this.tileSize * (this.mapWidth - 1) / 2) + ((hitRegion.minX + hitRegion.maxX) / 2) * this.tileSize,
                    (this.tileSize * (this.mapHeight - 1) / 2) - ((hitRegion.minY + hitRegion.maxY) / 2) * this.tileSize,
                    0
                );
                const centerWorld = this.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(centerLocal);
                this.tileMaskNode.setWorldPosition(centerWorld);
                this.buildIcon.getComponent(UITransform).setContentSize(size);
                this.maskSp.getComponent(UITransform).setContentSize(size.width + 10, size.height + 10);
                this.tileMaskNode.getComponent(UITransform).setContentSize(size);
                this.buildControl.frame.setContentSize(size.width + 15, size.height + 15);
                this.maskSp.color = new Color('#FF00006A');
                return;
            }

            const target = this.resolveDeleteTarget(gridPos);
            this.deteleItem = target;

            let size = new Size(this.tileSize, this.tileSize);
            if (target?.tileType === "House" && target?.belong) {
                const house = this.allHouse.get(target.belong);
                if (house) {
                    size = this.getHouseSize(house.grid);
                    this.tileMaskNode.setWorldPosition(MapModel.getInstance().getHouseCenterPos(house.grid, this));
                }
            } else if (target?.tile && target.tile.isValid) {
                size = target.tile.getComponent(UITransform)?.contentSize || size;
            }

            this.buildIcon.getComponent(UITransform).setContentSize(size);
            this.maskSp.getComponent(UITransform).setContentSize(size.width + 10, size.height + 10);
            this.tileMaskNode.getComponent(UITransform).setContentSize(size);
            this.buildControl.frame.setContentSize(size.width + 15, size.height + 15);
        }
    }

    private removeWholeHouse(houseId: string) {
        const house = this.allHouse.get(houseId);
        if (!house) {
            return;
        }

        if (house.floorRenderNode && house.floorRenderNode.isValid) {
            house.floorRenderNode.destroy();
            house.floorRenderNode = null;
        }
        if (house.floorPatchRenderNodes && house.floorPatchRenderNodes.length > 0) {
            for (let i = 0; i < house.floorPatchRenderNodes.length; i++) {
                const node = house.floorPatchRenderNodes[i];
                if (node && node.isValid) {
                    node.destroy();
                }
            }
            house.floorPatchRenderNodes = [];
        }

        house.base.forEach((pt, key) => {
            pt.tile && pt.tile.destroy();
            this.houseItems.delete(key);

            const pos = new Vec2(parseInt(key.split(',')[0]), parseInt(key.split(',')[1]));
            const buildingSize = MapModel.getInstance().getBuildingSize(new Size(pt.width, pt.height), this);
            for (let x = 0; x < buildingSize.x; x++) {
                for (let y = 0; y < buildingSize.y; y++) {
                    const gridX = pos.x + x;
                    const gridY = pos.y - y;
                    this.mapData[gridX][gridY] = 0;
                }
            }
        });

        house.decor.forEach((pt, key) => {
            pt.tile && pt.tile.destroy();

            const posKey = this.getDecorPositionKey(key, pt);
            const pos = new Vec2(parseInt(posKey.split(',')[0]), parseInt(posKey.split(',')[1]));
            const buildingSize = MapModel.getInstance().getBuildingSize(new Size(pt.width, pt.height), this);
            for (let x = 0; x < buildingSize.x; x++) {
                for (let y = 0; y < buildingSize.y; y++) {
                    const gridX = pos.x + x;
                    const gridY = pos.y - y;
                    this.mapData[gridX][gridY] = 0;
                }
            }
        });

        if (house.npc != null) {
            house.npc._node.destroy();
        }

        house.horWalls.forEach((pt, key) => {
            pt.tile && pt.tile.destroy();
            const pos = new Vec2(parseInt(key.split(',')[0]), parseInt(key.split(',')[1]));
            const buildingSize = MapModel.getInstance().getBuildingSize(new Size(pt.width, pt.height), this);
            for (let x = 0; x < buildingSize.x; x++) {
                for (let y = 0; y < buildingSize.y; y++) {
                    const gridX = pos.x + x;
                    const gridY = pos.y - y;
                    this.mapData[gridX][gridY] = 0;
                }
            }
        });

        house.verWalls.forEach((pt) => {
            pt.tile && pt.tile.destroy();
        });
        this.clearHouseDoors(houseId);
        this.allHouse.delete(houseId);
    }

    // 根据房子占地面积算出尺寸
    getHouseSize(grids: Vec2[]): Size {
        let topLeft = grids[0];
        let topRight = grids[0];
        let bottomLeft = grids[0];
        let bottomRight = grids[0];

        for (const point of grids) {
            // 左上角：x最小且y最小的点
            if (point.x < topLeft.x || (point.x === topLeft.x && point.y < topLeft.y)) {
                topLeft = point;
            }

            // 右上角：x最大且y最小的点
            if (point.x > topRight.x || (point.x === topRight.x && point.y < topRight.y)) {
                topRight = point;
            }

            // 左下角：x最小且y最小的点
            if (point.x < bottomLeft.x || (point.x === bottomLeft.x && point.y > bottomLeft.y)) {
                bottomLeft = point;
            }

            // 右下角：x最大且y最小的点
            if (point.x > bottomRight.x || (point.x === bottomRight.x && point.y > bottomRight.y)) {
                bottomRight = point;
            }
        }

        return new Size((bottomRight.x - bottomLeft.x + 1) * this.tileSize, (bottomRight.y - topRight.y + 2) * this.tileSize);
    }

    // 更新移动箭头的位置
    updateArrowSign(size: Size) {
        for (let i = 0; i < 4; i++) {
            if (i == 0) {
                this.buildControl.sign.up.setPosition(0, size.height / 2 + 15);
            } else if (i == 1) {
                this.buildControl.sign.down.setPosition(0, -(size.height / 2 + 15));
            } else if (i == 2) {
                this.buildControl.sign.left.setPosition(-(size.width / 2 + 15), 0);
            } else if (i == 3) {
                this.buildControl.sign.right.setPosition(size.width / 2 + 15, 0);
            }
        }
    }

    // 设置移动箭头的显隐
    setArrowSignActive(ist: boolean) {
        for (let i = 0; i < 4; i++) {
            if (i == 0) {
                this.buildControl.sign.up.active = ist;
            } else if (i == 1) {
                this.buildControl.sign.down.active = ist;
            } else if (i == 2) {
                this.buildControl.sign.left.active = ist;
            } else if (i == 3) {
                this.buildControl.sign.right.active = ist;
            }
        }
    }

    // 移动地块
    moveTile(gridPos: Vec2) {
        if (this.moveItem) {
            log(this.moveStatus)
            if (this.moveStatus == 0) {
                const buildingSize = MapModel.getInstance().getBuildingSize(this.moveItem.tile.getComponent(UITransform).contentSize , this);
                if (this.moveItem.tileType == "Decor") {
                    const house = this.allHouse.get(this.moveItem.belong);
                    const movingDecorKey = this.moveItem.decorKey || '';
                    // 更新网格数据
                    for (let x = 0; x < buildingSize.x; x++) {
                        for (let y = 0; y < buildingSize.y; y++) {
                            const gridX = gridPos.x + x;
                            const gridY = gridPos.y - y;
                            this.mapData[gridX][gridY] = this.hasDecorCoveringCell(house, gridX, gridY, movingDecorKey) ? 3 : 1;
                        }
                    }
                } else if (!this.isWallDacorationTileType(this.moveItem.tileType)) {
                    // 更新网格数据
                    for (let x = 0; x < buildingSize.x; x++) {
                        for (let y = 0; y < buildingSize.y; y++) {
                            const gridX = gridPos.x + x;
                            const gridY = gridPos.y - y;
                            this.mapData[gridX][gridY] = 0;
                        }
                    }

                    this.mapItems.delete(`${gridPos.x},${gridPos.y}`);
                }

                this.moveStatus = 1;
                this.buildControl.move.play('move_drag');
                console.log(`[MOVE_START] id=${this.moveItem.id}, name=${this.moveItem.tile?.name}, type=${this.moveItem.tileType}, from=${this.moveItem.initGride.x},${this.moveItem.initGride.y}`);
            } else if (this.moveStatus == 1) {
                // 移动
                const size = this.moveItem.tile.getComponent(UITransform).contentSize;
                const ptr = this.lastPointerLocalPos;
                if (this.enablePlacementDragOffset && ptr) {
                    const grabX = (this.moveItem as any).grabOffsetX ?? 0;
                    const grabY = (this.moveItem as any).grabOffsetY ?? 0;
                    const nextX = ptr.x - grabX;
                    const nextY = ptr.y - grabY;
                    this.moveItem.tile.setPosition(nextX, nextY, 0);

                    // 记录当前显示偏移（用于落地保存）；逻辑仍以 gridPos 为准
                    const base = MapModel.getInstance().gridToWorld(gridPos, size, this);
                    (this.moveItem as any).offsetX = nextX - base.x;
                    (this.moveItem as any).offsetY = nextY - base.y;
                } else {
                    const worldPos = MapModel.getInstance().gridToWorld(gridPos, size, this);
                    this.moveItem.tile.setPosition(worldPos);
                    (this.moveItem as any).offsetX = 0;
                    (this.moveItem as any).offsetY = 0;
                }
            } else if (this.moveStatus == 2) {
                const buildingSize = MapModel.getInstance().getBuildingSize(this.moveItem.tile.getComponent(UITransform).contentSize , this);

                if (this.moveItem.tileType == "Decor") {
                    if (this.checkPlacementDecorValidity(gridPos)) {
                        // 移动
                        const size = this.moveItem.tile.getComponent(UITransform).contentSize;
                        const worldPos = MapModel.getInstance().gridToWorld(gridPos, size, this);
                        const ox = (this.moveItem as any).offsetX ?? 0;
                        const oy = (this.moveItem as any).offsetY ?? 0;
                        this.moveItem.tile.setPosition(worldPos.x + ox, worldPos.y + oy, worldPos.z);

                        // 更新网格数据
                        this.markDecorFootprintMapData(gridPos, buildingSize);

                        const house = this.allHouse.get(this.moveItem.belong);
                        const movingDecorKey = this.moveItem.decorKey || '';
                        const next = house.decor.get(movingDecorKey);
                        if (next) {
                            house.decor.delete(movingDecorKey);
                            const nextKey = this.buildDecorStackKey(gridPos, next.tile.name);
                            next.position = `${gridPos.x},${gridPos.y}`;
                            next.offsetX = (this.moveItem as any).offsetX ?? 0;
                            next.offsetY = (this.moveItem as any).offsetY ?? 0;
                            house.decor.set(nextKey, next);
                            this.moveItem.decorKey = nextKey;
                        }
                    } else {
                        // 移动
                        const size = this.moveItem.tile.getComponent(UITransform).contentSize;
                        const worldPos = MapModel.getInstance().gridToWorld(this.moveItem.initGride, size, this);
                        const ox = (this.moveItem as any).initOffsetX ?? 0;
                        const oy = (this.moveItem as any).initOffsetY ?? 0;
                        (this.moveItem as any).offsetX = ox;
                        (this.moveItem as any).offsetY = oy;
                        this.moveItem.tile.setPosition(worldPos.x + ox, worldPos.y + oy, worldPos.z);

                        // 更新网格数据
                        for (let x = 0; x < buildingSize.x; x++) {
                            for (let y = 0; y < buildingSize.y; y++) {
                                const gridX = this.moveItem.initGride.x + x;
                                const gridY = this.moveItem.initGride.y - y;
                                this.mapData[gridX][gridY] = 3;
                            }
                        }
                    }
                } else if (this.isWallDacorationTileType(this.moveItem.tileType)) {
                    if (this.checkPlacementWallDacorationValidity(gridPos)) {
                        const size = this.moveItem.tile.getComponent(UITransform).contentSize;
                        const worldPos = MapModel.getInstance().gridToWorld(gridPos, size, this);
                        const ox = (this.moveItem as any).offsetX ?? 0;
                        const oy = (this.moveItem as any).offsetY ?? 0;
                        this.moveItem.tile.setPosition(worldPos.x + ox, worldPos.y + oy, worldPos.z);
                        const sourceHouse = this.allHouse.get(this.moveItem.belong);
                        const movingDecorKey = this.moveItem.decorKey || '';
                        const next = sourceHouse.decor.get(movingDecorKey);
                        if (next) {
                            sourceHouse.decor.delete(movingDecorKey);
                            const nextKey = this.buildDecorStackKey(gridPos, next.tile.name);
                            next.position = `${gridPos.x},${gridPos.y}`;
                            const targetBelong = this.getWallDacorationBelongByArea(gridPos, buildingSize) || next.belong;
                            next.belong = targetBelong;
                            const targetHouse = this.allHouse.get(targetBelong) || sourceHouse;
                            next.offsetX = (this.moveItem as any).offsetX ?? 0;
                            next.offsetY = (this.moveItem as any).offsetY ?? 0;
                            targetHouse.decor.set(nextKey, next);
                            this.moveItem.decorKey = nextKey;
                        }
                    } else {
                        const size = this.moveItem.tile.getComponent(UITransform).contentSize;
                        const worldPos = MapModel.getInstance().gridToWorld(this.moveItem.initGride, size, this);
                        const ox = (this.moveItem as any).initOffsetX ?? 0;
                        const oy = (this.moveItem as any).initOffsetY ?? 0;
                        (this.moveItem as any).offsetX = ox;
                        (this.moveItem as any).offsetY = oy;
                        this.moveItem.tile.setPosition(worldPos.x + ox, worldPos.y + oy, worldPos.z);
                    }
                } else {
                    if (this.checkPlacementValidity(gridPos)) {
                        // 移动
                        const size = this.moveItem.tile.getComponent(UITransform).contentSize;
                        const worldPos = MapModel.getInstance().gridToWorld(gridPos, size, this);
                        const ox = (this.moveItem as any).offsetX ?? 0;
                        const oy = (this.moveItem as any).offsetY ?? 0;
                        this.moveItem.tile.setPosition(worldPos.x + ox, worldPos.y + oy, worldPos.z);

                        // 更新网格数据
                        for (let x = 0; x < buildingSize.x; x++) {
                            for (let y = 0; y < buildingSize.y; y++) {
                                const gridX = gridPos.x + x;
                                const gridY = gridPos.y - y;
                                this.mapData[gridX][gridY] = 2;
                            }
                        }
                        this.mapItems.set(`${gridPos.x},${gridPos.y}`, this.moveItem);
                    } else {
                        // 移动
                        const size = this.moveItem.tile.getComponent(UITransform).contentSize;
                        const worldPos = MapModel.getInstance().gridToWorld(this.moveItem.initGride, size, this);
                        const ox = (this.moveItem as any).initOffsetX ?? 0;
                        const oy = (this.moveItem as any).initOffsetY ?? 0;
                        (this.moveItem as any).offsetX = ox;
                        (this.moveItem as any).offsetY = oy;
                        this.moveItem.tile.setPosition(worldPos.x + ox, worldPos.y + oy, worldPos.z);

                        // 更新网格数据
                        for (let x = 0; x < buildingSize.x; x++) {
                            for (let y = 0; y < buildingSize.y; y++) {
                                const gridX = this.moveItem.initGride.x + x;
                                const gridY = this.moveItem.initGride.y - y;
                                this.mapData[gridX][gridY] = 2;
                            }
                        }
                        this.mapItems.set(`${this.moveItem.initGride.x},${this.moveItem.initGride.y}`, this.moveItem);
                    }
                }

                this.moveStatus = 0;
                this.buildControl.move.play('move_up');

                if (sys.isMobile) {
                    this.moveItem = null;
                }
            }
        }
    }

    areAdjacent(p1: Vec2, p2: Vec2, threshold: number = 1.5): boolean {
        const dx = Math.abs(p1.x - p2.x);
        const dy = Math.abs(p1.y - p2.y);
        return Math.sqrt(dx * dx + dy * dy) <= threshold;
    }

    groupByAdjacency(points: Vec2[], threshold: number = 1.5): Vec2[][] {
        const groups: Vec2[][] = [];
        const visited = new Set<number>();

        for (let i = 0; i < points.length; i++) {
            if (!visited.has(i)) {
                const group: Vec2[] = [];
                const queue: number[] = [i];
                visited.add(i);

                while (queue.length > 0) {
                    const currentIndex = queue.shift()!;
                    group.push(points[currentIndex]);

                    for (let j = 0; j < points.length; j++) {
                        if (!visited.has(j) && this.areAdjacent(points[currentIndex], points[j], threshold)) {
                            visited.add(j);
                            queue.push(j);
                        }
                    }
                }

                groups.push(group);
            }
        }

        return groups;
    }

    containsArray(mainArray, subArray) {
        const subArrayStr = JSON.stringify(subArray);
        return mainArray.some(element => JSON.stringify(element) === subArrayStr);
    }

    checkCloseHouse(gridPos: Vec2): boolean {
        const dir: number[][] = [
            [-1, 0],
            [1, 0],
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
            [0, -1],
            [0, 1],
            [0, -1],
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1]
        ]

        for (let i = 0; i < dir.length; i++) {
            const element = dir[i];
            const pos = new Vec2(gridPos.x + element[0], gridPos.y + element[1]);
            if (this.mapData[pos.x][pos.y] == 2) {
                return false;
            }
        }

        return true;
    }

    //判断手滑的框，是否可以造房子
    private getInsetBuildRect(): { minX: number; maxX: number; minY: number; maxY: number } | null {
        if (!this._startGrad || !this._currentGrad) {
            return null;
        }

        const rawMinX = Math.min(this._startGrad.x, this._currentGrad.x);
        const rawMaxX = Math.max(this._startGrad.x, this._currentGrad.x);
        const rawMinY = Math.min(this._startGrad.y, this._currentGrad.y);
        const rawMaxY = Math.max(this._startGrad.y, this._currentGrad.y);

        let minX = rawMinX + this.houseInsetLeft;
        let maxX = rawMaxX - this.houseInsetRight;
        let minY = rawMinY + this.houseInsetTop;
        let maxY = rawMaxY - this.houseInsetBottom;

        minX = Math.max(0, minX);
        minY = Math.max(0, minY);
        maxX = Math.min(this.mapWidth - 1, maxX);
        maxY = Math.min(this.mapHeight - 1, maxY);

        if (minX > maxX || minY > maxY) {
            return null;
        }

        return { minX, maxX, minY, maxY };
    }

    private isHouseRectSizeValid(minX: number, maxX: number, minY: number, maxY: number): boolean {
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        return width >= this.houseMinWidth && height >= this.houseMinHeight;
    }

    private showHouseSizeTips() {
        EventSystem.send("ShowTips", `房屋建造失败：宽至少${this.houseMinWidth}格，高至少${this.houseMinHeight}格`);
    }

    private getRawDragRect(): { minX: number; maxX: number; minY: number; maxY: number } | null {
        if (!this._startGrad || !this._currentGrad) {
            return null;
        }
        const minX = Math.max(0, Math.min(this._startGrad.x, this._currentGrad.x));
        const maxX = Math.min(this.mapWidth - 1, Math.max(this._startGrad.x, this._currentGrad.x));
        const minY = Math.max(0, Math.min(this._startGrad.y, this._currentGrad.y));
        const maxY = Math.min(this.mapHeight - 1, Math.max(this._startGrad.y, this._currentGrad.y));
        if (minX > maxX || minY > maxY) {
            return null;
        }
        return { minX, maxX, minY, maxY };
    }

    private getIndoorReplaceHouseId(rect: { minX: number; maxX: number; minY: number; maxY: number }): string | null {
        let houseId = '';
        for (let x = rect.minX; x <= rect.maxX; x++) {
            for (let y = rect.minY; y <= rect.maxY; y++) {
                const item = this.houseItems.get(`${x},${y}`);
                if (!item || item.tileType !== "Floor" || !item.belong) {
                    return null;
                }
                if (!houseId) {
                    houseId = item.belong;
                } else if (houseId !== item.belong) {
                    return null;
                }
            }
        }
        return houseId || null;
    }

    private canReplaceIndoorFloorRect(): boolean {
        if (this.curTileNode?.["tileType"] !== "Floor") {
            return false;
        }
        const rect = this.getRawDragRect();
        if (!rect) {
            return false;
        }
        return this.getIndoorReplaceHouseId(rect) !== null;
    }

    private applyIndoorFloorTiledPatch(
        houseId: string,
        floorId: string,
        rect: { minX: number; maxX: number; minY: number; maxY: number }
    ) {
        const house = this.allHouse.get(houseId);
        if (!house) {
            return;
        }
        if (!house.floorPatchRenderNodes) {
            house.floorPatchRenderNodes = [];
        }

        const innerMinX = rect.minX + 1;
        const innerMaxX = rect.maxX - 1;
        const innerMinY = rect.minY + 1;
        const innerMaxY = rect.maxY - 1;
        if (innerMinX > innerMaxX || innerMinY > innerMaxY) {
            return;
        }

        for (let x = rect.minX; x <= rect.maxX; x++) {
            for (let y = rect.minY; y <= rect.maxY; y++) {
                const key = `${x},${y}`;
                const baseCell = house.base.get(key);
                if (!baseCell || baseCell.tileType !== "Floor") {
                    continue;
                }
                const isInner = x > rect.minX && x < rect.maxX && y > rect.minY && y < rect.maxY;
                this.setFloorTileVisualVisible(baseCell.tile, !isInner);
            }
        }

        const floorCfg = AppConst.JSONManager.getItem("mapFloor", floorId);
        if (!floorCfg || !floorCfg["image"]) {
            return;
        }

        const patchNode = new Node(`houseFloorPatch_${houseId}_${Date.now()}`);
        const patchTransform = patchNode.addComponent(UITransform);
        patchTransform.setContentSize((innerMaxX - innerMinX + 1) * this.tileSize, (innerMaxY - innerMinY + 1) * this.tileSize);
        const patchSprite = patchNode.addComponent(Sprite);
        patchSprite.type = Sprite.Type.TILED;
        patchSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const spLoad = patchNode.addComponent(PrefabLoad);
        spLoad.isTexture = true;
        spLoad.bundleName = "mapEditor";
        spLoad.url = floorCfg["image"] + "/spriteFrame";

        const topLeftCenter = MapModel.getInstance().gridToWorld(new Vec2(innerMinX, innerMinY), null, this);
        const bottomRightCenter = MapModel.getInstance().gridToWorld(new Vec2(innerMaxX, innerMaxY), null, this);
        patchNode.setPosition(
            (topLeftCenter.x + bottomRightCenter.x) * 0.5,
            (topLeftCenter.y + bottomRightCenter.y) * 0.5,
            topLeftCenter.z
        );
        this.homeWallTilemap.addChild(patchNode);
        patchNode.setSiblingIndex(0);
        house.floorPatchRenderNodes.push(patchNode);
    }

    private replaceIndoorFloorByDragRect() {
        const rect = this.getRawDragRect();
        if (!rect) {
            return false;
        }
        const houseId = this.getIndoorReplaceHouseId(rect);
        if (!houseId) {
            return false;
        }
        if (this.curTileNode?.["tileType"] !== "Floor") {
            return false;
        }
        const house = this.allHouse.get(houseId);
        if (!house) {
            return false;
        }

        if (house.floorRenderNode && house.floorRenderNode.isValid) {
            house.floorRenderNode.destroy();
            house.floorRenderNode = null;
            house.base.forEach((cell) => {
                if (cell.tileType === "Floor") {
                    this.setFloorTileVisualVisible(cell.tile, true);
                }
            });
        }

        for (let x = rect.minX; x <= rect.maxX; x++) {
            for (let y = rect.minY; y <= rect.maxY; y++) {
                const key = `${x},${y}`;
                const oldCell = this.houseItems.get(key);
                if (!oldCell || oldCell.tileType !== "Floor" || !oldCell.belong) {
                    continue;
                }

                oldCell.tile && oldCell.tile.destroy();
                const tile = MapManager.GetInstance().getMapCurTileNode(this.curTileNode.name, "Floor");
                tile.name = this.curTileNode.name + "#Floor";
                tile["cfgId"] = this.curTileNode.name;
                const worldPos = MapModel.getInstance().gridToWorld(new Vec2(x, y), null, this);
                tile.setPosition(worldPos);
                this.homeWallTilemap.addChild(tile);

                this.houseItems.set(key, { tile, tileType: "Floor", belong: oldCell.belong });
                const size = tile.getComponent(UITransform).contentSize;
                house.base.set(key, { tile, tileType: "Floor", width: size.width, height: size.height, belong: oldCell.belong });
                this.mapData[x][y] = 1;
            }
        }

        this.applyIndoorFloorTiledPatch(houseId, this.curTileNode.name, rect);
        return true;
    }

    autoGraphicsWall(){
        const rect = this.getInsetBuildRect();
        if (!rect) {
            this.lastSelectionFailReason = 'size';
            return false;
        }
        if (!this.isHouseRectSizeValid(rect.minX, rect.maxX, rect.minY, rect.maxY)) {
            this.lastSelectionFailReason = 'size';
            return false;
        }

        let isDraw = true
        const startGrad = new Vec2(rect.minX, rect.minY);
        const currentGrad = new Vec2(rect.maxX, rect.maxY);
        const path = Utils.traverseRectangle(startGrad, currentGrad);
        path.forEach((point, index) => {
            let gridPos = new Vec2(point.x , point.y)
            if (this.checkPlacementValidity(gridPos) && !this.containsArray(this.buildFloorPoints, gridPos)) {

            }else{
                this.lastSelectionFailReason = 'placement';
                isDraw = false
                return false
            }
        });
        if (isDraw) {
            this.lastSelectionFailReason = '';
        }
        return isDraw
    }

    buildSurround(grids: Vec2[], openPos: Vec2[]): GridCellType[][] {
        let topLeft = grids[0];
        let topRight = grids[0];
        let bottomLeft = grids[0];
        let bottomRight = grids[0];

        for (const point of grids) {
            // 左上角：x最小且y最小的点
            if (point.x < topLeft.x || (point.x === topLeft.x && point.y < topLeft.y)) {
                topLeft = point;
            }

            // 右上角：x最大且y最小的点
            if (point.x > topRight.x || (point.x === topRight.x && point.y < topRight.y)) {
                topRight = point;
            }

            // 左下角：x最小且y最小的点
            if (point.x < bottomLeft.x || (point.x === bottomLeft.x && point.y > bottomLeft.y)) {
                bottomLeft = point;
            }

            // 右下角：x最大且y最小的点
            if (point.x > bottomRight.x || (point.x === bottomRight.x && point.y > bottomRight.y)) {
                bottomRight = point;
            }
        }

        let gridCells: GridCellType[][] = [];
        let width = (bottomRight.x - bottomLeft.x + 1) * 2;
        let height = (bottomLeft.y - topLeft.y + 1) * 2;

        for (let y = 0; y < height; y++) {
            gridCells[y] = [];
            for (let x = 0; x < width; x++) {
                if (y == 0 || y == height - 1 || y == 1 || y == height - 2) {
                    gridCells[y][x] = GridCellType.WALL;
                } else {
                    if (x == 0 || x == width - 1 || x == 1 || x == width - 2) {
                        gridCells[y][x] = GridCellType.WALL;
                    } else {
                        gridCells[y][x] = GridCellType.EMPTY;
                    }
                }
            }
        }

        openPos.forEach((pt) => {
            gridCells[pt.x - topLeft.x][pt.y - topLeft.y] = GridCellType.EMPTY;
        })

        return gridCells;
    }

    getTopLeftPos(grids: Vec2[]) {
        let topLeft = grids[0];
        for (const point of grids) {
            // 左上角：x最小且y最小的点
            if (point.x < topLeft.x || (point.x === topLeft.x && point.y < topLeft.y)) {
                topLeft = point;
            }
        }

        return topLeft;
    }

    getCenterPos(grids: Vec2[]): Vec2 {
        let topLeft = grids[0];
        let topRight = grids[0];
        let bottomLeft = grids[0];
        let bottomRight = grids[0];

        for (const point of grids) {
            // 左上角：x最小且y最小的点
            if (point.x < topLeft.x || (point.x === topLeft.x && point.y < topLeft.y)) {
                topLeft = point;
            }

            // 右上角：x最大且y最小的点
            if (point.x > topRight.x || (point.x === topRight.x && point.y < topRight.y)) {
                topRight = point;
            }

            // 左下角：x最小且y最小的点
            if (point.x < bottomLeft.x || (point.x === bottomLeft.x && point.y > bottomLeft.y)) {
                bottomLeft = point;
            }

            // 右下角：x最大且y最小的点
            if (point.x > bottomRight.x || (point.x === bottomRight.x && point.y > bottomRight.y)) {
                bottomRight = point;
            }
        }

        return new Vec2(bottomLeft.x + (bottomRight.x - bottomLeft.x) / 2, topLeft.y + (bottomLeft.y - topLeft.y) / 2);
    }

    // 检测并返回封闭空间的数量
    detectEnclosedSpaces(arr): number {
        // 复制网格数据，避免修改原始数据
        const gridCopy = JSON.parse(JSON.stringify(arr)) as GridCellType[][];

        // 从边界开始标记所有可达的空区域
        this.markReachableFromBorder(gridCopy);

        // 统计剩余的封闭空间
        let count = 0;

        for (let x = 0; x < gridCopy.length; x++) {
            for (let y = 0; y < gridCopy[0].length; y++) {
                if (gridCopy[x][y] === GridCellType.EMPTY) {
                    // 发现一个新的封闭空间
                    count++;
                    // 标记这个封闭空间的所有单元格为已访问
                    this.markEnclosedSpace(gridCopy, x, y, gridCopy.length, gridCopy[0].length);
                }
            }
        }

        return count;
    }

    // 从边界开始标记所有可达的空区域
    private markReachableFromBorder(grid: GridCellType[][]) {
        // 检查顶部和底部边界
        for (let x = 0; x < grid.length; x++) {
            this.floodFill(grid, x, 0, grid.length, grid[0].length);
        }
    }

    // 深度优先搜索填充已访问区域
    private floodFill(grid: GridCellType[][], x: number, y: number, width: number, height: number) {
        // 检查坐标是否超出边界
        if (x < 0 || x >= width || y < 0 || y >= height) {
            return;
        }

        // 检查是否为墙或已访问
        if (grid[x][y] !== GridCellType.EMPTY) {
            return;
        }

        // 标记为已访问
        grid[x][y] = GridCellType.VISITED;

        // 递归填充相邻区域
        this.floodFill(grid, x + 1, y, width, height); // 右
        this.floodFill(grid, x - 1, y, width, height); // 左
        this.floodFill(grid, x, y + 1, width, height); // 下
        this.floodFill(grid, x, y - 1, width, height); // 上
    }

    // 标记一个封闭空间的所有单元格为已访问
    private markEnclosedSpace(grid: GridCellType[][], x: number, y: number, width: number, height: number) {
        // 使用DFS标记这个封闭空间的所有单元格
        this.floodFill(grid, x, y, width, height);
    }

    // 靠近墙壁
    checkNearOutWall(outWall: Vec2[], gridePos: Vec2) {
        for (let i = 0; i < outWall.length; i++) {
            const element = outWall[i];
            if (element.y == gridePos.y) {
                if (gridePos.x - 1 == element.x || gridePos.x + 1 == element.x) {
                    return true;
                }
            }
        }

        return false;
    }

    // 靠近墙壁
    checkNearInWall(inWall: Vec2[], gridePos: Vec2) {
        for (let i = 0; i < inWall.length; i++) {
            const element = inWall[i];
            if (element.y == gridePos.y) {
                if (gridePos.x - 1 == element.x || gridePos.x + 1 == element.x) {
                    return true;
                }
            }
        }

        return false;
    }

    // 靠近墙壁
    checkNearVerWall(verWalls: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string }>, gridePos: Vec2) {
        if ((verWalls.has(`${gridePos.x},${gridePos.y}`) && verWalls.has(`${gridePos.x},${gridePos.y - 1}`))
            || (verWalls.has(`${gridePos.x + 1},${gridePos.y}`) && verWalls.has(`${gridePos.x + 1},${gridePos.y - 1}`))) {
            return true;
        }

        return false;
    }

    // 检测横向墙壁
    checHorizontalkWall(outWall: Vec2[], inWall: Vec2[], openWall: Vec2[], gridePos: Vec2): boolean {
        for (let i = 0; i < outWall.length; i++) {
            const element = outWall[i];
            if (element.x == gridePos.x) {
                if (element.y - 1 == gridePos.y || element.y + 1 == gridePos.y || element.y + 2 == gridePos.y) {
                    return false;
                }
            }
        }

        const directions = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: 0, y: -2 },
            { x: 0, y: 2 }
        ];

        for (let i = 0; i < directions.length; i++) {
            const pos = new Vec2(gridePos.x + directions[i].x, gridePos.y + directions[i].y);

            let islike = false;
            for (const pt of inWall) {
                if (pos.x == pt.x && pos.y == pt.y) {
                    islike = true;
                    break;
                }
            }

            if (islike) {
                return false;
            }
        }

        const openDir = [
            { x: -1, y: 0 },
            { x: 1, y: 0 },
            { x: -1, y: -1 },
            { x: 1, y: -1 }
        ]

        for (let i = 0; i < openDir.length; i++) {
            const pos = new Vec2(gridePos.x + openDir[i].x, gridePos.y + openDir[i].y);

            let islike = false;
            for (const pt of openWall) {
                if (pos.x == pt.x && pos.y == pt.y) {
                    islike = true;
                    break;
                }
            }

            if (islike) {
                return false;
            }
        }

        return true;
    }

    // 检测纵向墙壁
    checVerticalkWall(gridePos: Vec2, horWalls: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string }>
        , verWalls: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string }>
    ): boolean {
        if (horWalls.has(`${gridePos.x - 1},${gridePos.y + 1}`) || horWalls.has(`${gridePos.x - 1},${gridePos.y}`)
            || horWalls.has(`${gridePos.x},${gridePos.y + 1}`) || horWalls.has(`${gridePos.x},${gridePos.y}`) ||
            verWalls.has(`${gridePos.x},${gridePos.y + 1}`) || verWalls.has(`${gridePos.x},${gridePos.y - 1}`)) {
            return true;
        }

        return false;
    }

    changeWallFrame(horWalls: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string }>,
        verWalls: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string }>,
        outWall: Vec2[]
    ) {
        

        let num = 0;

        horWalls.forEach((value, key) => {
            if (value.tile.getSiblingIndex() > num) {
                num = value.tile.getSiblingIndex();
            }
        })

        verWalls.forEach((value, key) => {
            num += 1;
            value.tile.setSiblingIndex(num);
        })
    }

    isNearOutWall(arr, pos): boolean {
        for (let i = 0; i < arr.length; i++) {
            const element = arr[i];
            if (element.x == pos.x && element.y == pos.y) {
                return true;
            }
        }

        return false;
    }

    private getOutWallFrameByDir(dir: string): SpriteFrame | null {
        if (dir === 'up') return this.outWallSprites[0];
        if (dir === 'down') return this.outWallSprites[1];
        if (dir === 'left') return this.outWallSprites[2];
        if (dir === 'right') return this.outWallSprites[3];
        return this.outWallSprites[1] || null;
    }

    private removeHouseDoor(target: { belong?: string, doorPos?: Vec2, doorDir?: string }) {
        if (!target?.belong || !target?.doorPos) {
            return;
        }
        const house = this.allHouse.get(target.belong);
        if (!house) {
            return;
        }

        const key = `${target.doorPos.x},${target.doorPos.y}`;
        const sideName = this.getHouseDoorNodeName(target.belong, target.doorPos, 'cebianDoor1');
        const bottomName = this.getHouseDoorNodeName(target.belong, target.doorPos, 'door1');
        const sideDoor = this.homeWallTilemap.getChildByName(sideName);
        const bottomDoor = this.homeWallTilemap.getChildByName(bottomName);
        sideDoor && sideDoor.destroy();
        bottomDoor && bottomDoor.destroy();

        house.openWall = house.openWall.filter((pt) => !(pt.x === target.doorPos.x && pt.y === target.doorPos.y));
        house.openWallDoorDecorIdMap?.delete(key);

        const localWall = house.base.get(key) as any;
        const globalWall = this.houseItems.get(key) as any;
        const wallDir = target.doorDir || localWall?.dir || globalWall?.dir || 'down';
        let wallNode: Node | null = (globalWall?.tile && globalWall.tile.isValid) ? globalWall.tile : null;
        if (!wallNode) {
            wallNode = instantiate(this.wallPrefab);
            const frame = this.getOutWallFrameByDir(wallDir);
            if (frame) {
                wallNode.getComponent(Sprite).spriteFrame = frame;
            }
            const worldPos = MapModel.getInstance().gridToWorld(target.doorPos, wallNode.getComponent(UITransform).contentSize, this);
            wallNode.setPosition(worldPos);
            this.homeWallTilemap.addChild(wallNode);
        }

        if (localWall) {
            localWall.tile = wallNode;
            localWall.tileType = "OutWall";
            localWall.dir = wallDir;
        }
        if (globalWall) {
            globalWall.tile = wallNode;
            globalWall.tileType = "OutWall";
            globalWall.belong = target.belong;
            globalWall.dir = wallDir;
        } else {
            this.houseItems.set(key, { tile: wallNode, tileType: "OutWall", belong: target.belong, dir: wallDir } as any);
        }

        const wallSize = wallNode.getComponent(UITransform).contentSize;
        const wallGridSize = MapModel.getInstance().getBuildingSize(wallSize, this);
        for (let x = 0; x < wallGridSize.x; x++) {
            for (let y = 0; y < wallGridSize.y; y++) {
                const gx = target.doorPos.x + x;
                const gy = target.doorPos.y - y;
                if (gx < 0 || gx >= this.mapWidth || gy < 0 || gy >= this.mapHeight) {
                    continue;
                }
                this.mapData[gx][gy] = 2;
            }
        }
    }

    private removeHouseDecor(target: { belong?: string, decorKey?: string }) {
        if (!target?.belong || !target?.decorKey) {
            return;
        }
        const house = this.allHouse.get(target.belong);
        if (!house) {
            return;
        }
        const decor = house.decor.get(target.decorKey);
        if (!decor) {
            return;
        }

        decor.tile && decor.tile.destroy();
        const pos = this.getDecorPosition(target.decorKey, decor);
        const buildingSize = MapModel.getInstance().getBuildingSize(new Size(decor.width, decor.height), this);
        if (decor.tileType === "Decor") {
            for (let x = 0; x < buildingSize.x; x++) {
                for (let y = 0; y < buildingSize.y; y++) {
                    const gridX = pos.x + x;
                    const gridY = pos.y - y;
                    if (gridX < 0 || gridX >= this.mapWidth || gridY < 0 || gridY >= this.mapHeight) {
                        continue;
                    }
                    this.mapData[gridX][gridY] = this.hasDecorCoveringCell(house, gridX, gridY, target.decorKey) ? 3 : 1;
                }
            }
        }

        house.decor.delete(target.decorKey);
    }

    // 销毁地块（优先单拆：房门、家具、墙饰；否则拆整屋）
    deteleTile(gridPos: Vec2) {
        const removedRegionCount = this.removeMapRegionByGrid(gridPos);
        if (removedRegionCount > 0) {
            MapManager.GetInstance().getMapEditorUI()?.refreshRegionHighlightsFromData?.();
            this.deteleItem = null;
            this.buildControl.detele.play('detele_action');
            return;
        }
        const target = this.deteleItem || this.resolveDeleteTarget(gridPos);
        if (target?.tileType === "House" && target?.belong) {
            this.removeWholeHouse(target.belong);
            this.deteleItem = null;
            this.setTileMaskSp();
            MapManager.GetInstance().getMapEditorUI().checkButtonVisible(true);
            this.buildControl.detele.play('detele_action');
            return;
        } else if (target?.tileType === "HouseDoor") {
            this.removeHouseDoor(target);
            this.deteleItem = null;
            this.setTileMaskSp();
            MapManager.GetInstance().getMapEditorUI().checkButtonVisible(true);
            this.buildControl.detele.play('detele_action');
            return;
        } else if (target?.belong && target?.decorKey && (target.tileType === "Decor" || this.isWallDacorationTileType(target.tileType))) {
            this.removeHouseDecor(target);
            this.deteleItem = null;
            this.setTileMaskSp();
            MapManager.GetInstance().getMapEditorUI().checkButtonVisible(true);
            this.buildControl.detele.play('detele_action');
            return;
        } else if (target?.anchorPos && this.mapItems.has(`${target.anchorPos.x},${target.anchorPos.y}`)) {
            const anchorPos = target.anchorPos;
            const anchorKey = `${anchorPos.x},${anchorPos.y}`;
            const mapItem = this.mapItems.get(anchorKey);
            if (mapItem.tileType == "Floor") {
                for (let i = 0; i < this.buildFloorPoints.length; i++) {
                    const element = this.buildFloorPoints[i];
                    if (element.x == anchorPos.x && element.y == anchorPos.y) {
                        this.buildFloorPoints.splice(i, 1);
                        break;
                    }
                }
            }

            const buildingSize = this.getNodeGridSize(mapItem.tile);
            if (mapItem.tile) {
                mapItem.tile.destroy();
            }
            this.mapItems.delete(anchorKey);

            // 更新网格数据
            for (let x = 0; x < buildingSize.x; x++) {
                for (let y = 0; y < buildingSize.y; y++) {
                    const gridX = anchorPos.x + x;
                    const gridY = anchorPos.y - y;
                    this.mapData[gridX][gridY] = 0;
                }
            }
        } else if (this.containsArray(this.buildFloorPoints, gridPos)) {
            const item = this.houseItems.get(`${gridPos.x},${gridPos.y}`);
            if (!item.belong) {
                item.tile && item.tile.destroy();
                this.houseItems.delete(`${gridPos.x},${gridPos.y}`);

                for (let i = 0; i < this.buildFloorPoints.length; i++) {
                    const element = this.buildFloorPoints[i];
                    if (element.x == gridPos.x && element.y == gridPos.y) {
                        this.buildFloorPoints.splice(i, 1);
                        break;
                    }
                }

                const size = item.tile.getComponent(UITransform).contentSize;
                const buildingSize = MapModel.getInstance().getBuildingSize(size , this);

                // 更新网格数据
                for (let x = 0; x < buildingSize.x; x++) {
                    for (let y = 0; y < buildingSize.y; y++) {
                        const gridX = gridPos.x + x;
                        const gridY = gridPos.y - y;
                        this.mapData[gridX][gridY] = 0;
                    }
                }

            }
        }

        this.deteleItem = null;
        this.buildControl.detele.play('detele_action');
    }

    public isGridInMapRegion(gridPos: Vec2): boolean {
        for (let i = 0; i < this.mapRegions.length; i++) {
            const region = this.mapRegions[i];
            if (gridPos.x >= region.minX && gridPos.x <= region.maxX &&
                gridPos.y >= region.minY && gridPos.y <= region.maxY) {
                return true;
            }
        }
        return false;
    }

    public getMapRegionByGrid(gridPos: Vec2): { id: string, minX: number, minY: number, maxX: number, maxY: number, npcIds: string[] } | null {
        for (let i = 0; i < this.mapRegions.length; i++) {
            const region = this.mapRegions[i];
            if (gridPos.x >= region.minX && gridPos.x <= region.maxX &&
                gridPos.y >= region.minY && gridPos.y <= region.maxY) {
                return region;
            }
        }
        return null;
    }

    public isMapRegionOverlap(minX: number, minY: number, maxX: number, maxY: number): boolean {
        for (let i = 0; i < this.mapRegions.length; i++) {
            const region = this.mapRegions[i];
            const separated = maxX < region.minX || minX > region.maxX || maxY < region.minY || minY > region.maxY;
            if (!separated) {
                return true;
            }
        }
        return false;
    }

    public addMapRegion(minX: number, minY: number, maxX: number, maxY: number, npcIds: string[] = []): boolean {
        if (this.isMapRegionOverlap(minX, minY, maxX, maxY)) {
            return false;
        }
        const id = `region_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        this.mapRegions.push({
            id,
            minX,
            minY,
            maxX,
            maxY,
            npcIds: Array.isArray(npcIds) ? [...npcIds] : []
        });
        return true;
    }

    public removeMapRegionByGrid(gridPos: Vec2): number {
        const removedIds: string[] = [];
        const before = this.mapRegions.length;
        this.mapRegions = this.mapRegions.filter((region) => {
            const hit = gridPos.x >= region.minX && gridPos.x <= region.maxX &&
                gridPos.y >= region.minY && gridPos.y <= region.maxY;
            if (hit) {
                removedIds.push(region.id);
            }
            return !hit;
        });
        for (let i = 0; i < removedIds.length; i++) {
            this.clearRegionNpcHeadLayer(removedIds[i]);
        }
        return before - this.mapRegions.length;
    }

    public addNpcToRegion(regionId: string, npcId: string): boolean {
        if (!regionId || !npcId) return false;
        for (let i = 0; i < this.mapRegions.length; i++) {
            const region = this.mapRegions[i];
            if (region.id !== regionId) continue;
            if (!Array.isArray(region.npcIds)) {
                region.npcIds = [];
            }
            if (region.npcIds.indexOf(npcId) !== -1) {
                return false;
            }
            region.npcIds.push(npcId);
            return true;
        }
        return false;
    }

    public removeNpcFromRegion(regionId: string, npcId: string): boolean {
        if (!regionId || !npcId) return false;
        for (let i = 0; i < this.mapRegions.length; i++) {
            const region = this.mapRegions[i];
            if (region.id !== regionId || !Array.isArray(region.npcIds)) continue;
            const before = region.npcIds.length;
            region.npcIds = region.npcIds.filter((id) => id !== npcId);
            return before !== region.npcIds.length;
        }
        return false;
    }

    /** 框选未确认前，地图上用此 key 挂头像节点 */
    public static readonly PENDING_REGION_NPC_KEY = '__pending_region_npc__';

    private regionNpcHeadLayerMap: Map<string, Node> = new Map();

    public clearRegionNpcHeadLayer(regionKey: string) {
        const node = this.regionNpcHeadLayerMap.get(regionKey);
        if (node?.isValid) {
            node.destroy();
        }
        this.regionNpcHeadLayerMap.delete(regionKey);
    }

    public clearPendingRegionNpcHeads() {
        this.clearRegionNpcHeadLayer(MapEditor.PENDING_REGION_NPC_KEY);
    }

    private findMapEditNpcById(npcId: string): any | null {
        const list = MapModel.getInstance().mapEditNpc as any[];
        for (let i = 0; i < list.length; i++) {
            if (String(list[i].id) === npcId) {
                return list[i];
            }
        }
        return null;
    }

    /**
     * 区域格子最终显示用节点：优先 MapEditor.regionNpcCellPrefab；否则 mapEditNpc 的 prefab/tileId；再否则占位格。
     */
    public createRegionNpcDisplayNode(npcId: string): Node {
        const idStr = String(npcId);
        if (this.regionNpcCellPrefab) {
            const n = instantiate(this.regionNpcCellPrefab);
            n.name = `regionNpc_${idStr}`;
            const binder = n.getComponent(RegionNpcCellBinder);
            if (binder) {
                binder.setNpcId(idStr);
            }
            return n;
        }
        const v = this.instantiateRegionNpcNodeFromMapEditData(idStr);
        if (v?.isValid) {
            return v;
        }
        return this.createRegionNpcPlaceholderNode(idStr);
    }

    /**
     * 按 mapEditNpc 绑定创建节点：优先 prefab 路径（PrefabLoad），否则 tileId 走地图物件预制（getTilePrefab）。
     * 数据字段示例：prefab / prefabPath / mapPrefab，prefabBundle，tileId / tilePrefabId
     */
    public instantiateRegionNpcNodeFromMapEditData(npcId: string): Node | null {
        const data = this.findMapEditNpcById(String(npcId));
        if (!data) {
            return null;
        }
        const prefabPath = data.prefab ?? data.prefabPath ?? data.mapPrefab;
        if (typeof prefabPath === 'string' && prefabPath.length > 0) {
            const bundle = data.prefabBundle ?? data.bundle ?? 'mapEditor';
            const n = new Node(`regionNpc_${npcId}`);
            n.addComponent(UITransform);
            const pl = n.addComponent(PrefabLoad);
            pl.bundleName = bundle;
            pl.url = prefabPath;
            return n;
        }
        const tileKey = data.tileId ?? data.tilePrefabId;
        if (tileKey != null && String(tileKey).length > 0) {
            return MapManager.GetInstance().getTilePrefab(String(tileKey));
        }
        return null;
    }

    /** 与 mapContainer 同坐标系，但渲染在 npcLayer 上，避免被地面/装饰盖住 */
    private getRegionNpcHostParent(): Node {
        if (this.npcLayer?.isValid) {
            return this.npcLayer;
        }
        return this.mapContainer;
    }

    /**
     * 在地图区域格内排布 NPC（与 npcIds 顺序一致）。
     * 排列规则：以矩形左上角格 (minX, minY) 为第 1 个 NPC；同一行从左到右 (gx 递增)；
     * 一行排满后换到下一行 (gy = minY+1, minY+2 …)，即先行内「左→右」，再行间「上→下」。
     * 展示由 mapEditNpc 的 prefab / tileId 决定；若无绑定则画占位格便于确认位置。
     */
    private layoutRegionNpcHeads(
        regionKey: string,
        rect: { minX: number, minY: number, maxX: number, maxY: number },
        npcIds: string[]
    ) {
        this.clearRegionNpcHeadLayer(regionKey);
        const host = this.getRegionNpcHostParent();
        if (!npcIds?.length || !host?.isValid || !this.mapContainer?.isValid) {
            return;
        }
        const gw = rect.maxX - rect.minX + 1;
        const gh = rect.maxY - rect.minY + 1;
        const cap = gw * gh;
        const count = Math.min(npcIds.length, cap);
        const layer = new Node(`regionNpcHead_${regionKey}`);
        layer.layer = host.layer;
        host.addChild(layer);
        this.regionNpcHeadLayerMap.set(regionKey, layer);
        layer.setSiblingIndex(host.children.length - 1);

        const tileSz = new Size(this.tileSize, this.tileSize);
        for (let i = 0; i < count; i++) {
            // 行优先：第 i 个 → 第 row 行、第 col 列（从区域左上角起）
            const col = i % gw;
            const row = Math.floor(i / gw);
            const gx = rect.minX + col;
            const gy = rect.minY + row;
            if (gy > rect.maxY) {
                break;
            }
            const gridPos = new Vec2(gx, gy);
            const worldPos = MapModel.getInstance().gridToWorld(gridPos, tileSz, this);
            const idStr = String(npcIds[i]);
            const visual = this.createRegionNpcDisplayNode(idStr);
            if (!visual?.isValid) {
                continue;
            }
            visual.layer = host.layer;
            visual.setPosition(worldPos);
            layer.addChild(visual);
        }
    }

    /** 无 prefab/tileId 绑定时仍显示一格，便于确认排列位置（配置好 mapEditNpc 后可替换为正式预制） */
    private createRegionNpcPlaceholderNode(idStr: string): Node {
        const n = new Node(`regionNpc_ph_${idStr}`);
        const uit = n.addComponent(UITransform);
        const sz = this.tileSize - 4;
        uit.setContentSize(sz, sz);
        uit.setAnchorPoint(0.5, 0.5);
        const g = n.addComponent(Graphics);
        g.fillColor = new Color(60, 140, 255, 140);
        const h = sz * 0.5;
        g.rect(-h, -h, sz, sz);
        g.fill();
        const lbl = n.addComponent(Label);
        lbl.string = idStr;
        lbl.fontSize = 11;
        lbl.lineHeight = 12;
        lbl.color = new Color(255, 255, 255, 255);
        lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        lbl.verticalAlign = Label.VerticalAlign.CENTER;
        lbl.overflow = Label.Overflow.SHRINK;
        return n;
    }

    public layoutRegionNpcHeadsForPending(
        rect: { minX: number, minY: number, maxX: number, maxY: number },
        npcIds: string[]
    ) {
        this.layoutRegionNpcHeads(MapEditor.PENDING_REGION_NPC_KEY, rect, npcIds);
    }

    public layoutRegionNpcHeadsForRegion(
        regionId: string,
        rect: { minX: number, minY: number, maxX: number, maxY: number },
        npcIds: string[]
    ) {
        this.layoutRegionNpcHeads(regionId, rect, npcIds);
    }

    /** 根据 mapRegions 与 npcIds 重建（loadMap 用） */
    public rebuildAllRegionNpcHeadsFromRegions() {
        for (const key of this.regionNpcHeadLayerMap.keys()) {
            const node = this.regionNpcHeadLayerMap.get(key);
            if (node?.isValid) {
                node.destroy();
            }
        }
        this.regionNpcHeadLayerMap.clear();
        for (let i = 0; i < this.mapRegions.length; i++) {
            const r = this.mapRegions[i];
            const npcIds = Array.isArray(r.npcIds) ? r.npcIds.map((id) => String(id)) : [];
            this.layoutRegionNpcHeads(r.id, {
                minX: r.minX,
                minY: r.minY,
                maxX: r.maxX,
                maxY: r.maxY
            }, npcIds);
        }
    }

    /** 已存在区域数据变更后刷新（如后续支持编辑已确认区域） */
    public syncRegionNpcLayoutFromData(regionId: string) {
        for (let i = 0; i < this.mapRegions.length; i++) {
            const r = this.mapRegions[i];
            if (r.id === regionId) {
                const npcIds = Array.isArray(r.npcIds) ? r.npcIds.map((id) => String(id)) : [];
                this.layoutRegionNpcHeadsForRegion(regionId, {
                    minX: r.minX,
                    minY: r.minY,
                    maxX: r.maxX,
                    maxY: r.maxY
                }, npcIds);
                return;
            }
        }
    }

    // 重置操作
    restTouch() {
        this.isBuildSwitch = false;
        this.isMousePoint = false;
        this.buildControl.move.node.active = false;
        this.buildControl.detele.node.active = false;

        this.tileMaskNode.active = true;
        this.maskSp.color = new Color('#FFFFFF32');
        this.buildControl.npc_banner1.active = false;

        this.setTileMaskSp();
        this.setArrowSignActive(false);
    }

    calculateDisplayTile(coords: Vec2) {
        const topRight = this.getPlaceholderTileTypeAt(new Vec2(coords.x - this.NEIGHBOURS[0].x, coords.y - this.NEIGHBOURS[0].y));
        const topLeft = this.getPlaceholderTileTypeAt(new Vec2(coords.x - this.NEIGHBOURS[1].x, coords.y - this.NEIGHBOURS[1].y));
        const botRight = this.getPlaceholderTileTypeAt(new Vec2(coords.x - this.NEIGHBOURS[2].x, coords.y - this.NEIGHBOURS[2].y));
        const botLeft = this.getPlaceholderTileTypeAt(new Vec2(coords.x - this.NEIGHBOURS[3].x, coords.y - this.NEIGHBOURS[3].y));

        for (let i = 0; i < this.neighbourTupleToTile.length; i++) {
            const element = this.neighbourTupleToTile[i];
            if (element.type1 == topLeft && element.type2 == topRight && element.type3 == botLeft && element.type4 == botRight) {
                return element.sp;
            }
        }

        return null;
    }

    getPlaceholderTileTypeAt(pos: Vec2): number {
        if (this.placeholderTilemap.has(`${pos.x},${pos.y}`)) {
            if (this.placeholderTilemap.get(`${pos.x},${pos.y}`)._type == 1) {
                return 1;
            } else {
                return 2;
            }
        }
        return 1;
    }

    private createGridVisualization() {
        // 创建网格可视化
        const gridNode = new Node("Grid");
        this.graphics = gridNode.addComponent(Graphics);
        this.mapContainer.addChild(gridNode);

        this.drawGrid();
    }

    private drawGrid() {
        // 绘制网格线
        this.graphics.clear();
        this.graphics.lineWidth = 5;
        this.graphics.strokeColor = Color.RED;

        // 绘制水平线
        for (let y = 0; y <= this.mapHeight; y++) {
            this.graphics.moveTo(-this.mapWidth / 2 * this.tileSize, -this.mapHeight / 2 * this.tileSize + y * this.tileSize);
            this.graphics.lineTo(this.mapWidth / 2 * this.tileSize, -this.mapHeight / 2 * this.tileSize + y * this.tileSize);
            this.graphics.stroke();
        }

        // 绘制垂直线
        for (let x = 0; x <= this.mapWidth; x++) {
            this.graphics.moveTo(-this.mapWidth / 2 * this.tileSize + x * this.tileSize, -this.mapHeight / 2 * this.tileSize);
            this.graphics.lineTo(-this.mapWidth / 2 * this.tileSize + x * this.tileSize, this.mapHeight / 2 * this.tileSize);
            this.graphics.stroke();
        }
    }

    public getGridToPosition(gridPos: Vec2) {
        const startX = -this.tileSize * (this.mapWidth - 1) / 2;
        const startY = this.tileSize * (this.mapHeight - 1) / 2;

        // 网格坐标转世界坐标 - 考虑建筑大小居中
        let buildingSize = MapModel.getInstance().getBuildingSize(new Size(this.tileSize, this.tileSize) , this);

        // 计算单元格位置
        const posX = startX + gridPos.x * this.tileSize + (buildingSize.x * this.tileSize) / 2 - this.tileSize / 2;
        const posY = startY - gridPos.y * this.tileSize + (buildingSize.y * this.tileSize) / 2 - this.tileSize / 2;

        return new Vec3(posX, posY, 0);
    }

    public getPositionToGrid(pos: Vec2, size?: Size) {
        const startX = -this.tileSize * (this.mapWidth - 1) / 2;
        const startY = this.tileSize * (this.mapHeight - 1) / 2;

        if (!size) size = new Size(this.tileSize, this.tileSize);

        // 网格坐标转世界坐标 - 考虑建筑大小居中
        let buildingSize = MapModel.getInstance().getBuildingSize(size , this);
        pos.x = (pos.x + this.tileSize / 2 - (buildingSize.x * this.tileSize) / 2 - startX) / this.tileSize;
        pos.y = (startY + (this.tileSize * (buildingSize.y - 1)) / 2 - pos.y) / this.tileSize;

        return new Vec2(pos.x, pos.y);
    }

    private checkPlaceTreeValidity(gridPos: Vec2): boolean {
        return true
        // 检查建筑放置是否有效
        if (gridPos.x < 0 || gridPos.y < 0) return false;

        const buildingSize = MapModel.getInstance().getBuildingSize(this.tileMaskNode.getComponent(UITransform).contentSize , this);

        // 检查是否超出边界
        if (gridPos.x + buildingSize.x > this.mapWidth ||
            gridPos.y + buildingSize.y > this.mapHeight) {
            return false;
        }
        // 检查建筑放置是否有效
        if (gridPos.x < 0 || gridPos.y < 0) return false;

        const dir: number[][] = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
            [0, 1],
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1]
        ]

        for (let x = 0; x < buildingSize.x; x++) {
            for (let y = 0; y < buildingSize.y; y++) {
                const checkX1 = gridPos.x + x;
                const checkY1 = gridPos.y - y;

                if (this.mapData[checkX1][checkY1] !== 0) {
                    return false;
                } else {
                    for (let i = 0; i < dir.length; i++) {
                        const element = dir[i];
                        const pos = new Vec2(checkX1 + element[0], checkY1 + element[1]);
                        if (this.houseItems.has(`${pos.x},${pos.y}`) && this.houseItems.get(`${pos.x},${pos.y}`).tileType == "OutWall") {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }

    private checkPlacementValidity(gridPos: Vec2): boolean {
        // 检查建筑放置是否有效
        if (gridPos.x < 0 || gridPos.y < 0) return false;

        const buildingSize = MapModel.getInstance().getBuildingSize(this.tileMaskNode.getComponent(UITransform).contentSize , this);

        // 检查是否超出边界
        if (gridPos.x + buildingSize.x > this.mapWidth ||
            gridPos.y + buildingSize.y > this.mapHeight) {
            return false;
        }

        for (let x = 0; x < buildingSize.x; x++) {
            for (let y = 0; y < buildingSize.y; y++) {
                const checkX1 = gridPos.x + x;
                const checkY1 = gridPos.y - y;

                if (this.mapData[checkX1][checkY1] !== 0) {
                    return false;
                }
            }
        }

        return true;
    }

    // 检查家具建筑放置是否有效
    private checkPlacementDecorValidity(gridPos: Vec2): boolean {
        // 检查家具建筑放置是否有效
        if (gridPos.x < 0 || gridPos.y < 0) return false;

        const buildingSize = MapModel.getInstance().getBuildingSize(this.tileMaskNode.getComponent(UITransform).contentSize , this);

        // 检查是否超出边界
        if (gridPos.x + buildingSize.x > this.mapWidth ||
            gridPos.y + buildingSize.y > this.mapHeight) {
            return false;
        }

        let pack: Vec2[] = [];
        let hasDecorCollision = false;
        let hasAnyPlaceableFloor = false;
        for (let x = 0; x < buildingSize.x; x++) {
            for (let y = 0; y < buildingSize.y; y++) {
                const checkX1 = gridPos.x + x;
                const checkY1 = gridPos.y - y;

                pack.push(new Vec2(checkX1, checkY1));
                const cell = this.mapData[checkX1][checkY1];
                if (cell === 1 || cell === 3) {
                    hasAnyPlaceableFloor = true;
                }
                if (cell === 3) {
                    hasDecorCollision = true;
                }
                if (!this.enableDecorStackPlacement) {
                    if (cell !== 1 && cell !== 3) {
                        return false;
                    }
                }
            }
        }

        const currentDecorId = this.getCurrentDecorConfigId();
        const currentDecorCfg = AppConst.JSONManager.getItem("mapDecor", currentDecorId);
        const placeTypes = this.parseDecorTypeSet(currentDecorCfg?.place_type);

        const hasPlaceTypeConfig = currentDecorCfg?.place_type != null && String(currentDecorCfg.place_type).trim() !== '';

        // 允许堆叠：占格至少有一格落在可摆放区（地板/已有家具层）即可；不要求整只占满室内地板
        if (this.enableDecorStackPlacement) {
            if (!hasAnyPlaceableFloor) {
                return false;
            }
            if (!hasDecorCollision) {
                if (hasPlaceTypeConfig) {
                    return placeTypes.has('0');
                }
                return true;
            }
            return true;
        }

        let isResult = false;
        const gr: Vec2[] = [new Vec2(0, -1), new Vec2(0, 1), new Vec2(-1, 0), new Vec2(1, 0)];
        pack.forEach((child) => {
            for (let i = 0; i < gr.length; i++) {
                const element = gr[i];
                if (this.mapData[child.x + element.x][child.y + element.y] == 0) {
                    isResult = true;
                    break;
                }
            }

            if (isResult) {
                return;
            }
        });

        if (isResult) {
            return false;
        }

        // 没发生碰撞：有 place_type 时必须包含 0 才能落地；无 place_type 走旧逻辑（可落地）
        if (!hasDecorCollision) {
            if (hasPlaceTypeConfig) {
                return placeTypes.has('0');
            }
            return true;
        }

        // 发生堆叠碰撞时，只有配置了 place_type/decor_type 且匹配才允许
        if (!currentDecorId || !hasPlaceTypeConfig) {
            return false;
        }

        if (placeTypes.size === 0) {
            return false;
        }

        // 仅填 0 表示可放地板，但不可堆叠
        placeTypes.delete('0');
        if (placeTypes.size === 0) {
            return false;
        }

        const collisions = this.collectDecorCollisions(pack, this.moveItem?.decorKey || '');
        if (collisions.length === 0) {
            return false;
        }

        // 与碰撞家具逐个比对 decor_type，全部命中 place_type 才允许
        for (let i = 0; i < collisions.length; i++) {
            const hitDecorCfg = AppConst.JSONManager.getItem("mapDecor", collisions[i]);
            const decorType = String(hitDecorCfg?.decor_type ?? '').trim();
            if (!decorType || !placeTypes.has(decorType)) {
                return false;
            }
        }

        return true;
    }

    /** 家具占格写入 mapData：堆叠模式下仅覆盖原为地板(1)或家具层(3)的格，避免室外等格被误标为占用 */
    private markDecorFootprintMapData(gridPos: Vec2, buildingSize: Vec2) {
        for (let x = 0; x < buildingSize.x; x++) {
            for (let y = 0; y < buildingSize.y; y++) {
                const gridX = gridPos.x + x;
                const gridY = gridPos.y - y;
                if (this.enableDecorStackPlacement) {
                    const v = this.mapData[gridX][gridY];
                    if (v === 1 || v === 3) {
                        this.mapData[gridX][gridY] = 3;
                    }
                } else {
                    this.mapData[gridX][gridY] = 3;
                }
            }
        }
    }

    private checkPlacementFloorValidity(gridPos: Vec2): boolean {
        // 检查建筑放置是否有效
        if (gridPos.x < 0 || gridPos.y < 0) return false;

        const buildingSize = MapModel.getInstance().getBuildingSize(this.tileMaskNode.getComponent(UITransform).contentSize , this);

        // 检查是否超出边界
        if (gridPos.x + buildingSize.x > this.mapWidth ||
            gridPos.y + buildingSize.y > this.mapHeight) {
            return false;
        }

        for (let x = 0; x < buildingSize.x; x++) {
            for (let y = 0; y < buildingSize.y; y++) {
                const checkX1 = gridPos.x + x;
                const checkY1 = gridPos.y - y;

                if (this.mapData[checkX1][checkY1] !== 2) {
                    return false;
                }
            }
        }

        return true;
    }

    private placeBuilding(gridPos: Vec2, belong?: string) {
        const manager = MapManager.GetInstance();
        let size = this.curTileNode.getComponent(UITransform).contentSize;
        
        const buildingSize = MapModel.getInstance().getBuildingSize(size , this);
        // 放置建筑
        const worldPos = MapModel.getInstance().gridToWorld(gridPos , size , this);
        // 创建新的图块
        const tile = MapManager.GetInstance().getMapCurTileNode(this.curTileNode.name , this.curTileNode["tileType"]);

        const offset =
            manager.actionStatus == ActionStatus.PLANT || manager.actionStatus == ActionStatus.FRAM
                ? this.getPointerOffsetForGrid(gridPos, size)
                : new Vec2(0, 0);
        tile.setPosition(worldPos.x + offset.x, worldPos.y + offset.y, worldPos.z);
        this.mapContainer.addChild(tile);
        // console.log(worldPos)
        // console.log(gridPos)
        // 加入
        if (!this.mapItems.has(`${gridPos.x},${gridPos.y}`)) {
            if (manager.actionStatus == ActionStatus.PLANT) {
                const previewScaleX = this.curTileNode?.getScale()?.x ?? 1;
                const flipX = previewScaleX < 0 ? -1 : 1;
                const tileScale = tile.getScale();
                tile.setScale(flipX, tileScale.y, tileScale.z);
                this.mapItems.set(`${gridPos.x},${gridPos.y}`, {
                    id: this.curTileNode.name + "#" + this.curTileNode["tileType"],
                    tile: tile,
                    tileType: "Plant",
                    flipX,
                    offsetX: offset.x,
                    offsetY: offset.y
                });
            } else if (manager.actionStatus == ActionStatus.FRAM) {
                const previewScaleX = this.curTileNode?.getScale()?.x ?? 1;
                const flipX = previewScaleX < 0 ? -1 : 1;
                const tileScale = tile.getScale();
                tile.setScale(flipX, tileScale.y, tileScale.z);
                this.mapItems.set(`${gridPos.x},${gridPos.y}`, {
                    id: this.curTileNode.name + "#Fram",
                    tile: tile,
                    tileType: "Fram",
                    flipX,
                    offsetX: offset.x,
                    offsetY: offset.y
                });
            } else if (manager.actionStatus == ActionStatus.FLOOR) {
                this.mapItems.set(`${gridPos.x},${gridPos.y}`, { id: tile.name, tile: tile, tileType: "Floor" });
                this.buildFloorPoints.push(gridPos);
            }
        }

        // 存储建筑数据
        // const buildingData: TileObjectData = {
        //     id: "",
        //     x: gridPos.x,
        //     y: gridPos.y,
        //     type: "",
        //     isWalkable: false
        // };

        // 更新网格数据（植物 / 农田摆件共用占格规则）
        for (let x = 0; x < buildingSize.x; x++) {
            for (let y = 0; y < buildingSize.y; y++) {
                const gridX = gridPos.x + x;
                const gridY = gridPos.y - y;
                if (y == 2) {
                    this.mapData[gridX][gridY] = 0;
                } else {
                    this.mapData[gridX][gridY] = 2;
                }
            }
        }
    }

    setTileSclect(){
        const size = this.curTileNode.getComponent(UITransform).contentSize;
        this.buildIcon.getComponent(UITransform).setContentSize(size);
        this.maskSp.getComponent(UITransform).setContentSize(size.width + 10, size.height + 10);
        this.tileMaskNode.getComponent(UITransform).setContentSize(size);
        this.buildControl.frame.setContentSize(size.width + 15, size.height + 15);

        const manager = MapManager.GetInstance();

        this.maskSp.color = new Color('#FFFFFF32');
        this.setTileMaskSp();
    }

    //草地预制件
    selectTileGroundById(id: string){
        if (this.curTileNode) {
            this.curTileNode.destroy();
        }
        
        this.isBuildSwitch = true
        this.chooseGroundId = parseInt(id)
        MapModel.getInstance().setMapGround(MapManager.GetInstance().getGroundAssetsStr()[this.chooseGroundId], 0 , this)

        this.curTileNode = MapManager.GetInstance().getTileGroundPrefab(id , this.OnCurTileBack , this);
        this.curTileNode.name = id;
        this.groundType = 0

        
        let cfg = AppConst.JSONManager.getItem("mapGround" , id)
        this.curTileNode.getComponent(UITransform).contentSize = new Size(cfg["size"] , cfg["size"])

        this.buildIcon.addChild(this.curTileNode);

        this.setTileSclect()
    }

    //点击房子地面
    OnClickFloorIcon(data){
        if (this.curTileNode) {
            this.curTileNode.destroy();
        }

        this.curTileNode = MapManager.GetInstance().getMapCurTileNode(data["id"] , data["tileType"]);

        this.curTileNode.name = data["id"];
        this.curTileNode["tileType"] = data["tileType"];

        this.buildIcon.addChild(this.curTileNode);

        this.setTileSclect()
    }

    //除了草坪之类的地面创建
    OnClickTileOhterIcon(data){
        if (this.curTileNode) {
            this.curTileNode.destroy();
        }

        this.curTileNode = MapManager.GetInstance().getMapCurTileNode(data["id"] , data["tileType"]);

        this.curTileNode.name = data["id"];
        this.curTileNode["tileType"] = data["tileType"];

        this.buildIcon.addChild(this.curTileNode);

        this.isBuildSwitch = true
        this.setTileSclect()
    }

    selectTileTypeById(id: string){
        if (this.curTileNode) {
            this.curTileNode.destroy();
        }
        this.curTileNode = MapManager.GetInstance().getTilePrefab(id , this.OnCurTileBack , this);
        this.curTileNode.name = id;

        this.buildIcon.addChild(this.curTileNode);

        this.setTileSclect()
    }

    OnCurTileBack(){
        let load = this.curTileNode.getComponent("PrefabLoad") as PrefabLoad
        const size = load.content.getComponent(UITransform).contentSize;

        if(!this.curTileNode.getComponent(UITransform)){
            this.curTileNode.addComponent(UITransform)
        }
        let uiform = this.curTileNode.getComponent(UITransform)
        uiform.contentSize = new Size(size.width , size.height)
        // this.curTileNode.getComponent(UITransform).contentSize = size

        this.buildIcon.getComponent(UITransform).setContentSize(size);
        this.maskSp.getComponent(UITransform).setContentSize(size.width + 10, size.height + 10);
        this.tileMaskNode.getComponent(UITransform).setContentSize(size);
        this.buildControl.frame.setContentSize(size.width + 15, size.height + 15);

        const manager = MapManager.GetInstance();
        if (manager.actionStatus == ActionStatus.NPC) {
            this.buildControl.npc_banner1.active = true;
        }

        this.maskSp.color = new Color('#FFFFFF32');
        this.setTileMaskSp();
    }

    // 设置当前安放的地块
    selectTileType(tilePrefab: Prefab, id: string) {
        if (this.curTileNode) this.curTileNode.destroy();
        this.curTileNode =Utils.instantiate(tilePrefab)
        this.curTileNode.name = id;
        this.buildIcon.addChild(this.curTileNode);

        const size = this.curTileNode.getComponent(UITransform).contentSize;
        this.buildIcon.getComponent(UITransform).setContentSize(size);
        this.maskSp.getComponent(UITransform).setContentSize(size.width + 10, size.height + 10);
        this.tileMaskNode.getComponent(UITransform).setContentSize(size);
        this.buildControl.frame.setContentSize(size.width + 15, size.height + 15);

        const manager = MapManager.GetInstance();
        if (manager.actionStatus == ActionStatus.NPC) {
            this.buildControl.npc_banner1.active = true;
        }

        this.maskSp.color = new Color('#FFFFFF32');
        this.setTileMaskSp();
    }

    // 设置移动的Mask
    selectMoveTile() {
        if (this.curTileNode) this.curTileNode.destroy();

        this.tileMaskNode.active = true;
        this.buildControl.detele.node.active = false;
        this.buildControl.move.node.active = true;
        this.buildControl.move.play('move_idle');

        const size = new Size(this.tileSize, this.tileSize);
        this.buildIcon.getComponent(UITransform).setContentSize(size);
        this.maskSp.getComponent(UITransform).setContentSize(size.width + 10, size.height + 10);
        this.tileMaskNode.getComponent(UITransform).setContentSize(size);
        this.buildControl.frame.setContentSize(size.width + 15, size.height + 15);

        this.maskSp.color = new Color('#FFFFFF32');

        this.curTileNode = null;
        this.setTileMaskSp();
        this.updateArrowSign(size);
        this.setArrowSignActive(false);
    }

    // 设置删除的Mask
    selectDeteleTile() {
        if (this.curTileNode) this.curTileNode.destroy();

        this.tileMaskNode.active = true;
        this.buildControl.move.node.active = false;
        this.buildControl.detele.node.active = true;
        this.buildControl.detele.play('detele_idle');

        const size = new Size(this.tileSize, this.tileSize);
        this.buildIcon.getComponent(UITransform).setContentSize(size);
        this.maskSp.getComponent(UITransform).setContentSize(size.width + 10, size.height + 10);
        this.tileMaskNode.getComponent(UITransform).setContentSize(size);
        this.buildControl.frame.setContentSize(size.width + 15, size.height + 15);

        this.maskSp.color = new Color('#FFFFFF32');

        this.curTileNode = null;
        this.setTileMaskSp();
        this.setArrowSignActive(false);
    }

    // 设置物品的地图为屏幕的中心点
    private setTileMaskSp() {
        const screenPos = this.mainCamera.worldToScreen(new Vec3(view.getVisibleSize().width / 2 + this.mainCamera.node.position.x, view.getVisibleSize().height / 2 + this.mainCamera.node.position.y, 0));
        const gridPos = MapModel.getInstance().worldPosToGride(new Vec2(screenPos.x, screenPos.y) , this);
        const localPos = MapModel.getInstance().gridToWorld(gridPos , null , this);
        const worldPos = this.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(localPos)
        this.tileMaskNode.setWorldPosition(worldPos);
    }

    curGride: Vec2 = new Vec2(0, 0);
    mobilePoint: Vec2 = new Vec2(0, 0);

    private updateSizeLabel() {
        this.mapContainer.getComponent(UITransform).setContentSize(this.mapWidth * this.tileSize, this.mapHeight * this.tileSize);
        this.disMapContainer.getComponent(UITransform).setContentSize(this.mapWidth * this.tileSize, this.mapHeight * this.tileSize);
        this.npcLayer.getComponent(UITransform).setContentSize(this.mapWidth * this.tileSize, this.mapHeight * this.tileSize);

        const uiTransform = this.mapContainer.getComponent(UITransform);
        if (!uiTransform) return;

        const size = uiTransform.contentSize;
        const halfWidth = size.width / 2 * this.mapContainer.scale.x;
        const halfHeight = size.height / 2 * this.mapContainer.scale.y;

        this.boundaryMin.set(
            this.mapContainer.position.x - halfWidth,
            this.mapContainer.position.y - halfHeight,
            0
        );

        this.boundaryMax.set(
            this.mapContainer.position.x + halfWidth,
            this.mapContainer.position.y + halfHeight,
            0
        );

        this.mainCamera.orthoHeight = this.currentOrthoSize;

        // 获取相机视口大小
        const viewportWidth = this.currentOrthoSize * view.getVisibleSize().width / 960;
        const viewportHeight = this.currentOrthoSize * view.getVisibleSize().height / 960;

        // 计算相机可移动的边界
        this.minXCamera = this.boundaryMin.x + viewportWidth / 2;
        this.maxXCamera = this.boundaryMax.x - viewportWidth / 2;
        this.minYCamera = this.boundaryMin.y + viewportHeight / 2;
        this.maxYCamera = this.boundaryMax.y - viewportHeight / 2;
    }

    /**
     * 进入地图时相机默认对准地图左上角（视口左上对齐地图左上）。
     * 依赖 updateSizeLabel 已更新边界与 min/maxCamera。
     */
    private snapCameraToMapTopLeftOnEnter(): void {
        if (!this.mainCamera?.node?.isValid) {
            return;
        }
        const z = this.mainCamera.node.position.z;
        let cx: number;
        let cy: number;
        // 视口小于地图：左上角 = 相机可取的最左 + 最高（见 updateSizeLabel）
        if (this.minXCamera <= this.maxXCamera && this.minYCamera <= this.maxYCamera) {
            cx = this.minXCamera;
            cy = this.maxYCamera;
        } else {
            // 视口大于地图某方向：相机居中避免非法区间
            cx = (this.boundaryMin.x + this.boundaryMax.x) * 0.5;
            cy = (this.boundaryMin.y + this.boundaryMax.y) * 0.5;
        }
        this.targetPos.set(cx, cy, z);
        this.mainCamera.node.setPosition(this.targetPos);
    }

    public getAllHouseData() {
        return this.allHouse;
    }

    public getDecor(npcId: number, oid: number): { tile: Node, tileType: string, width: number, height: number, belong?: string } {
        let decor = null;
        this.allHouse.forEach((value, key) => {
            if (value.npc && value.npc.id == `npc_${npcId}`) {
                value.decor.forEach((va, ps) => {
                    if (va.tile.name == `gear_${oid}`) {
                        decor = va;
                        return;
                    }
                })
                if (decor) {
                    return;
                }
            }
        })

        return decor;
    }

    private logDecorHoverDebug(gridPos: Vec2, belong?: string) {
        const currentName = this.curTileNode?.name || this.moveItem?.tile?.name || '';
        const currentId = this.curTileNode?.name || this.moveItem?.id || '';
        if (!currentName && !currentId) {
            return;
        }

        let matched: string[] = [];
        if (belong) {
            const house = this.allHouse.get(belong);
            if (house) {
                house.decor.forEach((value, key) => {
                    const posKey = this.getDecorPositionKey(key, value);
                    if (posKey === `${gridPos.x},${gridPos.y}`) {
                        matched.push(value.tile?.name || key);
                    }
                });
            }
        }

        matched = matched.filter(Boolean).sort();
        const state = `${gridPos.x},${gridPos.y}|${currentId}|${matched.join(',')}`;
        if (state === this.lastDecorHoverLogState) {
            return;
        }
        this.lastDecorHoverLogState = state;

        console.log(`[DECOR_DRAG] current_id=${currentId}, current_name=${currentName}, grid=${gridPos.x},${gridPos.y}`);
        if (matched.length > 0) {
            console.log(`[DECOR_STACK_MATCH] grid=${gridPos.x},${gridPos.y}, matched=${matched.join(' | ')}`);
        }
    }

    private buildDecorStackKey(gridPos: Vec2, tileName: string): string {
        this.decorStackSeed += 1;
        return `${gridPos.x},${gridPos.y}|${tileName}|${Date.now()}_${this.decorStackSeed}`;
    }

    private getDecorPositionKey(rawKey: string, decor: { position?: string }): string {
        if (decor?.position && decor.position.includes(',')) {
            return decor.position;
        }
        return rawKey.includes('|') ? rawKey.split('|')[0] : rawKey;
    }

    private getDecorPosition(rawKey: string, decor: { position?: string }): Vec2 {
        const posKey = this.getDecorPositionKey(rawKey, decor);
        const x = parseInt(posKey.split(',')[0]);
        const y = parseInt(posKey.split(',')[1]);
        return new Vec2(x, y);
    }

    private parseDecorTypeSet(raw: any): Set<string> {
        if (raw == null) {
            return new Set();
        }
        return new Set(
            String(raw)
                .split('#')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
        );
    }

    private extractDecorConfigId(nameOrId: string): string {
        if (!nameOrId) {
            return '';
        }
        const base = String(nameOrId).split('#')[0];
        if (base.startsWith('gear_')) {
            return base.replace('gear_', '');
        }
        return base;
    }

    private getCurrentDecorConfigId(): string {
        if (this.moveItem && this.moveItem.tileType === 'Decor') {
            return this.extractDecorConfigId(this.moveItem.id || this.moveItem.tile?.name || '');
        }
        if (this.curTileNode) {
            return this.extractDecorConfigId(this.curTileNode.name || '');
        }
        return '';
    }

    private collectDecorCollisions(cells: Vec2[], excludeDecorKey: string = ''): string[] {
        const hit = new Set<string>();
        this.allHouse.forEach((house) => {
            house.decor.forEach((value, key) => {
                if (excludeDecorKey && key === excludeDecorKey) {
                    return;
                }
                const anchor = this.getDecorPosition(key, value);
                const buildingSize = MapModel.getInstance().getBuildingSize(new Size(value.width, value.height), this);
                for (let x = 0; x < buildingSize.x; x++) {
                    for (let y = 0; y < buildingSize.y; y++) {
                        const coverX = anchor.x + x;
                        const coverY = anchor.y - y;
                        for (let c = 0; c < cells.length; c++) {
                            if (cells[c].x === coverX && cells[c].y === coverY) {
                                const cfgId = this.extractDecorConfigId(value.tile?.name || '');
                                if (cfgId) {
                                    hit.add(cfgId);
                                }
                                return;
                            }
                        }
                    }
                }
            });
        });
        return Array.from(hit);
    }

    private getTopDecorAtGrid(
        house: {
            decor: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string, position?: string, flipX?: number, offsetX?: number, offsetY?: number }>
        },
        gridPos: Vec2
    ): { key: string; value: { tile: Node, tileType: string, width: number, height: number, belong?: string, position?: string } } | null {
        let top: { key: string; value: { tile: Node, tileType: string, width: number, height: number, belong?: string, position?: string } } | null = null;
        house.decor.forEach((value, key) => {
            const posKey = this.getDecorPositionKey(key, value);
            if (posKey !== `${gridPos.x},${gridPos.y}`) {
                return;
            }
            if (!top || value.tile.getSiblingIndex() >= top.value.tile.getSiblingIndex()) {
                top = { key, value };
            }
        });
        return top;
    }

    private getTopDecorCoveringGrid(
        house: {
            decor: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string, position?: string, flipX?: number, offsetX?: number, offsetY?: number }>
        },
        gridPos: Vec2
    ): { key: string; value: { tile: Node, tileType: string, width: number, height: number, belong?: string, position?: string } } | null {
        let top: { key: string; value: { tile: Node, tileType: string, width: number, height: number, belong?: string, position?: string } } | null = null;
        house.decor.forEach((value, key) => {
            const anchor = this.getDecorPosition(key, value);
            const buildingSize = MapModel.getInstance().getBuildingSize(new Size(value.width, value.height), this);
            let covered = false;
            for (let x = 0; x < buildingSize.x && !covered; x++) {
                for (let y = 0; y < buildingSize.y; y++) {
                    if (anchor.x + x === gridPos.x && anchor.y - y === gridPos.y) {
                        covered = true;
                        break;
                    }
                }
            }
            if (!covered) {
                return;
            }
            if (!top || value.tile.getSiblingIndex() >= top.value.tile.getSiblingIndex()) {
                top = { key, value };
            }
        });
        return top;
    }

    private getTopDecorCoveringGridGlobal(
        gridPos: Vec2
    ): { belong: string; key: string; value: { tile: Node, tileType: string, width: number, height: number, belong?: string, position?: string } } | null {
        let top: { belong: string; key: string; value: { tile: Node, tileType: string, width: number, height: number, belong?: string, position?: string } } | null = null;
        this.allHouse.forEach((house, houseName) => {
            const cur = this.getTopDecorCoveringGrid(house, gridPos);
            if (!cur) {
                return;
            }
            if (!top || cur.value.tile.getSiblingIndex() >= top.value.tile.getSiblingIndex()) {
                top = { belong: houseName, key: cur.key, value: cur.value };
            }
        });
        return top;
    }

    private hasSameDecorAtGrid(
        house: {
            decor: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string, position?: string, flipX?: number, offsetX?: number, offsetY?: number }>
        },
        gridPos: Vec2,
        tileName: string
    ): boolean {
        let exists = false;
        house.decor.forEach((value, key) => {
            const posKey = this.getDecorPositionKey(key, value);
            if (posKey === `${gridPos.x},${gridPos.y}` && value.tile.name === tileName) {
                exists = true;
            }
        });
        return exists;
    }

    private hasDecorCoveringCell(
        house: {
            decor: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string, position?: string, flipX?: number, offsetX?: number, offsetY?: number }>
        },
        gridX: number,
        gridY: number,
        excludeKey: string = ''
    ): boolean {
        let covered = false;
        house.decor.forEach((value, key) => {
            if (value.tileType !== "Decor") {
                return;
            }
            if (excludeKey && key === excludeKey) {
                return;
            }
            const anchor = this.getDecorPosition(key, value);
            const buildingSize = MapModel.getInstance().getBuildingSize(new Size(value.width, value.height), this);
            for (let x = 0; x < buildingSize.x; x++) {
                for (let y = 0; y < buildingSize.y; y++) {
                    if (anchor.x + x === gridX && anchor.y - y === gridY) {
                        covered = true;
                        return;
                    }
                }
                if (covered) {
                    return;
                }
            }
        });
        return covered;
    }

    followCameraAction(tarPos: Vec3, _call: Function) {
        tween(this.mainCamera.node).to(1, { position: tarPos }).call(() => {
            _call && _call();
        }).start();
    }

    drawAutoBuildWall(){
        if(!this.curTileNode){
            EventSystem.send("ShowTips" , AppConst.LanguageManager.getTextByConfig(104))
            return    
        }
        const manager = MapManager.GetInstance();
        if (manager.actionStatus === ActionStatus.FLOOR && this.replaceIndoorFloorByDragRect()) {
            this.refreshWalkableDebugOverlayIfNeeded();
            this.sendWebMapInfoIfChanged();
            return;
        }

        if(!this.isDrawSelectionBox){
            if (this.lastSelectionFailReason === 'size') {
                this.showHouseSizeTips();
            }
            return
        }

        const rect = this.getInsetBuildRect();
        if (!rect) {
            return;
        }
        if (!this.isHouseRectSizeValid(rect.minX, rect.maxX, rect.minY, rect.maxY)) {
            this.showHouseSizeTips();
            return;
        }

        let startGrad = new Vec2(rect.minX , rect.minY)
        let currentGrad = new Vec2(rect.maxX , rect.maxY)
        const path = Utils.traverseRectangle(startGrad, currentGrad);
        const dragPoints: Vec2[] = path.map((p) => new Vec2(p.x , p.y))
        const candidates = RectangleHouseBuilder.collectBuildableRectangles({
            floorPoints: dragPoints,
            minWidth: this.houseMinWidth,
            minHeight: this.houseMinHeight,
            passExtraCheck: (cell) => this.checkPlacementValidity(cell)
        })

        if(candidates.length == 0) return;
        if(path.length >= 12){
            path.forEach((point, index) => {
                let gridPos = new Vec2(point.x , point.y)
                this.autoBuildWall(gridPos , false)
            });
            console.log("房子大小:" + path.length)
        }
        this.checkBuildHouse();
        this.sendWebMapInfoIfChanged();
    }

    // 自动化房屋建造
    autoBuildWall(gridPos: Vec2 , isCheckBuildHouse = true) {
        if (this.checkPlacementValidity(gridPos) && !this.containsArray(this.buildFloorPoints, gridPos)) {
            const size = this.curTileNode.getComponent(UITransform).contentSize;
            const buildingSize = MapModel.getInstance().getBuildingSize(size , this);
            
            // 放置建筑
            const worldPos = MapModel.getInstance().gridToWorld(gridPos , null , this);
            // 创建新的图块
            const tile = MapManager.GetInstance().getMapCurTileNode(this.curTileNode.name , this.curTileNode["tileType"]);
            tile.name = this.curTileNode.name + "#" + this.curTileNode["tileType"]
            tile["cfgId"] = this.curTileNode.name
            tile.setPosition(worldPos);
            this.homeWallTilemap.addChild(tile);
            this.buildFloorPoints.push(gridPos);
            this.houseItems.set(`${gridPos.x},${gridPos.y}`, { tile: tile, tileType: "Floor" });

            // 更新网格数据
            for (let x = 0; x < buildingSize.x; x++) {
                for (let y = 0; y < buildingSize.y; y++) {
                    const gridX = gridPos.x + x;
                    const gridY = gridPos.y - y;
                    this.mapData[gridX][gridY] = 1;
                }
            }
        }
    }

    checkBuildHouse() {
        const allHousePoints: Array<number[][]> = new Array<number[][]>();
        const groups = this.groupByAdjacency(this.buildFloorPoints);
        let hasBuiltHouse = false;

        for (let i = 0; i < groups.length; i++) {
            const element = groups[i];
            let floorPoints: number[][] = [];
            for (let j = 0; j < element.length; j++) {
                const pos = element[j];
                floorPoints.push([pos.x, pos.y]);
            }

            allHousePoints.push(floorPoints);
        }

        for (const house of allHousePoints) {
            let minX = house[0][0];
            let maxX = house[0][0];
            let minY = house[0][1];
            let maxY = house[0][1];
            for (let i = 1; i < house.length; i++) {
                const px = house[i][0];
                const py = house[i][1];
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
            }
            if (!this.isHouseRectSizeValid(minX, maxX, minY, maxY)) {
                this.showHouseSizeTips();
                continue;
            }

            if (MapModel.getInstance().isContinuousRectangle(house , this)) {

                for (let i = 0; i < house.length; i++) {
                    const child = house[i];
                    if (this.checkCloseHouse(v2(child[0], child[1])) == false) {
                        return;
                    }
                }

                let makeWalls: { pos: Vec2; _node: Node; dir?: string }[] = [];

                let topLeft = house[0];
                let topRight = house[0];
                let bottomLeft = house[0];
                let bottomRight = house[0];

                const outWallPoints: { pos: Vec2; _node: Node, dir?: string }[] = [];

                for (const point of house) {
                    // 左上角：x最小且y最小的点
                    if (point[0] < topLeft[0] || (point[0] === topLeft[0] && point[1] < topLeft[1])) {
                        topLeft = point;
                    }

                    // 右上角：x最大且y最小的点
                    if (point[0] > topRight[0] || (point[0] === topRight[0] && point[1] < topRight[1])) {
                        topRight = point;
                    }

                    // 左下角：x最小且y最小的点
                    if (point[0] < bottomLeft[0] || (point[0] === bottomLeft[0] && point[1] > bottomLeft[1])) {
                        bottomLeft = point;
                    }

                    // 右下角：x最大且y最小的点
                    if (point[0] > bottomRight[0] || (point[0] === bottomRight[0] && point[1] > bottomRight[1])) {
                        bottomRight = point;
                    }
                }

                for (let i = 0; i < house.length; i++) {
                    const element = house[i];

                    for (let j = 0; j < 4; j++) {
                        let pos = new Vec2(element[0], element[1])
                        let frame = null;

                        let dir = "";
                        if (j == 0) {
                            dir = "up";
                            pos.y -= 1;
                            frame = this.outWallSprites[0];
                        } else if (j == 1) {
                            dir = "down";
                            pos.y += 1;
                            frame = this.outWallSprites[1];
                        } 
                        else if (j == 2) {
                            dir = "left";
                            pos.x -= 1;
                            frame = this.outWallSprites[2];
                        } else if (j == 3) {
                            dir = "right";
                            pos.x += 1;
                            frame = this.outWallSprites[3];
                        }

                        const item = this.buildOutWall(pos, frame, dir);
                        if (item) {
                            outWallPoints.push(item);
                            // 门位只允许从左右和下边外墙中挑选
                            if (item.dir === 'left' || item.dir === 'right' || item.dir === 'down') {
                                makeWalls.push(item);
                            }

                            // 删除占位的地板
                            if (j == 0) {
                                if (this.houseItems.has(`${pos.x},${pos.y - 1}`)) {
                                    const item = this.houseItems.get(`${pos.x},${pos.y - 1}`);
                                    if (!item.belong) {
                                        item.tile && item.tile.destroy();
                                        this.houseItems.delete(`${pos.x},${pos.y - 1}`);

                                        for (let i = 0; i < this.buildFloorPoints.length; i++) {
                                            const element = this.buildFloorPoints[i];
                                            if (element.x == pos.x && element.y == pos.y - 1) {
                                                this.buildFloorPoints.splice(i, 1);
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                for (let i = 0; i < 1; i++) {
                    let pos = new Vec2(topLeft[0], topLeft[1]);
                    pos.x -= 1;
                    pos.y -= 1;
                    const item = this.buildOutWall(pos, this.outWallSprites[4], "topLeft");
                    item && outWallPoints.push(item);
                }

                for (let i = 0; i < 1; i++) {
                    let pos = new Vec2(topRight[0], topRight[1]);
                    pos.x += 1;
                    pos.y -= 1;
                    const item = this.buildOutWall(pos, this.outWallSprites[5], "topRight")
                    item && outWallPoints.push(item);
                }

                for (let i = 0; i < 1; i++) {
                    let pos = new Vec2(bottomLeft[0], bottomLeft[1]);
                    pos.x -= 1;
                    pos.y += 1;
                    const item = this.buildOutWall(pos, this.outWallSprites[6], "bottomLeft")
                    item && outWallPoints.push(item);
                }

                for (let i = 0; i < 1; i++) {
                    let pos = new Vec2(bottomRight[0], bottomRight[1]);
                    pos.x += 1;
                    pos.y += 1;
                    const item = this.buildOutWall(pos, this.outWallSprites[7], "bottomRight")
                    item && outWallPoints.push(item);
                }

                let posVec: Vec2[] = [];
                let openVec: Vec2[] = [];
                let houseItems: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string, dir: string }> = new Map();

                let out: Vec2[] = [];
                outWallPoints.forEach((pt) => {
                    const size = pt._node.getComponent(UITransform).contentSize;
                    houseItems.set(`${pt.pos.x},${pt.pos.y}`, { tile: pt._node, tileType: "OutWall", belong: `house_${this._houseIndex}`, width: size.width, height: size.height, dir: pt.dir })
                    const globalWall = this.houseItems.get(`${pt.pos.x},${pt.pos.y}`);
                    if (globalWall) {
                        globalWall.belong = `house_${this._houseIndex}`;
                        (globalWall as any).dir = pt.dir;
                    }
                    posVec.push(pt.pos);
                    out.push(pt.pos);
                })

                let _open: Vec2[] = [];
                const downWallCandidates = makeWalls.filter((pt) => pt.dir === 'down');
                const sideWallCandidates = makeWalls.filter((pt) => pt.dir === 'left' || pt.dir === 'right');
                // const selectedDoorWalls: { pos: Vec2; _node: Node; dir?: string }[] = [];
                // const doorOpenings: { pos: Vec2, dir: string }[] = [];

                // if (downWallCandidates.length > 0) {
                //     const downDoor = downWallCandidates[Math.floor(Math.random() * downWallCandidates.length)];
                //     selectedDoorWalls.push(downDoor);
                // }
                // if (sideWallCandidates.length > 0) {
                //     const sideDoor = sideWallCandidates[Math.floor(Math.random() * sideWallCandidates.length)];
                //     selectedDoorWalls.push(sideDoor);
                // }

                // for (let i = 0; i < selectedDoorWalls.length; i++) {
                //     const item = selectedDoorWalls[i];
                //     const localWall = houseItems.get(`${item.pos.x},${item.pos.y}`);
                //     const globalWall = this.houseItems.get(`${item.pos.x},${item.pos.y}`);
                //     if (localWall) localWall.tile = null;
                //     if (globalWall) globalWall.tile = null;
                //     item._node.destroy();
                //     _open.push(item.pos);
                //     if (item.dir === 'down' || item.dir === 'left' || item.dir === 'right') {
                //         doorOpenings.push({ pos: new Vec2(item.pos.x, item.pos.y), dir: item.dir });
                //     }

                //     const buildingSize = MapModel.getInstance().getBuildingSize(item._node.getComponent(UITransform).contentSize , this);
                //     // 更新网格数据
                //     for (let x = 0; x < buildingSize.x; x++) {
                //         for (let y = 0; y < buildingSize.y; y++) {
                //             const gridX = item.pos.x + x;
                //             const gridY = item.pos.y - y;
                //             // 下边墙开门时，保留室内地板，避免门口被挖掉一格
                //             if (item.dir === 'down' && y > 0) {
                //                 this.mapData[gridX][gridY] = 1;
                //             } else {
                //                 this.mapData[gridX][gridY] = 0;
                //             }
                //         }
                //     }
                //     // 保险：挖门后强制补回室内门口地板
                //     this.reinforceDoorFloor(item.pos, item.dir);
                // }


                let cfgId 
                house.forEach((pt) => {
                    const item = this.houseItems.get(`${pt[0]},${pt[1]}`);
                    item.belong = `house_${this._houseIndex}`;
                    let size = new Size(this.tileSize, this.tileSize);
                    if (item.tile) {
                        size = item.tile.getComponent(UITransform).contentSize;
                    }
                    cfgId = item.tile["cfgId"]
                    houseItems.set(`${pt[0]},${pt[1]}`, { tile: item.tile ? item.tile : null, tileType: "Floor", belong: `house_${this._houseIndex}`, width: size.width, height: size.height, dir: "" })

                    posVec.push(new Vec2(pt[0], pt[1]));
                })

                let gridCells: GridCellType[][] = this.buildSurround(posVec, openVec);

                const houseName = `house_${this._houseIndex}`;
                this.allHouse.set(houseName, 
                    { grid: posVec, base: houseItems, decor: new Map(), npc: null, cfgId : parseInt(cfgId), floorTileId: String(cfgId), floorRenderNode: null, floorPatchRenderNodes: [],
                        horWalls: new Map(), verWalls: new Map(), surround: gridCells, outWall: out, inWall: [], openWall: _open });
                this.refreshHouseFloorRenderNode(houseName);
                // for (let i = 0; i < doorOpenings.length; i++) {
                //     this.placeDoorForHouse(houseName, doorOpenings[i].pos, doorOpenings[i].dir);
                // }
                this._houseIndex++;
                hasBuiltHouse = true;

                house.forEach((pt) => {
                    for (let j = 0; j < this.buildFloorPoints.length; j++) {
                        const st = this.buildFloorPoints[j];
                        if (st.x == pt[0] && st.y == pt[1]) {
                            this.buildFloorPoints.splice(j, 1);
                            break;
                        }
                    }
                })
            }
        }

        // 测试态下画完房子后，立即刷新可行走调试层（蓝绿块）
        if (hasBuiltHouse && this.debugShowWalkable) {
            const walkableCells = MapModel.getInstance().buildWalkableCells(this);
            this.renderWalkableDebugOverlay(walkableCells);
        }
    }

    private setFloorTileVisualVisible(tile: Node | null, visible: boolean) {
        if (!tile) {
            return;
        }
        const rootSp = tile.getComponent(Sprite);
        if (rootSp) {
            rootSp.enabled = visible;
        }
        for (let i = 0; i < tile.children.length; i++) {
            const childSp = tile.children[i].getComponent(Sprite);
            if (childSp) {
                childSp.enabled = visible;
            }
        }
    }

    private refreshHouseFloorRenderNode(houseName: string) {
        const house = this.allHouse.get(houseName);
        if (!house) {
            return;
        }

        if (house.floorRenderNode && house.floorRenderNode.isValid) {
            house.floorRenderNode.destroy();
            house.floorRenderNode = null;
        }

        let minX = Number.MAX_SAFE_INTEGER;
        let maxX = Number.MIN_SAFE_INTEGER;
        let minY = Number.MAX_SAFE_INTEGER;
        let maxY = Number.MIN_SAFE_INTEGER;
        let floorCount = 0;
        const floorIdSet = new Set<string>();
        house.base.forEach((value, key) => {
            if (value.tileType !== "Floor") {
                return;
            }
            floorCount += 1;
            const tileName = value.tile?.name || '';
            const floorId = tileName.split('#')[0];
            if (floorId) {
                floorIdSet.add(floorId);
            }
            const x = parseInt(key.split(',')[0]);
            const y = parseInt(key.split(',')[1]);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        });
        if (floorCount <= 0) {
            return;
        }

        // 混合地板时保留逐格显示，避免 load 后被单一 tiled 覆盖导致颜色不一致
        if (floorIdSet.size > 1) {
            house.base.forEach((value) => {
                if (value.tileType === "Floor") {
                    this.setFloorTileVisualVisible(value.tile, true);
                }
            });
            return;
        }

        const innerWidth = maxX - minX - 1;
        const innerHeight = maxY - minY - 1;
        if (innerWidth <= 0 || innerHeight <= 0) {
            house.base.forEach((value) => {
                if (value.tileType === "Floor") {
                    this.setFloorTileVisualVisible(value.tile, true);
                }
            });
            return;
        }

        house.base.forEach((value, key) => {
            if (value.tileType !== "Floor") {
                return;
            }
            const x = parseInt(key.split(',')[0]);
            const y = parseInt(key.split(',')[1]);
            const isInner = x > minX && x < maxX && y > minY && y < maxY;
            this.setFloorTileVisualVisible(value.tile, !isInner);
        });

        const floorTileId = floorIdSet.size === 1
            ? Array.from(floorIdSet)[0]
            : String(house.floorTileId || house.cfgId || "");
        if (!floorTileId) {
            return;
        }
        const floorCfg = AppConst.JSONManager.getItem("mapFloor", floorTileId);
        if (!floorCfg || !floorCfg["image"]) {
            return;
        }

        const renderNode = new Node(`houseFloorRender_${houseName}`);
        const renderTransform = renderNode.addComponent(UITransform);
        renderTransform.setContentSize(innerWidth * this.tileSize, innerHeight * this.tileSize);
        const renderSprite = renderNode.addComponent(Sprite);
        renderSprite.type = Sprite.Type.TILED;
        renderSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const spLoad = renderNode.addComponent(PrefabLoad);
        spLoad.isTexture = true;
        spLoad.bundleName = "mapEditor";
        spLoad.url = floorCfg["image"] + "/spriteFrame";

        const topLeftCenter = MapModel.getInstance().gridToWorld(new Vec2(minX + 1, minY + 1), null, this);
        const bottomRightCenter = MapModel.getInstance().gridToWorld(new Vec2(maxX - 1, maxY - 1), null, this);
        renderNode.setPosition(
            (topLeftCenter.x + bottomRightCenter.x) * 0.5,
            (topLeftCenter.y + bottomRightCenter.y) * 0.5,
            topLeftCenter.z
        );
        this.homeWallTilemap.addChild(renderNode);
        renderNode.setSiblingIndex(0);
        house.floorRenderNode = renderNode;
    }

    // 构建外墙
    private reinforceDoorFloor(doorPos: Vec2, dir?: string) {
        let floorX = doorPos.x;
        let floorY = doorPos.y;
        if (dir === 'down') {
            floorY = doorPos.y - 1;
        } else if (dir === 'up') {
            floorY = doorPos.y + 1;
        } else if (dir === 'left') {
            floorX = doorPos.x + 1;
        } else if (dir === 'right') {
            floorX = doorPos.x - 1;
        } else {
            return;
        }

        if (floorX < 0 || floorX >= this.mapWidth || floorY < 0 || floorY >= this.mapHeight) {
            return;
        }
        this.mapData[floorX][floorY] = 1;
    }

    private getHouseDoorNodeName(houseName: string, doorPos: Vec2, doorSkin: 'door1' | 'cebianDoor1'): string {
        return `${doorSkin}_${houseName}_${doorPos.x}_${doorPos.y}`;
    }

    private placeDoorForHouse(houseName: string, doorPos: Vec2, dir: string, doorDecorId: string = '', extraYOffset: number = 0) {
        const useSideDoor = dir === 'left' || dir === 'right';
        const doorSkin: 'door1' | 'cebianDoor1' = useSideDoor ? 'cebianDoor1' : 'door1';
        const doorName = this.getHouseDoorNodeName(houseName, doorPos, doorSkin);
        const existsDoor = this.homeWallTilemap.getChildByName(doorName);
        if (existsDoor) {
            existsDoor.destroy();
        }

        const doorNode = new Node(doorName);
        const tr = doorNode.addComponent(UITransform);
        tr.setContentSize(this.tileSize, this.tileSize);
        doorNode.addComponent(Sprite);

        const loader = doorNode.addComponent(PrefabLoad);
        loader.bundleName = "mapEditor";
        loader.isTexture = true;
        if (doorDecorId) {
            const mapDecor = AppConst.JSONManager.getItem("mapDecor", doorDecorId);
            loader.url = mapDecor?.image ? `${mapDecor.image}/spriteFrame` : (useSideDoor ? "door/cebianDoor1/spriteFrame" : "door/door1/spriteFrame");
        } else {
            loader.url = useSideDoor ? "door/cebianDoor1/spriteFrame" : "door/door1/spriteFrame";
        }

        const worldPos = MapModel.getInstance().gridToWorld(doorPos, null, this);
        if (useSideDoor) {
            const inwardOffsetX = dir === 'left' ? this.sideDoorInsetX : (dir === 'right' ? -this.sideDoorInsetX : 0);
            doorNode.setPosition(worldPos.x + this.sideDoorOffsetX + inwardOffsetX, worldPos.y + this.sideDoorOffsetY + extraYOffset, worldPos.z);
        } else {
            doorNode.setPosition(worldPos.x + this.bottomDoorOffsetX, worldPos.y + this.bottomDoorOffsetY + extraYOffset, worldPos.z);
        }
        this.homeWallTilemap.addChild(doorNode);
    }

    private clearHouseDoors(houseName: string) {
        if (!houseName) {
            return;
        }
        const bottomPrefix = `door1_${houseName}_`;
        const sidePrefix = `cebianDoor1_${houseName}_`;
        const children = [...this.homeWallTilemap.children];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child && (child.name.startsWith(bottomPrefix) || child.name.startsWith(sidePrefix))) {
                child.destroy();
            }
        }
    }

    buildOutWall(pos: Vec2, frame: SpriteFrame, dir: string = ''): { pos: Vec2; _node: Node, dir: string } {
        if (this.checkPlacementValidity(pos)) {
            let islike = this.containsArray(this.buildFloorPoints, pos);

            if (!islike) {
                const wall = instantiate(this.wallPrefab);
                wall.getComponent(Sprite).spriteFrame = frame;
                // 放置建筑
                const worldPos = MapModel.getInstance().gridToWorld(pos, wall.getComponent(UITransform).contentSize , this);
                wall.setPosition(worldPos);
                this.homeWallTilemap.addChild(wall);
                this.houseItems.set(`${pos.x},${pos.y}`, { tile: wall, tileType: "OutWall", dir: dir } as any);

                const buildingSize = MapModel.getInstance().getBuildingSize(wall.getComponent(UITransform).contentSize , this);
                // 更新网格数据
                for (let x = 0; x < buildingSize.x; x++) {
                    for (let y = 0; y < buildingSize.y; y++) {
                        const gridX = pos.x + x;
                        const gridY = pos.y - y;

                        // 处理上面墙 缩进一格
                        // if (dir == "up" && y == 0) {
                        //     this.mapData[gridX][gridY] = 1;
                        // } else {
                        //     this.mapData[gridX][gridY] = 2;
                        // }
                        this.mapData[gridX][gridY] = 2;
                    }
                }

                return { pos: pos, _node: wall, dir: dir };
            }
        }

        return null;
    }

    /** 滚轮拉近极限：越小越能放大细节（视野越窄） */
    @property({ type: CCInteger, displayName: 'MinOrthoSize', tooltip: '正交相机 orthoHeight 下限。数值越小越能拉近；农场看清格子可设 200～320。' })
    public minOrthoSize: number = 280;

    /** 滚轮拉远极限：越大越能缩小（一屏看到越多地图）；农场必须足够大，否则默认远景会被夹住 */
    @property({ type: CCInteger, displayName: 'MaxOrthoSize', tooltip: 'orthoHeight 上限。想看更大范围请提高（农场大地图常见 1400～2200）。' })
    public maxOrthoSize: number = 1800;

    /** 非农场进入地图时的默认 orthoHeight（同类地图可在编辑器里改） */
    @property({ type: CCInteger, displayName: '进入默认视野', tooltip: '进入场景首次应用的 orthoHeight，越大一屏看到越多；须在 Min～Max 之间才会生效满值。' })
    public defaultEntryOrthoSize: number = 850;

    /** mapGameType==农场 进入时的默认视野（更大以便概览大地图） */
    @property({ type: CCInteger, displayName: '农场进入默认视野', tooltip: '农场建议 1100～1600；若 MaxOrthoSize 偏小会被裁到上限。' })
    public farmEntryOrthoSize: number = 1200;

    public wheelZoomStep: number = 60;

    /** 首次进入：按地图类型设 currentOrthoSize，并夹在 [minOrthoSize, maxOrthoSize] */
    private applyEntryCameraOrthoPreferred(): void {
        let target = this.defaultEntryOrthoSize;
        if (this.mapGameType === 0) {
            target = this.farmEntryOrthoSize;
        }
        this.currentOrthoSize = Math.max(this.minOrthoSize, Math.min(this.maxOrthoSize, target));
    }

    public zoomCamera(delta : number){
        const next = this.currentOrthoSize + delta
        this.currentOrthoSize = Math.max(this.minOrthoSize , Math.min(this.maxOrthoSize , next))

        this.updateSizeLabel()
        if(this.targetPos){
            this.targetPos.x = Math.max(this.minXCamera , Math.min(this.maxXCamera , this.targetPos.x))
            this.targetPos.y = Math.max(this.minYCamera , Math.min(this.maxYCamera , this.targetPos.y))
            this.mainCamera.node.setPosition(this.targetPos)
        }
    }

    public loadHourse(){
        const manager = MapManager.GetInstance();
        for (let i = 0; i < this.allMapAssetsData.House.length; i++) {
            const element = this.allMapAssetsData.House[i];
            let cfgId
            let floorPoints: number[][] = [];
            for (let j = 0; j < element.Floor.length; j++) {
                const floor = element.Floor[j];
                const gridPos = new Vec2(parseInt(floor.position.split(',')[0]), parseInt(floor.position.split(',')[1]))

                floorPoints.push([gridPos.x, gridPos.y]);

                let idAry = floor.id.split("#")
                cfgId = idAry[0]
                const tile = MapManager.GetInstance().getMapCurTileNode(idAry[0] , idAry[1]);
                const size = tile.getComponent(UITransform).contentSize;
                const buildingSize = MapModel.getInstance().getBuildingSize(size , this);

                const worldPos = MapModel.getInstance().gridToWorld(gridPos, size , this);
                tile.name = floor.id
                tile.setPosition(worldPos);
                this.homeWallTilemap.addChild(tile);
                this.houseItems.set(`${gridPos.x},${gridPos.y}`, { tile: tile, tileType: "Floor" });

                // 更新网格数据
                for (let x = 0; x < buildingSize.x; x++) {
                    for (let y = 0; y < buildingSize.y; y++) {
                        const gridX = gridPos.x + x;
                        const gridY = gridPos.y - y;
                        this.mapData[gridX][gridY] = 1;
                    }
                }
            }

            let makeWalls: { pos: Vec2, doorDecorId?: string }[] = [];
            element.OpenWall.forEach((pos) => {
                const rawPos = String((pos as any).position || '');
                const posPart = rawPos.includes('|') ? rawPos.split('|')[0] : rawPos;
                const encodedDoorDecorId = rawPos.includes('|') ? rawPos.split('|')[1] : '';
                const xcx = new Vec2(parseInt(posPart.split(',')[0]), parseInt(posPart.split(',')[1]))
                makeWalls.push({ pos: xcx, doorDecorId: (pos as any).doorDecorId || encodedDoorDecorId || '' });
            })

            const outWallPoints: { pos: Vec2; _node: Node, dir?: string }[] = [];

            let topLeft = floorPoints[0];
            let topRight = floorPoints[0];
            let bottomLeft = floorPoints[0];
            let bottomRight = floorPoints[0];

            for (const point of floorPoints) {
                // 左上角：x最小且y最小的点
                if (point[0] < topLeft[0] || (point[0] === topLeft[0] && point[1] < topLeft[1])) {
                    topLeft = point;
                }

                // 右上角：x最大且y最小的点
                if (point[0] > topRight[0] || (point[0] === topRight[0] && point[1] < topRight[1])) {
                    topRight = point;
                }

                // 左下角：x最小且y最小的点
                if (point[0] < bottomLeft[0] || (point[0] === bottomLeft[0] && point[1] > bottomLeft[1])) {
                    bottomLeft = point;
                }

                // 右下角：x最大且y最小的点
                if (point[0] > bottomRight[0] || (point[0] === bottomRight[0] && point[1] > bottomRight[1])) {
                    bottomRight = point;
                }
            }

            for (let i = 0; i < floorPoints.length; i++) {
                const element = floorPoints[i];

                for (let j = 0; j < 4; j++) {
                    let pos = new Vec2(element[0], element[1])
                    let frame = null;

                    let dir = "";
                    if (j == 0) {
                        dir = "up";
                        pos.y -= 1;
                        frame = this.outWallSprites[0];
                    } else if (j == 1) {
                        dir = "down";
                        pos.y += 1;
                        frame = this.outWallSprites[1];
                    } else if (j == 2) {
                        dir = "left";
                        pos.x -= 1;
                        frame = this.outWallSprites[2];
                    } else if (j == 3) {
                        dir = "right";
                        pos.x += 1;
                        frame = this.outWallSprites[3];
                    }

                    const item = this.buildOutWall(pos, frame, dir);
                    if (item) {
                        outWallPoints.push(item);
                    }
                }
            }

            for (let i = 0; i < 1; i++) {
                let pos = new Vec2(topLeft[0], topLeft[1]);
                pos.x -= 1;
                pos.y -= 1;
                const item = this.buildOutWall(pos, this.outWallSprites[4], "topLeft");
                item && outWallPoints.push(item);
            }

            for (let i = 0; i < 1; i++) {
                let pos = new Vec2(topRight[0], topRight[1]);
                pos.x += 1;
                pos.y -= 1;
                const item = this.buildOutWall(pos, this.outWallSprites[5], "topRight")
                item && outWallPoints.push(item);
            }

            for (let i = 0; i < 1; i++) {
                let pos = new Vec2(bottomLeft[0], bottomLeft[1]);
                pos.x -= 1;
                pos.y += 1;
                const item = this.buildOutWall(pos, this.outWallSprites[6], "bottomLeft")
                item && outWallPoints.push(item);
            }

            for (let i = 0; i < 1; i++) {
                let pos = new Vec2(bottomRight[0], bottomRight[1]);
                pos.x += 1;
                pos.y += 1;
                const item = this.buildOutWall(pos, this.outWallSprites[7], "bottomRight")
                item && outWallPoints.push(item);
            }

            let posVec: Vec2[] = [];
            let openVec: Vec2[] = [];
            let houseItems: Map<string, { tile: Node, tileType: string, width: number, height: number, belong?: string, dir: string }> = new Map();

            let out: Vec2[] = [];
            outWallPoints.forEach((pt) => {
                const size = pt._node.getComponent(UITransform).contentSize;
                houseItems.set(`${pt.pos.x},${pt.pos.y}`, { tile: pt._node, tileType: "OutWall", belong: `house_${this._houseIndex}`, width: size.width, height: size.height, dir: pt.dir })
                const globalWall = this.houseItems.get(`${pt.pos.x},${pt.pos.y}`);
                if (globalWall) {
                    globalWall.belong = `house_${this._houseIndex}`;
                    (globalWall as any).dir = pt.dir;
                }
                posVec.push(pt.pos);
                out.push(pt.pos);
            })

            let _open: Vec2[] = [];
            const doorOpenings: { pos: Vec2, dir: string, doorDecorId?: string }[] = [];
            const openWallDoorDecorIdMap = new Map<string, string>();
            while (makeWalls.length > 0) {
                const item = makeWalls.shift();
                const key = `${item.pos.x},${item.pos.y}`;
                const dir = houseItems.get(key)?.dir ?? '';

                if(!this.houseItems.get(`${item.pos.x},${item.pos.y}`).tile){
                    console.log(item.pos)
                }
                const buildingSize = MapModel.getInstance().getBuildingSize(this.houseItems.get(`${item.pos.x},${item.pos.y}`).tile.getComponent(UITransform).contentSize , this);
                // 更新网格数据
                for (let x = 0; x < buildingSize.x; x++) {
                    for (let y = 0; y < buildingSize.y; y++) {
                        const gridX = item.pos.x + x;
                        const gridY = item.pos.y - y;
                        if (dir === 'down' && y > 0) {
                            this.mapData[gridX][gridY] = 1;
                        } else {
                            this.mapData[gridX][gridY] = 0;
                        }
                    }
                }
                // 保险：挖门后强制补回室内门口地板
                this.reinforceDoorFloor(item.pos, dir);

                houseItems.get(`${item.pos.x},${item.pos.y}`).tile = null;
                this.houseItems.get(`${item.pos.x},${item.pos.y}`).tile.destroy();
                this.houseItems.get(`${item.pos.x},${item.pos.y}`).tile = null;
                _open.push(item.pos);
                if (item.doorDecorId) {
                    openWallDoorDecorIdMap.set(`${item.pos.x},${item.pos.y}`, item.doorDecorId);
                }
                if (dir === 'down' || dir === 'left' || dir === 'right') {
                    doorOpenings.push({ pos: new Vec2(item.pos.x, item.pos.y), dir: dir, doorDecorId: item.doorDecorId || '' });
                }
            }


            floorPoints.forEach((pt) => {
                const item = this.houseItems.get(`${pt[0]},${pt[1]}`);
                item.belong = `house_${this._houseIndex}`;
                let size = new Size(this.tileSize, this.tileSize);
                if (item.tile) {
                    size = item.tile.getComponent(UITransform).contentSize;
                }
                houseItems.set(`${pt[0]},${pt[1]}`, { tile: item.tile ? item.tile : null, tileType: "Floor", belong: `house_${this._houseIndex}`, width: size.width, height: size.height, dir: "" })

                posVec.push(new Vec2(pt[0], pt[1]));
            })

            let gridCells: GridCellType[][] = this.buildSurround(posVec, openVec);

            const _name = `house_${this._houseIndex}`;
            this.allHouse.set(_name, {
                grid: posVec, base: houseItems, decor: new Map(), npc: null, horWalls: new Map(), verWalls: new Map(),
                surround: gridCells, outWall: out, inWall: [], openWall: _open, openWallDoorDecorIdMap: openWallDoorDecorIdMap, cfgId: cfgId, floorTileId: String(cfgId), floorRenderNode: null, floorPatchRenderNodes: []
            });
            this.refreshHouseFloorRenderNode(_name);
            for (let i = 0; i < doorOpenings.length; i++) {
                this.placeDoorForHouse(_name, doorOpenings[i].pos, doorOpenings[i].dir, doorOpenings[i].doorDecorId || '');
            }
            this._houseIndex++;
            const wallHouse = this.allHouse.get(_name);

            for (let t = 0; t < element.Wall.length; t++) {
                const lt = element.Wall[t];
                const gridPos = new Vec2(parseInt(lt.position.split(',')[0]), parseInt(lt.position.split(',')[1]))
                let _index = 1;

                if (lt.id == "wall_100") {
                    _index = 1;
                } else {
                    _index = 2;
                }

                const topLeft = this.getTopLeftPos(wallHouse.grid);

                let point = [gridPos.y - topLeft.y, gridPos.x - topLeft.x];
                if (_index == 1) {
                    wallHouse.surround[point[0] * 2][point[1] * 2] = GridCellType.WALL;
                    wallHouse.surround[point[0] * 2 + 1][point[1] * 2] = GridCellType.WALL;
                    wallHouse.surround[point[0] * 2][point[1] * 2 + 1] = GridCellType.WALL;
                    wallHouse.surround[point[0] * 2 + 1][point[1] * 2 + 1] = GridCellType.WALL;
                    point = [(gridPos.y - 1) - topLeft.y, gridPos.x - topLeft.x];

                    wallHouse.surround[point[0] * 2][point[1] * 2] = GridCellType.WALL;
                    wallHouse.surround[point[0] * 2 + 1][point[1] * 2] = GridCellType.WALL;
                    wallHouse.surround[point[0] * 2][point[1] * 2 + 1] = GridCellType.WALL;
                    wallHouse.surround[point[0] * 2 + 1][point[1] * 2 + 1] = GridCellType.WALL;
                } else {
                    wallHouse.surround[point[0] * 2][point[1] * 2] = GridCellType.WALL;
                    wallHouse.surround[point[0] * 2 + 1][point[1] * 2] = GridCellType.WALL;
                }

                // 放置建筑
                const prefab = manager.getTilePrefab(lt.id);
                const wall = instantiate(prefab);
                const size = wall.getComponent(UITransform).contentSize;
                const buildingSize = MapModel.getInstance().getBuildingSize(size , this);

                const worldPos = MapModel.getInstance().gridToWorld(gridPos, size , this);
                wall.setPosition(worldPos);
                this.mapContainer.addChild(wall);

                if (_index == 1) {
                    wallHouse.inWall.push(gridPos);
                    wallHouse.horWalls.set(`${gridPos.x},${gridPos.y}`, { tile: wall, tileType: "HorWall", width: size.width, height: size.height, belong: _name });
                    // 更新网格数据
                    for (let x = 0; x < buildingSize.x; x++) {
                        for (let y = 0; y < buildingSize.y; y++) {
                            const gridX = gridPos.x + x;
                            const gridY = gridPos.y - y;
                            // 处理上面墙 缩进一格
                            if (y == 0) {
                                this.mapData[gridX][gridY] = 1;
                            } else {
                                this.mapData[gridX][gridY] = 2;
                            }
                        }
                    }
                } else {
                    wallHouse.verWalls.set(`${gridPos.x},${gridPos.y}`, { tile: wall, tileType: "VerWall", width: size.width, height: size.height, belong: _name });
                }

                this.changeWallFrame(wallHouse.horWalls, wallHouse.verWalls, wallHouse.outWall);
            }

            for (let i = 0; i < element.Decor.length; i++) {
                const decor = element.Decor[i];
                
                const gridPos = new Vec2(parseInt(decor.position.split(',')[0]), parseInt(decor.position.split(',')[1]))
                // 创建新的图块
                let idAry = decor.id.split("#")
                const decorTypeRaw = idAry[1] || decor._type || "Decor";
                const decorType = this.isWallDacorationTileType(decorTypeRaw) ? "WallDacoration" : decorTypeRaw;
                const tile = MapManager.GetInstance().getMapCurTileNode(idAry[0] , decorType);
                tile.name = idAry[0] + "#" + decorType
                const flipX = decor.flipX != null ? decor.flipX : (decor as any).scaleX;
                if (flipX != null && flipX < 0) {
                    const scale = tile.getScale();
                    tile.setScale(-1, scale.y, scale.z);
                }

                const size = tile.getComponent(UITransform).contentSize;
                const buildingSize = MapModel.getInstance().getBuildingSize(size , this);

                const worldPos = MapModel.getInstance().gridToWorld(gridPos, size , this);
                const ox = Number((decor as any).offsetX ?? 0) || 0;
                const oy = Number((decor as any).offsetY ?? 0) || 0;
                tile.setPosition(worldPos.x + ox, worldPos.y + oy, worldPos.z);
                this.mapContainer.addChild(tile);

                wallHouse.decor.set(this.buildDecorStackKey(gridPos, tile.name), {
                    tile: tile,
                    tileType: decorType,
                    width: size.width,
                    height: size.height,
                    belong: _name,
                    position: `${gridPos.x},${gridPos.y}`,
                    flipX: flipX != null ? (flipX < 0 ? -1 : 1) : 1,
                    offsetX: ox,
                    offsetY: oy
                });

                if (decorType === "Decor") {
                    this.markDecorFootprintMapData(gridPos, buildingSize);
                }
            }
        }
    }

}


