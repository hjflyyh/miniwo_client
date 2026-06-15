import { _decorator, Component, Node , sys} from 'cc';
import { AppConst } from '../AppConst';
const { ccclass, property } = _decorator;

@ccclass('LanguageManager')
export class LanguageManager extends Component {
    public language : string = "en"

    start() {
        AppConst.LanguageManager = this
    }

    public getTextByConfig(id){
        if(AppConst.JSONManager.getItem("language" , id)){
            return AppConst.JSONManager.getItem("language" , id)["name_"+this.language]
        }
        return ""
    }

    public changeLanguage(lang){
        this.language = lang
        sys.localStorage.setItem("language" , lang)
        EventSystem.send("languageRep")
    }

    public getDialogString(id){
        let dialogCfg = AppConst.JSONManager.getItem("dialogueLibrary" , id)
        if(!dialogCfg){
            return ""
        }
        if(this.language == "cn"){
            return dialogCfg["chinese_text"]
        }
        return dialogCfg["english_text"]
    }
}


