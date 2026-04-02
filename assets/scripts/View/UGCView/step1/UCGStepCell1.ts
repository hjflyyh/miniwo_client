import { _decorator, Component, Label, Node } from 'cc';
import { RoleModel } from '../../../Model/RoleModel';
import { UGCModel } from '../../../Model/UGCModel';
import { TipsView } from '../../TipsView';
const { ccclass, property } = _decorator;

@ccclass('UCGStepCell1')
export class UCGStepCell1 extends Component {
    @property(Label)
    public tagName: Label = null;

    @property(Label)
    public tagInfo: Label = null;

    @property(Node)
    public chooseNode: Node = null;

    private data
    start() {
        EventSystem.addListent("OnChangeMapTitle" , this.onChangeMapTitle , this)
    }

    onChangeMapTitle(){
        this.chooseNode.active = UGCModel.getInstance().mapData.map_title == this.data.id
    }

    public initCell(data){
        this.data = data
        this.tagName.string = data.tag_name;
        this.tagInfo.string = data.keywords;
        this.onChangeMapTitle();
    }

    private onClickTag(){ 
        if(UGCModel.getInstance().mapData.id != 0){
            EventSystem.send("ShowTips" , "地图创建后，无法修改标题")
            return
        }
        UGCModel.getInstance().mapData.map_title = this.data.id
        EventSystem.send("OnChangeMapTitle" , this.data.id)
    } 
}

