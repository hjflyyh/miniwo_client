import { _decorator, Component, Label, Node } from 'cc';
import { UGCModel } from '../../../Model/UGCModel';
const { ccclass, property } = _decorator;

@ccclass('UGCTagTime')
export class UGCTagTime extends Component {
    private data

    @property(Label)
    tagName : Label

    start() {

    }

    public initCell(data){
        this.data = data
        this.tagName.string = data.tag_name;
    }

    onClick(){
        UGCModel.getInstance().mapData.map_era = this.data.id
        EventSystem.send("OnChangeMapEra" , this.data.id)
    }
}

