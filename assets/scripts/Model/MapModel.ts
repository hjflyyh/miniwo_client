import { Sprite, UITransform , Animation, Vec2, Size, Vec3, sys, RenderTexture, director, view} from "cc";
import { AppConst } from "../AppConst";
import { network } from "./RequestData";
import { MapEditor } from "../../bundles/mapEditor/src/MapEditor";
// import { CaptureUtils } from "../../bundles/mapEditor/src/CaptureUtils";

export class MapModel {
    private static _instance: MapModel = null;

    public role_map_data = {}

    //地图列表数组
    public sceneMaps = []
    //存下标
    public maps = {}

    public mapEditAdminToken;
    public mapEditMapId;
    public mapEditData;

    //0根据地图列表进入地图，需要去掉所有UI   1进入编辑
    public showEditMapType = 0
    public showMapIndex = 0

    //当前选择的地图标签类型
    public EditMapTag = 0
    public currentMapId: number = 0
    public isInMap: boolean = false
    private isRecoveringAfterReconnect: boolean = false

    public static getInstance(): MapModel {
        if (!this._instance) {
            this._instance = new MapModel();
        }
        return this._instance;
    }

    public init(){
        EventSystem.addListent("WebSocketNotifications" , this.OnWSNotification , this)
        EventSystem.addListent("WebSocketMessage" , this.OnWebSocketMessage , this)
        EventSystem.addListent("LoginSuccess" , this.OnGameLoginSuccess , this)
        EventSystem.addListent("ForceLogout" , this.OnForceLogout , this)
    }

    public GetMapData(index){
        let map = this.sceneMaps[index]
        if(map != null)
        {
            return map
        }
    }

    public map_detail = null
    //type 0根据地图列表进入地图，需要去掉所有UI   1进入编辑
    public EnterMap(type , map_detail = null){
        this.map_detail = map_detail
        this.isInMap = true
        AppConst.PanelManager.CloseAll()
        this.showEditMapType = type
        AppConst.PanelManager.openView("res/View/Loading/EditMapLoading")
    }

    public requestJoinMap(mapId: number, fromReconnect: boolean = false){
        if(!mapId || mapId <= 0){
            return;
        }
        this.currentMapId = mapId;
        this.isRecoveringAfterReconnect = fromReconnect;
        let joinMapRequest = new network.JoinMapEequest();
        AppConst.WebSocketManager.send(joinMapRequest.toJSON(mapId));
    }

    private sendMatchJoin(matchId: string){
        if(!matchId){
            return;
        }
        let matchJoinRequest = new network.MatchJoinEequest();
        AppConst.WebSocketManager.send(matchJoinRequest.toJSON(matchId));
    }

    private OnGameLoginSuccess(){
        if(this.isInMap && this.currentMapId > 0){
            this.requestJoinMap(this.currentMapId, true);
        }
    }

    private OnForceLogout(){
        this.isInMap = false;
        this.currentMapId = 0;
        this.match_id = "";
        this.isRecoveringAfterReconnect = false;
    }

    public initGridData(map : MapEditor){
        // 初始化网格数据，0表示空，1表示已占用
        for (let x = 0; x < map.mapWidth; x++) {
            map.mapData[x] = [];
            for (let y = 0; y < map.mapHeight; y++) {
                map.mapData[x][y] = 0;
            }
        }
    }

