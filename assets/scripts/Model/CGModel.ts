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
            for(let c = 0 ; c < this.cgAry.length ; c++){
                //id
                //cg_url
                AppConst.JournalManager.addCGJournal(this.cgAry[c]["id"] , this.cgAry[c]["cg_url"])
            }
            EventSystem.send("cgGalleryListRefresh")
        }
    }
}