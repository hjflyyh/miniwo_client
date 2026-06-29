import { _decorator, Color, Component, Label, Node } from 'cc';
import { UGCBuildToole } from './UGCBuildTool';
const { ccclass, property } = _decorator;

@ccclass('UGCBuildTabCell')
export class UGCBuildTabCell extends Component {
    @property(Label)
    typeName : Label

    @property(Node)
    chooseNode : Node

    @property(Node)
    unchooseNode : Node

    showIndex = -1
    buildTool : UGCBuildToole
    start() {

    }

    refreshNode(data , showIndex , buildTool : UGCBuildToole){
        this.showIndex = showIndex
        this.buildTool = buildTool
        this.typeName.string = data["name_en"]
        this.chooseNode.active = showIndex == buildTool.chooseTypeIndex
        this.unchooseNode.active = showIndex != buildTool.chooseTypeIndex
        this.typeName.color = showIndex == buildTool.chooseTypeIndex ? Color.WHITE : Color.BLACK
    }

    onClick(){
        this.buildTool.onClickType(this.showIndex)
    }
}

