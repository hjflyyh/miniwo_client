import { AppConst } from "../AppConst";
import { network } from "./RequestData";

export class CGModel {
    private static _instance: CGModel = null;

    public static getInstance(): CGModel {
        if (!this._instance) {
            this._instance = new CGModel();
        }
        return this._instance;
    }

    public cgAry = []

    public init(){
        EventSystem.addListent("HttpMessage" , this.OnHttpMessage , this)
    }

    private OnHttpMessage(data){
        if(data.functionName == "npc/cgGallery/list"){
            console.log("cg列表")
            this.cgAry = data.list
            EventSystem.send("cgGalleryListRefresh")
        }
    }
}