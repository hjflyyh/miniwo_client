import { _decorator, Color, Component, Label, Node } from 'cc';
import { UGCBuildToole } from './UGCBuildTool';
const { ccclass, property } = _decorator;

@ccclass('UGCBuildTypeCell')
export class UGCBuildTypeCell extends Component {
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
        this.chooseNode.active = showIndex == buildTool.chooseTabIndex
        this.unchooseNode.active = showIndex != buildTool.chooseTabIndex
        this.typeName.color = showIndex == buildTool.chooseTabIndex ? new Color(134 , 129 , 242 , 255) : Color.WHITE
    }    

    onClick(){
        this.buildTool.onClickTab(this.showIndex)
    }    
}

