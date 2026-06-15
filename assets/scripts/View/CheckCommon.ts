import { _decorator, Component, director, Label, Node } from 'cc';
import { BaseView } from './BaseView';
import { AppConst } from '../AppConst';
const { ccclass, property } = _decorator;

@ccclass('CheckCommon')
export class CheckCommon extends Component {
    @property(Label)
    commonLabel : Label;

    start() {
        let param = this.node["_openParam"]
        this.commonLabel.string = param["showText"]
    }

    onClick(){
        if(this.getComponent(BaseView).onClickClose()){
            let param = this.node["_openParam"]
            if(param["callback"] && param["callbackParent"]){
                param["callback"].call(param["callbackParent"])
            }
            if(param["chenckType"] && param["chenckType"] == "worldExit"){
                EventSystem.send("leaveMap")
            }
        }
    }
}

