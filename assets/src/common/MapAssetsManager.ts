import { _decorator, assetManager, AssetManager, Component, director, log, Node, Prefab, SpriteFrame } from 'cc';
import { MapEditorUIConfig } from './MapEditorUIConfig';
import { GridPoolManager } from '../../scripts/Manager/GridPoolManager';
import { AppConst } from '../../scripts/AppConst';
import { MapEditor } from '../../bundles/mapEditor/src/MapEditor';
import { MapManager } from '../../bundles/mapEditor/src/MapManager';
const { ccclass, property } = _decorator;
//每多少帧做一次检测
const THROTTLE_FRAMES = 16

@ccclass('MapAssetsManager')
export class MapAssetsManager extends Component {
    // public tilePerfabs: Map<string, { icon: SpriteFrame, prefab: Prefab, bigImg?: SpriteFrame }> = new Map();
    // public groundAssets: SpriteFrame[][] = [];
    public groundAssetsStr = {};

    private static _instance: MapAssetsManager;

    public loadAllNum : number = 0
    public nowLoadNum : number = 0

    public static GetInstance(): MapAssetsManager {
        return this._instance;
    }

    protected onLoad(): void {
        MapAssetsManager._instance = this;
        // director.addPersistRootNode(this.node);
    }

    update(){

        const totleFrames = director.getTotalFrames();
        if(totleFrames % Math.max(1 , this.throttleFrames) != this._throttleSlot){
            MapAssetsManager.isCheckGridDisplay = true
        }else{
            MapAssetsManager.isCheckGridDisplay = false
        }
    }

    //是否当前帧需要检查格子显示
    public static isCheckGridDisplay = true
    @property
    throttleFrames : number = THROTTLE_FRAMES
    private _throttleSlot : number = 0

    async loadMapEditorAssets() {
        let bundle = assetManager.getBundle("mapEditor")
            bundle.load("ground/texture2d/dirty_road/dirty_road_7/spriteFrame", SpriteFrame, (err, spriteFrame) => {
                spriteFrame.addRef()
        })

        // this.loadAllNum = MapEditorUIConfig.UIConfig_Object.length * 2
        // this.loadAllNum += MapEditorUIConfig.NPC_CONFIG.length * 3
        // this.loadAllNum += this.mapGroundName.length
        this.nowLoadNum = 0

        // this.tilePerfabs = new Map();
        // this.groundAssets = []

        this.initGroundAssetsNames();
        await this.loadTilePerfab();
        // await this.loadGroundAssets();
        await this.loadNpc();

        this.addNowLoadNum()
    }

    private async loadTilePerfab() {
        // const list = MapEditorUIConfig.UIConfig_Object;
        // const bundle = assetManager.getBundle("mapEditor");

        // for (let i = 0; i < list.length; i++) {
        //     const element = list[i];
        //     await this.loadBundleAssetsAsync(1, bundle, element.url + "/spriteFrame", SpriteFrame).then((sp: SpriteFrame) => {
        //         this.tilePerfabs.set(element.id, { prefab: null, icon: sp });
        //         this.addNowLoadNum()
        //     });
        //     await this.loadBundleAssetsAsync(1, bundle, element.prefab, Prefab).then((sp: Prefab) => {
        //         if (this.tilePerfabs.has(element.id)) {
        //             let item = this.tilePerfabs.get(element.id);
        //             item.prefab = sp;
        //         }
        //         this.addNowLoadNum()
        //     })
        // }
    }

    //初始化地板
    private async initGroundAssetsNames(){
        let mapTag = 0
        let mapGroundAll = AppConst.JSONManager.getItemAll("mapGround")
        for(let m in mapGroundAll){
            let tags = mapGroundAll[m].tags
            let isAdd = !tags || tags == ""
            if(!isAdd && tags != ""){
                const tagAry: string[] = tags.split("#");
                for(let t = 0 ; t < tagAry.length ; t++){
                    if(parseInt(tagAry[t]) == mapTag){
                        isAdd = true
                    }
                }
            }
            if(isAdd){
                let list = [];
                for(let l = 1 ; l <= 16 ; l++){
                    list.push({
                        url : "ground/texture2d/" + mapGroundAll[m].resource + "/" + mapGroundAll[m].resource + "_" + l + "/spriteFrame",
                        cfgId : m
                    });
                }
                this.groundAssetsStr[m] = list
            }
        }
    }

