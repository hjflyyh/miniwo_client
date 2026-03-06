import { _decorator, assetManager, Camera, Canvas, Component, director, EventTouch, instantiate, KeyCode, Node, Prefab, Size, size, TiledLayer, TiledMap, Tween, tween, UITransform, v2, v3, Vec2, Vec3 } from 'cc';
import { NpcController } from './NpcController';
import { MapData, MapEditor } from './MapEditor';
import { MapManager } from './MapManager';
const { ccclass, property } = _decorator;

export const sleepFramePosX = [40, -61];
export const sleepFrameTime = 0.45;
export const bubbleTime = 0.7;

const PosAdapt = 1;
declare global {
    interface Window {
        farmGoSleep: any;
        farm: any;
        farmcook: any;
        farmeat: any;
        fieldReady: any;

        herdSleep: any;
        herdCook: any;
        herdDinning: any;

        bakerSleep: any;
        bakerCook: any;
        bakerDinning: any;

        GrocerSleep: any;
        GrocerCook: any;
        GrocerDinning: any;
        farmHarvest: any;
        farmStopSleep: any
    }
}

@ccclass('MapGameScene')
export class MapGameScene extends Component {
    @property({ type: [Node] })
    public otherNPCarr: Node[] = [];

    @property(Node)
    public playerLayer: Node = null;

    @property(Node)
    novaFoodNode: Node = null;

    @property(Node)
    aidenFoodNode: Node = null;

    @property(Node)
    leoFoodNode: Node = null;

    @property(Node)
    ivyFoodNode: Node = null;

    @property(Node)
    selenaFoodNode: Node = null;

    @property(Node)
    kaiFoodNode: Node = null;

    @property(Node)
    kaiDataNode: Node = null;

    @property(Node)
    novaWaterNode: Node = null;

    @property(Node)
    speakLayer: Node = null;

    @property(Prefab)
    replyNode: Prefab = null;

    @property(Prefab)
    speakNode: Prefab = null;

    @property(Prefab)
    speakNode_Ex: Prefab = null;

    @property(Node)
    itemLayer: Node = null;

    @property(Prefab)
    scneneItemNode: Prefab = null;

    // private _layerFloor: TiledLayer = null!;

    _npcSpeakObj = {};
    _npcTileArray: Vec2[] = [];
    _height = null;
    _typeComputerInfo = {};
    _initActionData = {};
    _myPlayerNode = null;
    _playerArr = [];
    _createTimeInfo = {};
    _coffeeNodeStatus = {};
    _version = null;
    _followNpcId = 0;

    mapEditor: MapEditor;

    private _isValid: boolean = true;

    protected onLoad(): void {
        if (!this.speakLayer || !this.replyNode || !this.speakNode || !this.speakNode_Ex) {
            console.log('Required properties are not set in the editor:', {
                speakLayer: !!this.speakLayer,
                replyNode: !!this.replyNode,
                speakNode: !!this.speakNode,
                speakNode_Ex: !!this.speakNode_Ex
            });
            return;
        }

        this._initData();
        
    }

    protected onDestroy(): void {
        this._isValid = false;
        
    }

    start() {
        
    }

    update(deltaTime: number) {

    }

    getMapScript() {
        return this;
    }

    initVoteInfo() {
        
    }

    _initData() {
        this.mapEditor = director.getScene().getComponentInChildren(MapEditor);
        this._height = this.node.getComponent(UITransform).contentSize.height;

    }

    setNPCPos(NPCs: any) {
        if (!NPCs) {
            return;
        }
    }

    updatMapData(param) {
        if (param.data && param.data.map) {
            const text = JSON.stringify(param.data.map);
            const mapData: MapData = JSON.parse(text);

            for (let i = 0; i < mapData.House.length; i++) {
                const element = mapData.House[i];
                if (element.npc) {
                    const id = element.npc.id.split("_")[1];
                    let replyNode = instantiate(this.replyNode);
                    this.speakLayer.addChild(replyNode);
                    this._npcSpeakObj["reply_" + id] = replyNode;
                    replyNode.active = false;
                    console.log("reply init finish");

                    let speakNode = instantiate(this.speakNode);
                    this.speakLayer.addChild(speakNode);
                    this._npcSpeakObj["speak_" + id] = speakNode;
                    speakNode.active = false;
                    console.log("speak init finish");

                    let speakNodeEx = instantiate(this.speakNode_Ex);
                    this.speakLayer.addChild(speakNodeEx);
                    this._npcSpeakObj["speakEx_" + id] = speakNodeEx;
                    speakNodeEx.active = false;
                    console.log("speakEx init finish");
                }
            }

            this.mapEditor && this.mapEditor.loadMapData(mapData);
        }
    }

    buildNpcActionCompent(npcid: string) {
        const id = npcid.split("_")[1];
        let replyNode = instantiate(this.replyNode);
        this.speakLayer.addChild(replyNode);
        this._npcSpeakObj["reply_" + id] = replyNode;
        replyNode.active = false;
        console.log("reply init finish");

        let speakNode = instantiate(this.speakNode);
        this.speakLayer.addChild(speakNode);
        this._npcSpeakObj["speak_" + id] = speakNode;
        speakNode.active = false;
        console.log("speak init finish");

        let speakNodeEx = instantiate(this.speakNode_Ex);
        this.speakLayer.addChild(speakNodeEx);
        this._npcSpeakObj["speakEx_" + id] = speakNodeEx;
        speakNodeEx.active = false;
        console.log("speakEx init finish");
    }

