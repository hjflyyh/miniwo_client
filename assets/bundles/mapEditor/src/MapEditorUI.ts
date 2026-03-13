import { _decorator, assetManager, Button, Canvas, Color, Component, director, EditBox, EventHandler, EventTouch, find , Label, log, Node, Prefab, RenderTexture, SceneAsset, ScrollView, Sprite, SpriteFrame, sys, Texture2D, UITransform, Vec2, Vec3, view } from 'cc';
import { CaptureUtils } from './CaptureUtils';
import { MapManager, ActionStatus } from './MapManager';
import { MapEditorUIConfig, NpcActionConfigs } from 'db://assets/src/common/MapEditorUIConfig';
import { EventType } from 'db://assets/src/EventType';
import { MapAssetsManager } from '../../../src/common/MapAssetsManager';
import { PrefabLoad } from '../../../scripts/Utils/PrefabLoad';
import { InfiniteList } from '../../../plugin/InfiniteList/InfiniteList';
import { GroundDataSource } from './UI/GroundDataSource';
import { MapModel } from '../../../scripts/Model/MapModel';
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
    aiStartView: Node = null;

    @property(Node)
    scene_Camera: Node = null;

    @property(Node)
    backBtn: Node = null;

    @property(Node)
    cancelBtn: Node = null;

    @property(Node)
    npcHeadNode: Node = null;

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

    protected onLoad(): void {
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
                element.tool.on(Node.EventType.TOUCH_END, this.onClickTool, this);
            }
        }

        this.buttonStepPack.forEach((child) => {
            child.getComponentsInChildren(Sprite).forEach((in_child) => {
                in_child.grayscale = true;
            })
            child.off(Node.EventType.TOUCH_END, this.onClickTool, this);
        })

        this.tileContent.active = false;
        this.saveConfirmDialog.active = false;
        this.aiStartView.active = false;

        this.backBtn.active = false;
        if(MapModel.getInstance().showEditMapType == 0){
            this.node.active = false
        }
    }

    protected onDestroy(): void {
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
    }

    update(deltaTime: number) {
        if (this.isSave && this.saveIndex == 3) {
            this.sendDramaStart();
            this.saveIndex = 0;
            this.isSave = false;
        }
    }

    onInitTwitterView(param) {
    }

    OnClickFloorIcon(){
        this.tileContent.active = false;
    }

    OnClickTileOhterIcon(data){
        this.tileContent.active = false;
    }

    OnClickTileGroundIcon(data){
        MapManager.GetInstance().tileId = data;
        MapManager.GetInstance().RefreshTileGroundById();
        this.tileContent.active = false;
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

        this.mapToolNode.forEach((pt) => {
            pt.tool.active = true;
            if (pt.switch)
                pt.switch.active = false;
        })
        this.tileMenu.forEach((pt) => {
            pt.active = false;
        })

        this.tileContent.active = true;
        MapManager.GetInstance().restTouch();

        let _index = 0;
        if (target.name == 'move') {
            _index = 0;
            this.tileContent.active = false;
            MapManager.GetInstance().actionStatus = ActionStatus.MOVE;
            MapManager.GetInstance().setMove();
        } else if (target.name == 'delete') {
            _index = 1;
            this.tileContent.active = false;
            MapManager.GetInstance().actionStatus = ActionStatus.DETELE;
            MapManager.GetInstance().setDetele();
        } else if (target.name == 'ground') {
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
        } else if (target.name == 'script') {
            _index = 7;
            this.tileMenu.get('panel_script').active = true;
            MapManager.GetInstance().actionStatus = ActionStatus.Script;

            const mapEditor = MapManager.GetInstance().getMapEditor();
            const content = this.tileMenu.get('panel_script').getChildByPath("content/view/content");

            const dramaName = content.getChildByPath("frame_1/EditBox").getComponent(EditBox);
            dramaName.string = this.dramaSet.name;

            const dramaScript = content.getChildByPath("frame_2/EditBox").getComponent(EditBox);
            dramaScript.string = this.dramaSet.script;

            MapManager.GetInstance().getMapEditor().hideTileMask();
        } else if (target.name == 'video') {
            _index = 8;
            MapManager.GetInstance().actionStatus = ActionStatus.Video_Action;
            MapManager.GetInstance().getMapEditor().hideTileMask();

            this.sendSaveMapData();
            this.sendDramaConfig();

            this.closeToolBtn();
            this.isSave = true;
            this.saveIndex = 0;
            this.aiStartView.active = true;
            this.aiStartView.emit("startFakeLoading");
        } else if (target.name == 'videoStop') {
            _index = 9;
            MapManager.GetInstance().actionStatus = ActionStatus.Video_Stop;
            MapManager.GetInstance().getMapEditor().hideTileMask();
            this.openToolBtn();
        } else if (target.name == 'save') {
            _index = 10;
            this.onShowSaveDialog();
        } else if (target.name == 'back') {
            _index = 11;
            MapManager.GetInstance().actionStatus = ActionStatus.Back;
            MapManager.GetInstance().getMapEditor().hideTileMask();
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
        }

        // if (this.mapToolNode[_index].switch) {
        //     this.mapToolNode[_index].switch.active = true;
        // }
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

    // 发送剧场信息
    sendDramaConfig() {
        const editor = MapManager.GetInstance().getMapEditor();
        const house = editor.getAllHouseData();

        this.dramaSet.intro = [];
        house.forEach((pt) => {
            if (pt.npc) {
                this.dramaSet.intro.push({ npcId: pt.npc.id, npcName: pt.npc.design.npcName });
            }
        })
        log(this.dramaSet.intro)

        const _frame = CaptureUtils.capture(find("Canvas"), { x: 0, y: 0, width: 972, height: 250 });
        CaptureUtils.captureAndUpload(_frame.texture as RenderTexture, (base64Image) => {
            // let json = new network.GetAllNPCRequest();
            // json.command = 10128;
            // json.type = 1;
            // json["data"] = {};
            // json["data"]["id"] = GlobalConfig.instance.dramaiId;
            // json["data"]["name"] = this.dramaSet.name;
            // json["data"]["dramaScript"] = this.dramaSet.script;
            // json["data"]["intro"] = this.dramaSet.intro;
            // json["data"]["img"] = base64Image;
            // socket.sendWebSocketBinary(json);
        })

        director.loadScene("GameScene", (error: Error) => {
            if (error) {
                console.error('卸载场景失败:', error);
            } else {
                console.log('场景卸载成功');
                MapAssetsManager.GetInstance().clearAllEditAsset()
            }
        });
    }

    onBtnVoteStatus_1() {
        // if(this._voteInfo){
        //     let myVoteCount = this._voteInfo.myYesCount + this._voteInfo.myNoCount;
        //     if(myVoteCount > 0){
        //         this.voteGiftNode.active = true;
        //     }
        //     else{
        //         this.voteStartNode.active = true;
        //     }
        // }


        // if (!TwitterViewMgr.canShowBanner()) {
        //     this.votePopupNode.active = true;
        //     return;
        // }

        // if (this.isWaittingEpisodeData) {
        //     return;
        // }
        // let epData = TwitterViewMgr.getEpisodeData(GlobalConfig.instance.chooseScene || 4, TwitterViewMgr.nowVoteEp);
        // if (epData) {
        //     EventBus.I.post(EventType.INITTWITTERVIEW, epData);
        //     this.scheduleOnce(() => {
        //         EventBus.I.post(EventType.GAME_SWITCH_BANNER_NODE, { isFold: false, showVote: true });
        //     }, 0.1);
        // } else {
        //     this.isWaittingEpisodeData = true;
        //     TwitterViewMgr.nowChooseEp = TwitterViewMgr.nowVoteEp;
        //     TwitterViewMgr.requestEpisodeData(GlobalConfig.instance.chooseScene, TwitterViewMgr.nowVoteEp);
        // }
    }

    onPlayVideo(param) {
    }

    onBtnCloseVotePopupNode() {
    }

    sendDramaStart() {
    }

    onClickBack() {
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

    hideAiStartView() {
        if (this.aiStartView.active) {
            this.aiStartView.emit("onLoadComplete");
        }
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


