import { _decorator, Component, Node , resources , JsonAsset , log} from 'cc';
import { AppConst } from '../AppConst';
const { ccclass, property } = _decorator;

@ccclass('JSONManager')
export class JSONManager extends Component {
    public configs = ["language" , "cardCombine" , "mapGround" , "mapOutsideRenovation" , "mapFloor" , "mapDecor" ,"mapWallDecor"]
    public jsonMap = {}

    private loadSuccessNum = 0
    onLoad(){
        AppConst.JSONManager = this
    }

    start() {
        this.loadAll()
    }

    public getItem(configName , id){
        if(this.jsonMap[configName] != null && this.jsonMap[configName][id] != null){
            let json = this.jsonMap[configName][id]
            json["id"] = id
            return json;
        }
        return null
    }

    public getItemAll(configName){
        if(this.jsonMap[configName] != null){
            return this.jsonMap[configName]
        }
        return null
    }

    public loadAll(){
        var _t = this
        for(let i = 0 ;i < this.configs.length ; i++){
            let cfgName = this.configs[i]
            resources.load("res/Config/" + this.configs[i] , JsonAsset , function(err , json){
                if(json != null){
                    log("加载配置：" + json.name)
                    _t.jsonMap[json.name] = json.json

                    _t.loadSuccessNum++;

                    if(_t.loadSuccessNum == _t.configs.length){
                        EventSystem.send("ConfigLoadAll")
                    }
                }else{
                    log("配置加载失败:" + cfgName)
                }
            })
        }
    }
}