    NpcMoveAction(movePath) {

    }

    npcAIAction(param) {
        console.log(param);
    }

    selfActionData = { "requestId": 0, "playerId": 6049797165419601921, "type": 1, "command": 10007, "code": 0, "data": { "npcId": 10009, "actionId": 112, "bid": 0, "params": { "path": [{ "x": 17, "y": 82 }, { "x": 18, "y": 82 }, { "x": 18, "y": 81 }, { "x": 18, "y": 80 }, { "x": 18, "y": 79 }, { "x": 18, "y": 78 }, { "x": 18, "y": 77 }, { "x": 18, "y": 76 }, { "x": 18, "y": 75 }, { "x": 18, "y": 74 }, { "x": 18, "y": 73 }, { "x": 18, "y": 72 }, { "x": 18, "y": 71 }, { "x": 18, "y": 70 }, { "x": 18, "y": 69 }, { "x": 18, "y": 68 }, { "x": 18, "y": 67 }, { "x": 18, "y": 66 }, { "x": 18, "y": 65 }, { "x": 18, "y": 64 }, { "x": 18, "y": 63 }, { "x": 18, "y": 62 }, { "x": 18, "y": 61 }, { "x": 18, "y": 60 }, { "x": 18, "y": 59 }, { "x": 18, "y": 58 }, { "x": 18, "y": 57 }, { "x": 18, "y": 56 }, { "x": 18, "y": 55 }, { "x": 18, "y": 54 }, { "x": 18, "y": 53 }, { "x": 18, "y": 52 }, { "x": 18, "y": 51 }, { "x": 18, "y": 50 }, { "x": 18, "y": 49 }, { "x": 18, "y": 48 }, { "x": 18, "y": 47 }, { "x": 18, "y": 46 }, { "x": 18, "y": 45 }, { "x": 19, "y": 45 }] }, "startTime": 1753882232389, "endTime": 1753882240189, "focus": 0 } }
    selfActionData_2 = { "requestId": 0, "type": 1, "command": 10007, "code": 0, "data": { "npcId": 10009, "actionId": 106, "bid": 0, "params": { "oid": "10009_100" }, "startTime": 1753882240250, "endTime": 1753882250250, "focus": 0 } };

    selfActionData_3 = { "requestId": 0, "type": 1, "command": 10007, "code": 0, "data": { "npcId": 10009, "actionId": 110, "bid": 0, "params": { "npcId": 6.049447512E9, "content": "Leo stands in front of the canvas and paints a flower using tools from the box." }, "startTime": 1754480248239, "endTime": 1754480248239, "focus": 0 } }

    _getTilePos(posInPixel: { x: number; y: number }) {
        const mapSize = this.node.getComponent(UITransform).contentSize;
        const tileSize = size(32, 32);
        const x = Math.floor(posInPixel.x / tileSize.width);
        const y = Math.floor((mapSize.height - posInPixel.y) / tileSize.height);
        return new Vec2(x, y - 1);
    }

    onbtnUp() {
        this.otherNPCarr[0].getComponent(NpcController).setUpAnimation()
    }

    onbtnDown() {
        this.otherNPCarr[0].getComponent(NpcController).setDownAnimation()
    }

    onbtnleft() {
        this.otherNPCarr[0].getComponent(NpcController).setLeftAnimation()
    }

    onbtnright() {
        this.otherNPCarr[0].getComponent(NpcController).setRightAnimation()
    }

    getRandomElements(arr, count) {
        // 创建一个数组的副本以避免修改原始数组  
        let shuffled = arr.slice();
        let result = [];

        // 当还需要选择的元素数量大于0，且数组还有元素时继续  
        while (count > 0 && shuffled.length > 0) {
            // 从数组中随机选择一个索引  
            let randomIndex = Math.floor(Math.random() * shuffled.length);
            // 将选中的元素添加到结果数组中  
            result.push(shuffled[randomIndex]);
            // 从数组中移除该元素  
            shuffled.splice(randomIndex, 1);
            // 减少还需要选择的元素数量  
            count--;
        }
        return result;
    }

    getRandomPosition() {
        let dirX = Math.random() > 0.5 ? 1 : -1;
        let dirY = Math.random() > 0.5 ? 1 : -1;
        let posY = 1400 * dirY;
        let posX = dirX * 1400 * Math.random();

        return v3(posX, posY, 0);
    }

    getPlayerNode() {
        return this._myPlayerNode;
    }

    screenToWorld(screenPosition: Vec2): Vec3 {
        // 调用摄像机的 screenToWorld 方法
        const worldPosition = new Vec3();
        director.getScene().getComponentInChildren(Camera).screenToWorld(new Vec3(screenPosition.x, screenPosition.y, 0), worldPosition);
        return worldPosition;
    }

    getVersion() {
        return this._version;
    }

    getFollowNpcId() {
        return this._followNpcId;
    }

    // 跟踪npc截图
    followNpcActionCapture(tarPos: Vec3, npcId: number, oid: string) {
        const manager = MapManager.GetInstance();
        manager.getMapEditor().followCameraAction(tarPos, () => {
            manager.getMapEditor().targetPos = tarPos;
            manager.getMapEditorUI().onCaptureCurrentScene(npcId, oid)
        });
    }
}