    // private async loadGroundAssets() {
    //     const bundle = assetManager.getBundle("mapEditor");
    //     for (let i = 0; i < this.mapGroundName.length; i++) {
    //         const str = this.mapGroundName[i];
    //         await this.loadBundleAssetsAsync(2, bundle, "ground/texture2d/" + str, SpriteFrame).then((sp: SpriteFrame[]) => {
    //             let list = [];
    //             let _index = 1;
    //             for (let j = 0; j < sp.length; j++) {
    //                 for (const element of sp) {
    //                     if (parseInt(element.name.split('_')[1]) == _index) {
    //                         _index++;
    //                         list.push(element);
    //                         break;
    //                     }
    //                 }
    //             }
    //             this.groundAssets.push(list);

    //             this.addNowLoadNum()
    //         })
    //     }
    // }

    private async loadNpc() {
        // const list = MapEditorUIConfig.NPC_CONFIG;
        // const bundle = assetManager.getBundle("mapEditor");
        // const npcBundle = assetManager.getBundle("npcAnimation");
        // for (let i = 0; i < list.length; i++) {
        //     const element = list[i];
        //     this.tilePerfabs.set(element.id, { prefab: null, icon: null, bigImg: null });
        //     await this.loadBundleAssetsAsync(1, npcBundle, element.url + "/spriteFrame", SpriteFrame).then((sp: SpriteFrame) => {
        //         if (this.tilePerfabs.has(element.id)) {
        //             let item = this.tilePerfabs.get(element.id);
        //             item.icon = sp;
        //         }

        //         this.addNowLoadNum()
        //     })
        //     await this.loadBundleAssetsAsync(1, npcBundle, element.bigImg + "/spriteFrame", SpriteFrame).then((sp: SpriteFrame) => {
        //         if (this.tilePerfabs.has(element.id)) {
        //             let item = this.tilePerfabs.get(element.id);
        //             item.bigImg = sp;
        //         }

        //         this.addNowLoadNum()
        //     })
        //     await this.loadBundleAssetsAsync(1, bundle, element.prefab, Prefab).then((sp: Prefab) => {
        //         if (this.tilePerfabs.has(element.id)) {
        //             let item = this.tilePerfabs.get(element.id);
        //             item.prefab = sp;
        //         }

        //         this.addNowLoadNum()
        //     })
        // }
    }

    addNowLoadNum(){
        this.nowLoadNum++

        EventSystem.send("MapAssetsManagerLoad" , [this.nowLoadNum , this.loadAllNum])
    }

    loadBundleAssetsAsync(_index: number, bundle: AssetManager.Bundle, assetUrl: string, _type: any) {
        console.log(assetUrl)
        return new Promise((resolve, reject) => {
            if (_index == 1) {
                bundle.load(assetUrl, _type, (err, bundle) => {
                    if (err) {
                        reject(err); // 失败时 reject
                    } else {
                        resolve(bundle); // 成功时 resolve
                    }
                });
            } else {
                bundle.loadDir(assetUrl, _type, (err, bundle) => {
                    if (err) {
                        reject(err); // 失败时 reject
                    } else {
                        resolve(bundle); // 成功时 resolve
                    }
                });
            }
        });
    }

    clearAllEditAsset(){
        // this.tilePerfabs.forEach((value , key: string) => {
        //     if(value.icon){
        //         value.icon.decRef()
        //     }
        //     if(value.prefab){
        //         value.prefab.decRef()
        //     }
        //     if(value.bigImg){
        //         value.bigImg.decRef()
        //     }
        // });
        // for(let g = 0 ; g < this.groundAssets.length ; g++){
        //     let list = this.groundAssets[g]
        //     for(let l = 0 ; l< list.length ; l++){
        //         list[l].decRef()
        //     }
        // }
        // this.tilePerfabs = new Map();
        // this.groundAssets = []
    }
}


