import { _decorator, Component, Label, Node } from 'cc';
import { AppConst } from '../../../AppConst';
import { UGCModel } from '../../../Model/UGCModel';
const { ccclass, property } = _decorator;

@ccclass('UGCNpcInfoCell')
export class UGCNpcInfoCell extends Component {
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
        const mapName = UGCModel.getInstance()?.mapData?.map_name || "";
        // 打开 Tips 时补充当前地图名（不污染原始 npcInfo 引用）
        const payload = Object.assign({}, this.npcInfo || {}, { mapName });
        AppConst.PanelManager.openView("res/View/CreateMap/NPCTips" , payload)
    }
}