    // 设置地图表面纹理
    setMapGround(_list: string[], tag: number , map : MapEditor) {
        map.neighbourTupleToTile = [];
        map.neighbourTupleToTile.push({ type1: 1, type2: 1, type3: 1, type4: 1, sp: _list[6] })
        map.neighbourTupleToTile.push({ type1: 2, type2: 2, type3: 2, type4: 1, sp: _list[13] })
        map.neighbourTupleToTile.push({ type1: 2, type2: 2, type3: 1, type4: 2, sp: _list[0] })
        map.neighbourTupleToTile.push({ type1: 2, type2: 1, type3: 2, type4: 2, sp: _list[8] })
        map.neighbourTupleToTile.push({ type1: 1, type2: 2, type3: 2, type4: 2, sp: _list[15] })
        map.neighbourTupleToTile.push({ type1: 2, type2: 1, type3: 2, type4: 1, sp: _list[1] })
        map.neighbourTupleToTile.push({ type1: 1, type2: 2, type3: 1, type4: 2, sp: _list[11] })
        map.neighbourTupleToTile.push({ type1: 2, type2: 2, type3: 1, type4: 1, sp: _list[3] })
        map.neighbourTupleToTile.push({ type1: 1, type2: 1, type3: 2, type4: 2, sp: _list[9] })
        map.neighbourTupleToTile.push({ type1: 2, type2: 1, type3: 1, type4: 1, sp: _list[5] })
        map.neighbourTupleToTile.push({ type1: 1, type2: 2, type3: 1, type4: 1, sp: _list[2] })
        map.neighbourTupleToTile.push({ type1: 1, type2: 1, type3: 2, type4: 1, sp: _list[10] })
        map.neighbourTupleToTile.push({ type1: 1, type2: 1, type3: 1, type4: 2, sp: _list[7] })
        map.neighbourTupleToTile.push({ type1: 2, type2: 1, type3: 1, type4: 2, sp: _list[14] })
        map.neighbourTupleToTile.push({ type1: 1, type2: 2, type3: 2, type4: 1, sp: _list[4] })
        map.neighbourTupleToTile.push({ type1: 2, type2: 2, type3: 2, type4: 2, sp: _list[12] })

        map.placeholderTilemap.forEach((pt) => {
            if (pt.empty) {
                pt._tileType = tag;
            }
        })

        map.groundType = tag;
    }

    public gridToWorld(gridPos: Vec2, size : Size , map : MapEditor): Vec3 {
        const startX = -map.tileSize * (map.mapWidth - 1) / 2;
        const startY = map.tileSize * (map.mapHeight - 1) / 2;

        // 网格坐标转世界坐标 - 考虑建筑大小居中
        let buildingSize = null;
        if (size) {
            buildingSize = this.getBuildingSize(size , map);
        } else {
            buildingSize = this.getBuildingSize(map.tileMaskNode.getComponent(UITransform).contentSize , map);
        }

        // 计算单元格位置
        const posX = startX + gridPos.x * map.tileSize + (buildingSize.x * map.tileSize) / 2 - map.tileSize / 2;
        const posY = startY - gridPos.y * map.tileSize + (buildingSize.y * map.tileSize) / 2 - map.tileSize / 2;

        return new Vec3(posX, posY, 0);
    }

    public worldPosToGride(screenPos: Vec2 , map : MapEditor): Vec2 {
        const worldPos = map.mainCamera.screenToWorld(new Vec3(screenPos.x, screenPos.y, 0))
        const localPos = map.mapContainer.getComponent(UITransform).convertToNodeSpaceAR(new Vec3(worldPos.x, worldPos.y, 0));

        // 4. 获取地图容器的锚点和尺寸
        const anchor = map.mapContainer.getComponent(UITransform).anchorPoint;

        // 5. 计算地图实际大小和网格信息
        const actualMapWidth = map.mapWidth * map.tileSize;
        const actualMapHeight = map.mapHeight * map.tileSize;

        // 6. 计算地图左下角在局部坐标系统中的位置
        // 注意：锚点(0.5, 0.5)表示原点在中心，(0,0)表示原点在左下角
        const mapBottomLeftX = -actualMapWidth * anchor.x;
        const mapBottomLeftY = actualMapHeight * anchor.y;

        // 7. 计算点击位置相对于地图左下角的偏移量
        const offsetX = localPos.x - mapBottomLeftX;
        const offsetY = mapBottomLeftY - localPos.y;

        // 8. 计算网格坐标（考虑浮点数精度问题）
        const gridX = Math.floor(offsetX / map.tileSize);
        const gridY = Math.floor(offsetY / map.tileSize);

        return new Vec2(gridX, gridY);
    }

    public getBuildingSize(size: Size ,  map : MapEditor): Vec2 {
        const width = Math.max(1, Math.floor(size.width / map.tileSize));
        const height = Math.max(1, Math.floor(size.height / map.tileSize));
        return new Vec2(width, height);
    }

    //分页显示地图列表，当前的页数
    public page = 0

