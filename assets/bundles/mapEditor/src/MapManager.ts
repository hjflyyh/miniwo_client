import { _decorator, assetManager, AssetManager, Component, director, Node, Prefab, Size, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { MapEditor } from './MapEditor';
import { MapEditorUI } from './MapEditorUI';
import { MapEditorUIConfig } from 'db://assets/src/common/MapEditorUIConfig';
import { MapAssetsManager } from 'db://assets/src/common/MapAssetsManager';
import { PrefabLoad } from '../../../scripts/Utils/PrefabLoad';
import { AppConst } from '../../../scripts/AppConst';
const { ccclass, property } = _decorator;

export enum ActionStatus {
    NONE,
    MOVE,
    DETELE,
    GROUND,
    PLANT,
    FLOOR,
    WALL,
    DECOR,
    NPC,
    Script,
    Video_Action,
    Video_Stop,
    Back,
    WALL_DECOR,
}

@ccclass('MapManager')
export class MapManager extends Component {
    private mapUI: MapEditorUI;
    private mapEdiotr: MapEditor;

    public curTileId: string = '';
    actionStatus: ActionStatus = ActionStatus.Back;

    private static instance: MapManager;

    private editUIMap = {}
    private editNPCMap = {}

    public mapTag = 0

    public static GetInstance(): MapManager {
        return this.instance;
    }

    protected onLoad(): void {
        this.checkTileObj()
        MapManager.instance = this;
        director.addPersistRootNode(this.node);
    }

    start() {

    }

    update(deltaTime: number) {

    }

    RefreshTileGroundById(){
        this.mapEdiotr.selectTileGroundById(this.curTileId);
    }

    RefreshTileById(){
        this.mapEdiotr.selectTileTypeById(this.curTileId);
    }

    // RefreshTile() {
    //     this.mapEdiotr.selectTileType(MapAssetsManager.GetInstance().tilePerfabs.get(this.curTileId).prefab, this.curTileId);
    // }

    // getTilePrefab(id: string) {
    //     return MapAssetsManager.GetInstance().tilePerfabs.get(id).prefab;
    // }
    
    checkTileObj(){
        this.editUIMap = {}
        this.editNPCMap = {}
        for(let i = 0 ; i < MapEditorUIConfig.UIConfig_Object.length ; i++){
            this.editUIMap[MapEditorUIConfig.UIConfig_Object[i].id] = MapEditorUIConfig.UIConfig_Object[i]
        }
    }

    //获取屏幕中间使用的地面预制件
    getTileGroundPrefab(id: string , loadHandle = null , target = null , bundleName = "mapEditor"){
        let newNode = new Node()
        let prefabLoad = newNode.addComponent("PrefabLoad") as PrefabLoad
        prefabLoad.bundleName = bundleName
        prefabLoad.addComponent(UITransform)

        let cfg = AppConst.JSONManager.getItem("mapGround" , id)
        prefabLoad.url = "ground/prefab/" + cfg.baseImg
        return newNode
    }

    getMapCurTileNode(id: string , type : string){
        let cfgName = ""
        if(type == "OutsideRenovation"){
            cfgName = "mapOutsideRenovation"
        }
        if(type == "Floor"){
            cfgName = "mapFloor"
        }
        if(type == "Decor"){
            cfgName = "mapDecor"
        }
        if(type == "WallDacoration"){
            cfgName = "mapWallDecor"
        }
        let cfg = AppConst.JSONManager.getItem(cfgName , id)
        let cfgSize = [32,32]
        if(cfg["map_size"]){
            let split = cfg["map_size"].split("#");
            cfgSize = [parseInt(split[0]) , parseInt(split[1])]
        }
        let newNode = new Node()
        let uiTransform : UITransform = newNode.getComponent(UITransform)
        if(!uiTransform){
            uiTransform = newNode.addComponent(UITransform)
        }
        uiTransform.contentSize = new Size(cfgSize[0] , cfgSize[1])

        let spriteNode = new Node()
        spriteNode.addComponent(Sprite)
        if(cfg["img_size"] != null){
            spriteNode.scale = new Vec3(parseInt(cfg["img_size"]) , parseInt(cfg["img_size"]) , parseInt(cfg["img_size"]))
        }

        if(cfg["img_pos"] != null){
            const cfgPY = cfg["img_pos"].split("#");
            spriteNode.x += parseInt(cfgPY[0])
            spriteNode.y += parseInt(cfgPY[1])
        }

        let spLoad : PrefabLoad = spriteNode.addComponent("PrefabLoad") as PrefabLoad
        spLoad.isTexture= true
        spLoad.bundleName = "mapEditor"
        spLoad.url = cfg["image"] + "/spriteFrame";

        newNode.addChild(spriteNode)

    
        return newNode
    }

    getTilePrefab(id: string , loadHandle = null , target = null , bundleName = "mapEditor"){
        let newNode = new Node()
        let prefabLoad = newNode.addComponent("PrefabLoad") as PrefabLoad
        prefabLoad.bundleName = bundleName
        prefabLoad.addComponent(UITransform)
        if(this.editUIMap[id]){
            prefabLoad.url = this.editUIMap[id].prefab
        }
        prefabLoad.loadHandle = loadHandle
        prefabLoad.target = target
        return newNode
    }

    getTilePrefabName(id: string){
        if(this.editUIMap[id]){
            return this.editUIMap[id].prefab
        }else if(this.editNPCMap[id]){
            return this.editNPCMap[id].prefab
        }
    }

    // getPlantSize(id: string){
    //     for(let t = 0 ; t < MapEditorUIConfig.Tile_Plant.length ; t++){
    //         if(MapEditorUIConfig.Tile_Plant[t].id == id){
    //             return MapEditorUIConfig.Tile_Plant[t].size
    //         }
    //     }
    // }

    getDecorSize(id: string){
        for(let t = 0 ; t < MapEditorUIConfig.Tile_Decor.length ; t++){
            if(MapEditorUIConfig.Tile_Decor[t].id == id){
                return MapEditorUIConfig.Tile_Decor[t].size
            }
        }
    }

    getTileImgURL(id: string){
        if(this.editUIMap[id]){
            return this.editUIMap[id].url + "/spriteFrame"
        }else if(this.editNPCMap[id]){
            return this.editNPCMap[id].url + "/spriteFrame"
        }
        console.log(id)
    }

    setMove() {
        this.mapEdiotr.selectMoveTile();
    }

    setDetele() {
        this.mapEdiotr.selectDeteleTile();
    }

    restTouch() {
        this.mapEdiotr.restTouch();
    }

    getMapEditorUI() {
        return this.mapUI;
    }

    getMapEditor() {
        return this.mapEdiotr;
    }

    setMapEditor(mapEditor: any) {
        this.mapEdiotr = mapEditor;
    }

    setMapEditorUI(mapEditorUI: any) {
        this.mapUI = mapEditorUI;
    }

    // getGroundAssets() {
    //     return MapAssetsManager.GetInstance().groundAssets;
    // }
    getGroundAssetsStr(){
        return MapAssetsManager.GetInstance().groundAssetsStr;
    }

    // getTileAssets() {
    //     return MapAssetsManager.GetInstance().tilePerfabs;
    // }

    public get tileId(): string {
        return this.curTileId;
    }

    public set tileId(id: string) {
        this.curTileId = id;
    }
}


