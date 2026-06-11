import { _decorator, Color, Component, instantiate, Label, math, Node, ProgressBar, resources, Size, Sprite, SpriteFrame } from 'cc';
import { YXCollectionView } from '../../../plugin/list-3x/yx-collection-view';
import { CardModel } from '../../Model/CardModel';
import { CustomGridFlowLayout } from '../../../plugin/list-3x/custom-grid-flow-layout';
import { YXMasonryFlowLayout } from '../../../plugin/list-3x/yx-masonry-flow-layout';
import { network } from '../../Model/RequestData';
import { AppConst } from '../../AppConst';
import { PrefabLoad } from '../../Utils/PrefabLoad';
import { BagModel } from '../../Model/BagModel';
import { getBasicSeedMatureSpriteResourcePath } from '../../Model/Farm/FarmSeedVisual';
import { RoleModel } from '../../Model/RoleModel';
import { UGCModel } from '../../Model/UGCModel';
import { VisitListTextCell } from './VisitListTextCell';
const { ccclass, property } = _decorator;

@ccclass('VisitListCell')
export class VisitListCell extends Component {
    private npcID: number = 0
    private isVisited: boolean = false

    @property(Node)
    dispatchNode: Node = null

    @property(Node)
    startNode: Node = null

    @property(Node)
    endNode: Node = null

    @property(Node)
    statusNode: Node = null

    @property(Label)
    numberLabel: Label = null

    @property(Label)
    nameLabel: Label = null

    @property(Node)
    textNode: Node = null

    @property(Node)
    textCell: Node = null

    @property(ProgressBar)
    tili: ProgressBar = null

    textList = {}
    start() {
        this.textCell.active = false
        EventSystem.addListent("exploration_log", this.onExplorationLog, this)
    }

    onExplorationLog({ npcID, reports }) {
        if (this.npcID != npcID) {
            return
        }
        console.log("onExplorationLog", reports)
        for (let report of reports) {
            if (!report.report_text || !report.hour_index) {
                continue
            }
            let next = this.textList[report.hour_index]
            if (!next) {
                next = instantiate(this.textCell)
                next.active = true
                next.parent = this.textCell.parent
                this.textList[report.hour_index] = next
            }
            let cell = next.getComponent("VisitListTextCell") as VisitListTextCell;
            if (!cell) {
                continue
            }
            cell.setText(report.report_text)
        }
    }



    setNpcId(Npc_data) {
        console.log("setNpcId", Npc_data.attributes["111"])
        let stamina = Npc_data.attributes["111"]
        stamina = Math.max(0, Math.min(1000, stamina))
        this.numberLabel.string = ~~(stamina / 10).toString() + "/100"
        this.tili.progress = stamina / 1000
        this.npcID = Npc_data.npc_id
        this.nameLabel.string = Npc_data.name
        this.isVisited = Npc_data.exploration_at > new Date().getTime()
        this.setVisit()
    }

    setVisit() {
        console.log("setVisit", this.isVisited, this.npcID)

        this.textNode.active = false
        this.dispatchNode.active = this.isVisited
        this.startNode.active = !this.isVisited
        this.statusNode.active = this.endNode.active = this.isVisited
    }

    onClickVisit() {
        const st = Number(this.numberLabel.string)
        console.log("onClickVisit", this.isVisited, this.npcID, st)
        if (st <= 20) {
            return
        }
        let json = new network.ExplorationStartRequest();
        AppConst.WebSocketManager.send(json.toJSON(this.npcID, 3));
    }

    onClickEnd() {
        UGCModel.getInstance().onClickEnd(this.npcID)
        // UGCModel.getInstance().onClickEnd(this.npcID, 1)
    }

    onClickStatus() {
        this.textNode.active = !this.textNode.active
        if (this.textNode.active) {
            let json = new network.ExplorationLogRequest();
            let nakamaToken = RoleModel.getInstance().nakama_token != null ? String(RoleModel.getInstance().nakama_token) : '';
            console.log("onClickEnd nakamaToken:", nakamaToken)
            nakamaToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aWQiOiI2YTU5ZGRkZS04MDk4LTQ4MWUtODYzNS1mMDcyMjMxODhhYWEiLCJ1aWQiOiJmMjIyYzU3OC0xMWZjLTQwYTAtYjdmNS0wYjMyYzIyMTM1MTQiLCJ1c24iOiJ6alpHY2t2eGFXIiwiZXhwIjoxNzgxMDY1MDM0fQ.6bA51Wwn7OpDj0Z863BrhFf-FcLVjn87xLZJs0CuO48"
            if (nakamaToken == "") {
                return
            }
            AppConst.WebSocketManager.send(json.toJSON(this.npcID, nakamaToken));
        }
    }
}