    private OnWSNotification(data){
        if(data.code == network.ServerCode.CodeMapList){
            console.log("更新地图数据")
            let contentData = JSON.parse(data.content)
            this.page = contentData.page

            let maps = contentData.maps
            for(let m = 0 ; m < maps.length ;m++){
                let mapId = maps[m].id
                if(!this.maps[mapId]){
                    this.maps[mapId] = this.sceneMaps.length
                    this.sceneMaps.push(maps[m])
                }
            }
        }
    }

    public match_id;
    private OnWebSocketMessage(data){
        if(data["id"] == "join_map"){
            let payload = null;
            if (typeof data["payload"] === "string") {
                try {
                    payload = JSON.parse(data["payload"]);
                } catch {
                    payload = null;
                }
            } else {
                payload = data["payload"];
            }
            if(!payload || payload.success !== true){
                const msg = (payload && payload.message) ? payload.message : "加入地图失败";
                if(payload && payload.code !== "SESSION_REPLACED"){
                    EventSystem.send("ShowTips" , msg);
                }
                return;
            }
            this.currentMapId = Number(payload["map_id"] || this.currentMapId || 0);
            this.match_id = payload["match_id"]
            this.isInMap = true;

            if(this.isRecoveringAfterReconnect){
                this.isRecoveringAfterReconnect = false;
                this.sendMatchJoin(this.match_id);
                return;
            }
            console.log("收到消息进入地图")
            MapModel.getInstance().EnterMap(0 , payload.map_detail)
        }
    }

    public getHouseCenterPos(grids: Vec2[] , map : MapEditor): Vec3 {
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

        let Pos_1 = map.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(this.gridToWorld(topLeft , null , map));
        let Pos_2 = map.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(this.gridToWorld(topRight , null , map));
        let Pos_3 = map.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(this.gridToWorld(bottomLeft , null , map));
        let Pos_4 = map.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(this.gridToWorld(bottomRight , null , map));

        return new Vec3(Pos_3.x, Pos_3.y, 0);
    }

