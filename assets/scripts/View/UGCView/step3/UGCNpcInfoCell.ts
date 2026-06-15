import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { AppConst } from '../../../AppConst';
import { UGCModel } from '../../../Model/UGCModel';
import { Utils } from '../../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('UGCNpcInfoCell')
export class UGCNpcInfoCell extends Component {
    @property(Label)
    public npcNameLabel : Label = null;

    @property(Sprite)
    public npcLihui : Sprite = null;

    private npcInfo : any = null;


    start() {

    }

    refreshNpcInfo(npcInfo){
        this.npcInfo = npcInfo;
        this.npcNameLabel.string = npcInfo.name;
        if(npcInfo["model_url"]){
            Utils.loadCover(npcInfo["model_url"], this.npcLihui);
        }
    }

    onClickNpc(){
        const mapName = UGCModel.getInstance()?.mapData?.map_name || "";
        // 打开 Tips 时补充当前地图名（不污染原始 npcInfo 引用）
        const payload = Object.assign({}, this.npcInfo || {}, { mapName });
        AppConst.PanelManager.openView("res/View/CreateMap/NPCTips" , payload)
    }
}

