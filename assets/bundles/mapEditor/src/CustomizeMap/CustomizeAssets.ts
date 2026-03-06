import { _decorator, Component, director, Node } from 'cc';
import { MapModel } from '../../../../scripts/Model/MapModel';
import { AppConst } from '../../../../scripts/AppConst';

const { ccclass, property } = _decorator;
//每多少帧做一次检测
const THROTTLE_FRAMES = 16
@ccclass('CustomizeAssets')
export class CustomizeAssets extends Component {
    private static _instance: CustomizeAssets;

    public groundAssetsStr  = {};

    //是否当前帧需要检查格子显示
    public static isCheckGridDisplay = true

    public static GetInstance(): CustomizeAssets {
        return this._instance;
    }

    protected onLoad(): void {
        CustomizeAssets._instance = this;
    }

    start() {
        
    }

    public initAllAssets(){
        this.initGroundAssetsNames();
    }

    //初始化地板
    private initGroundAssetsNames(){
        let mapTag = MapModel.getInstance().EditMapTag
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
                    list.push("ground/texture2d/" + mapGroundAll[m].resource + "/" + mapGroundAll[m].resource + "_" + l + "/spriteFrame");
                }
                this.groundAssetsStr[m] = list
            }
        }
    }

    @property
    throttleFrames : number = THROTTLE_FRAMES
    private _throttleSlot : number = 0

    update(){
        const totleFrames = director.getTotalFrames();
        if(totleFrames % Math.max(1 , this.throttleFrames) != this._throttleSlot){
            CustomizeAssets.isCheckGridDisplay = true
        }else{
            CustomizeAssets.isCheckGridDisplay = false
        }
    }
}


