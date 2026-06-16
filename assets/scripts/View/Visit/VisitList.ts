import { _decorator, Component, instantiate, math, Node, Size } from 'cc';
import { YXCollectionView } from '../../..//plugin/list-3x/yx-collection-view';
const { ccclass, property } = _decorator;
import { HttpManager } from '../../Manager/HttpManager';
import { RoleModel } from '../../Model/RoleModel';
import { UGCModel } from '../../Model/UGCModel';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
import { VisitListCell } from './VisitListCell';
import { AppConst } from '../../AppConst';

@ccclass('VisitList')
export class VisitList extends Component {

    @property(Node)
    visitCellRender: Node

    npcList = {}

    start() {
        EventSystem.addListent("exploration_update", this.refreshVisitList, this);
        this.visitCellRender.active = false
        this.initNpcList()
        // this.scheduleOnce(() => {
        //     this.refreshVisitList();
        // }, 0.1)

        EventSystem.addListent("OnRefreshUGCMapNpc", this.refreshVisitList, this);
    }

    async initNpcList() {
        // if (!UGCModel?.getInstance()?.npcList?.length) {

        // }
        console.log("VisitList initNpcList")
        // const token = RoleModel.getInstance().token;
        // const res = await fetch(`${HttpManager.baseUrl}/getMyNPCs`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ token }),
        // });

        // const json = await res.json();
        // UGCModel.getInstance().npcList = json?.data        


        // UGCModel.getInstance().checkExploration();
        // console.log("npcList::", UGCModel.getInstance().npcList)
        // const token = RoleModel.getInstance().token;
        // AppConst.HttpManager.sendPostHttpAny("getMyNPCs" , JSON.stringify({ token }));
        UGCModel.getInstance().listMyNpcs();
    }

    refreshVisitList() {
        let showNpcs = UGCModel.getInstance().npcList
        console.log("VisitList refreshVisitList", showNpcs)
        for (let data of showNpcs) {
            if (!data.npc_sprite_url || data.npc_sprite_url == "") {
                continue
            }
            let next = this.npcList[data.npc_id]
            if (!next) {
                next = instantiate(this.visitCellRender)
                next.active = true
                next.parent = this.visitCellRender.parent
                this.npcList[data.npc_id] = next
            }
            let cell = next.getComponent("VisitListCell") as VisitListCell;
            cell.setNpcId(data)

        }
    }

    onDestroy() {
        EventSystem.remove(this)
    }


}