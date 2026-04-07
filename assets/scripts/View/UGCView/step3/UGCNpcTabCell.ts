import { _decorator, Component, Label, Node } from 'cc';
import { AppConst } from '../../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('UGCNpcTabCell')
export class UGCNpcTabCell extends Component {
    @property(Label)
    public npcNameLabel : Label = null;

    private npcInfo : any = null;
    start() {

    }

    refreshNpcInfo(npcInfo){
        this.npcInfo = npcInfo;
        this.npcNameLabel.string = npcInfo.name;
    }

    onClickNpc(){
        AppConst.PanelManager.openView("res/View/CreateMap/CreateNpc" , this.npcInfo)
    }
}