        // 存储地图数据
    public saveMapData(map : MapEditor , base64Image) {
        map.allMapAssetsData.Ground = [];
        map.allMapAssetsData.Plant = [];
        map.allMapAssetsData.Floor = [];
        map.allMapAssetsData.House = [];
        map.allMapAssetsData.Walkable = {
            width: map.mapWidth,
            height: map.mapHeight,
            cells: [],
        };
        map.placeholderTilemap.forEach((value, key) => {
            if (!value.empty) {
                map.allMapAssetsData.Ground.push({
                    id: `${value._tileType}`,
                    _type: "Ground",
                    position: key,
                    cfgId : value.cfgId
                })
            }
        })

        map.mapItems.forEach((value, key) => {
            if (value.tileType == "Plant") {
                map.allMapAssetsData.Plant.push({
                    id: value.id,
                    _type: "Plant",
                    position: key ,
                    // cfgId : value
                })
            }
        })

        map.houseItems.forEach((value, key) => {
            if (value.tileType == "Floor" && !value.belong) {
                map.allMapAssetsData.Floor.push({
                    id: value.tile.name,
                    _type: "Floor",
                    position: key
                })
            }
        })

        map.allHouse.forEach((value, key) => {
            let arr_1: { id: string, _type: string, position: string }[] = [];
            value.base.forEach((value_1, key_1) => {
                if (value_1.tileType == "Floor") {
                    arr_1.push({
                        id: value_1.tile.name,
                        _type: "Floor",
                        position: key_1
                    })
                }
            })

            let arr_2: { id: string, _type: string, position: string }[] = [];
            value.horWalls.forEach((value_2, key_2) => {
                if (value_2.tileType == "HorWall") {
                    arr_2.push({
                        id: value_2.tile.name,
                        _type: "HorWall",
                        position: key_2
                    })
                }
            })
            value.verWalls.forEach((value_3, key_3) => {
                if (value_3.tileType == "VerWall") {
                    arr_2.push({
                        id: value_3.tile.name,
                        _type: "VerWall",
                        position: key_3
                    })
                }
            })

            let arr_3: { id: string, oid: string, _type: string, position: string }[] = [];
            value.decor.forEach((value_4, key_4) => {
                if (value_4.tileType == "Decor" || value_4.tileType == "WallDacoration" || value_4.tileType == "WallDecor") {
                    const posKey = value_4.position && value_4.position.includes(',')
                        ? value_4.position
                        : (key_4.includes('|') ? key_4.split('|')[0] : key_4);
                    const decorType = value_4.tileType == "WallDecor" ? "WallDacoration" : value_4.tileType;
                    arr_3.push({
                        id: value_4.tile.name,
                        oid: value_4.tile.name.split('_')[1],
                        _type: decorType,
                        position: posKey
                    })
                }
            })

            let openWall: { position: string, doorDecorId?: string }[] = [];
            value.openWall.forEach((pos) => {
                const posKey = `${pos.x},${pos.y}`;
                const doorDecorId = value.openWallDoorDecorIdMap?.get(posKey) || '';
                if (doorDecorId) {
                    // 兼容后端可能忽略额外字段，资源id同时编码进 position
                    openWall.push({ position: `${posKey}|${doorDecorId}`, doorDecorId });
                } else {
                    openWall.push({ position: posKey });
                }
            })

            let _npc: { id: string, position: string, design: { npcName: string, npcIntro: string } } = null;
            if (value.npc) {
                _npc = { id: value.npc.id, position: value.npc.position, design: value.npc.design }
            }

            map.allMapAssetsData.House.push({
                Floor: arr_1,
                Wall: arr_2,
                OpenWall: openWall,
                Decor: arr_3,
            })
        })

        const walkableCells = this.buildWalkableCells(map);

        map.allMapAssetsData.Walkable = {
            width: map.mapWidth,
            height: map.mapHeight,
            cells: walkableCells,
        };

        const _data = JSON.stringify(map.allMapAssetsData);
        sys.localStorage.setItem("MapData", _data);
        console.log(_data);


        // let base64Image = '';
        // 截图改为直接抓主相机输出，保证与 mainCamera 看到的画面一致（中心、朝向、可见层）
        try {


            // CaptureUtils.captureScreenToBlob(rt, (blob) => {
            //     if (!blob) return;
            //     const reader = new FileReader();
            //     reader.onloadend = () => {
            //         base64Image = String(reader.result || '');
            //         if (base64Image) {
            //             console.log(base64Image)
            //             // sys.localStorage.setItem("MapDataPreview", base64Image);
            //         }
            //     };
            //     reader.readAsDataURL(blob);
            // });
        } catch (e) {
            console.warn("[saveMapData] capture preview failed", e);
        }

        if(AppConst.SDKManager.isEditMapingWeb){
            window.parent.postMessage({
                channel: 'miniwo-map-editor',
                source: 'miniwo-cocos',
                type: 'COCOS_SEND_MAP_DATA',
                data : _data,
                base64Image : base64Image
            }, '*');
        }
    }

    public buildWalkableCells(map: MapEditor): string[] {
        // 规则：
        // 1) 道路（placeholder 非空）可走
        // 2) 房间地板（mapData==1）可走
        // 3) 房间门（openWall）可走
        // 4) 家具格（mapData==3）与墙格（mapData==2）不可走，最终覆盖
        const walkableSet = new Set<string>();

        // 道路
        map.placeholderTilemap.forEach((value, key) => {
            if (!value.empty) {
                walkableSet.add(key);
            }
        });

        // 房间地板
        for (let x = 0; x < map.mapWidth; x++) {
            for (let y = 0; y < map.mapHeight; y++) {
                if (map.mapData[x][y] === 1) {
                    walkableSet.add(`${x},${y}`);
                }
            }
        }

        // 房间门（OpenWall 记录的是门洞锚点）
        // 门洞锚点可走；门洞相邻的室内地板格也可走（覆盖下墙/侧墙门）。
        map.allHouse.forEach((house) => {
            const floorSet = new Set<string>();
            if (house.grid && house.grid.length > 0) {
                for (let i = 0; i < house.grid.length; i++) {
                    floorSet.add(`${house.grid[i].x},${house.grid[i].y}`);
                }
            }

            house.openWall.forEach((pos) => {
                walkableSet.add(`${pos.x},${pos.y}`);

                const offsets = [
                    [0, -1],
                    [0, 1],
                    [-1, 0],
                    [1, 0],
                ];
                for (let i = 0; i < offsets.length; i++) {
                    const nx = pos.x + offsets[i][0];
                    const ny = pos.y + offsets[i][1];
                    if (nx < 0 || nx >= map.mapWidth || ny < 0 || ny >= map.mapHeight) {
                        continue;
                    }
                    if (floorSet.has(`${nx},${ny}`)) {
                        walkableSet.add(`${nx},${ny}`);
                    }
                }
            });
        });

        // 家具/墙体阻挡
        for (let x = 0; x < map.mapWidth; x++) {
            for (let y = 0; y < map.mapHeight; y++) {
                if (map.mapData[x][y] === 3 || map.mapData[x][y] === 2) {
                    walkableSet.delete(`${x},${y}`);
                }
            }
        }

        return Array.from(walkableSet).sort((a, b) => {
            const ax = parseInt(a.split(',')[0]);
            const ay = parseInt(a.split(',')[1]);
            const bx = parseInt(b.split(',')[0]);
            const by = parseInt(b.split(',')[1]);
            if (ay !== by) return ay - by;
            return ax - bx;
        });
    }

    lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    clampf(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    distanceSquared(x1, y1, x2, y2) {
        return Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
    }

    // 判断建造的地板是否为矩形
    isContinuousRectangle(points , map : MapEditor) {
        // 至少需要4个点
        if (points.length < 4) {
            return false;
        }

        // 检查是否能形成m×n的网格 (m≥2, n≥2)
        const count = points.length;
        const factors = this.getFactors(count);

        // 检查每种可能的m×n组合
        for (const m of factors) {
            const n = count / m;
            if (n < 2) continue; // 至少需要2行2列

            if (this.checkGridFormation(points, m, n)) {
                return true;
            }
        }

        return false;
    }

    getFactors(num) {
        const factors = [];
        for (let i = 2; i <= Math.sqrt(num); i++) {
            if (num % i === 0) {
                factors.push(i);
                if (i !== num / i) {
                    factors.push(num / i);
                }
            }
        }
        return factors.sort((a, b) => a - b);
    }

    

    checkGridFormation(points, m, n) {
        // 提取所有x和y坐标
        const xCoords = points.map(p => p[0]);
        const yCoords = points.map(p => p[1]);

        // 检查x坐标是否能分成n组，每组m个相同的值
        if (!this.checkUniformGroups(xCoords, n, m)) {
            return false;
        }

        // 检查y坐标是否能分成m组，每组n个相同的值
        if (!this.checkUniformGroups(yCoords, m, n)) {
            return false;
        }

        // 检查是否所有点的组合都存在
        return this.checkAllPointsExist(points, m, n);
    }

    

    checkUniformGroups(coords, groups, size) {
        if (coords.length !== groups * size) return false;

        // 排序后检查
        const sorted = coords.sort((a, b) => a - b);

        for (let i = 0; i < groups; i++) {
            const start = i * size;
            const value = sorted[start];
            for (let j = 1; j < size; j++) {
                if (sorted[start + j] !== value) {
                    return false;
                }
            }
        }

        return true;
    }

    checkAllPointsExist(points: Vec2[], m, n) {
        // 提取唯一的x和y值
        let num_1: number[] = points.map(p => p[0]);
        num_1 = num_1.filter((item, index) => {
            // 只保留第一次出现的元素
            return num_1.indexOf(item) === index;
        });
        let num_2: number[] = points.map(p => p[1]);
        num_2 = num_2.filter((item, index) => {
            // 只保留第一次出现的元素
            return num_2.indexOf(item) === index;
        });

        const xValues: number[] = num_1.sort((a, b) => a - b);
        const yValues: number[] = num_2.sort((a, b) => a - b);

        if (xValues.length != n || yValues.length != m) {
            return false;
        }

        // 创建点的集合用于快速查找
        const pointSet = new Set(points.map(p => `${p[0]},${p[1]}`));

        // 检查所有可能的组合
        for (const x of xValues) {
            for (const y of yValues) {
                if (!pointSet.has(`${x},${y}`)) {
                    return false;
                }
            }
        }

        return true;
    }
}