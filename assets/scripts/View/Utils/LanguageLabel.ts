import { _decorator, CCInteger, Component, Label, Node, RichText } from 'cc';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('LanguageLabel')
export class LanguageLabel extends Component {
    @property(CCInteger)
    public languageId : number = -1

    @property(Label)
    public languageLabel : Label

    @property(RichText)
    public languageRichText : RichText

    start() {
        if(this.languageLabel == null){
            this.languageLabel = this.getComponent(Label)
        }
        if(this.languageRichText == null){
            this.languageRichText = this.getComponent(RichText)
        }
        EventSystem.addListent("languageRep" , this.OnLanguageRep , this)

        this.OnLanguageRep()
    }
    
    OnLanguageRep(){
        if(this.languageId < 0){
            return
        }
        if(this.languageLabel != null){
            this.languageLabel.string = AppConst.LanguageManager.getTextByConfig(this.languageId)
        }
        if(this.languageRichText != null){
            this.languageRichText.string = AppConst.LanguageManager.getTextByConfig(this.languageId)
        }
    }
}


