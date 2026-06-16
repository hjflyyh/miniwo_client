import { _decorator, Color, Component, instantiate, Label, math, Node, ProgressBar, resources, Size, Slider, Sprite, SpriteFrame, UITransform } from 'cc';
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
import { Utils } from '../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('VisitListCell')
export class VisitListCell extends Component {
    private npcID: number = 0
    private isVisited: boolean = false
    private explorationAt: number = 0

    @property(Node)
    dispatchNode: Node = null

    @property(Node)
    startNode: Node = null

    @property(Node)
    endNode: Node = null

    @property(Node)
    statusNode: Node = null

    @property(Label)
    tiliLabel: Label = null

    @property(Label)
    tili2Label: Label = null

    @property(Label)
    nameLabel: Label = null

    @property(Node)
    textNode: Node = null

    @property(Node)
    textCell: Node = null

    @property(ProgressBar)
    tili: ProgressBar = null

    @property(ProgressBar)
    tili2: ProgressBar = null

    @property(Slider)
    slider: Slider

    @property(UITransform)
    sliderImg: UITransform

    @property(Label)
    hourLabel: Label = null

    @property(Sprite)
    head: Sprite

    textList = {}
    sliderNum: number = 5

    npcData = null
    start() {
        this.textCell.active = false
        EventSystem.addListent("exploration_log", this.onExplorationLog, this)

        this.schedule(() => {
            if (this.isVisited) {
                let interval = (this.explorationAt - Utils.getServerNowMs()) / 1000
                let hour = ~~(interval / 60 / 60)
                let minute = ~~(interval / 60 % 60)
                let second = ~~(interval % 60)

                // 格式化为两位数，不足两位前面补0
                let formattedHour = hour.toString().padStart(2, '0')
                let formattedMinute = minute.toString().padStart(2, '0')
                let formattedSecond = second.toString().padStart(2, '0')
                this.tili2Label.string = `${formattedHour}:${formattedMinute}:${formattedSecond}`

                if(this.explorationAt - Utils.getServerNowMs() <= 0){
                    this.npcData.exploration_at = 0;
                    this.setNpcId(this.npcData);
                }
                console.log(Utils.calculateRemainingPercentage(this.calStartAt() , this.explorationAt , Utils.getServerNowMs()))
            }
        }, 1)
    }

    onExplorationLog({ npcID, reports }) {
        if (this.npcID != npcID) {
            return
        }
        if (reports.length == 0) {
            EventSystem.send('ShowTips', 'The story has not been generated.');
            return
        }

        this.textNode.active = true
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
        this.npcData = Npc_data
        console.log("setNpcId", Npc_data.attributes["111"])
        let stamina = Npc_data.attributes["111"]
        stamina = Math.max(0, Math.min(1000, stamina))
        this.tiliLabel.string = stamina.toString() + "/1000"
        this.tili.progress = stamina / 1000
        this.npcID = Npc_data.npc_id
        this.nameLabel.string = Npc_data.name
        this.setVisit(Npc_data.exploration_at)

        this.slider.progress = 0;

        let sendStamina = UGCModel.getInstance().getSendStamina(Npc_data.attributes["112"] ?? 0 > 20)
        this.sliderNum = 5
        if (sendStamina && sendStamina > 0) {
            this.sliderNum = Math.min(9, ~~(stamina / sendStamina))
        }
        this.onSliderChange();

        //npc_sprite_url
        Utils.loadCover(Npc_data.npc_sprite_url, this.head)
    }

    // 计算探索开始时间戳
    calStartAt(): number {
        let startNum = ~~(this.explorationAt / 10) % 10
        let explorationTime = UGCModel.getInstance().getExplorationTime()
        return this.explorationAt - startNum * explorationTime //  起始时间戳
    }

    setVisit(explorationAt: number) {
        this.isVisited = explorationAt > Utils.getServerNowMs()
        this.explorationAt = explorationAt

        this.textNode.active = false
        this.dispatchNode.active = this.isVisited
        this.startNode.active = !this.isVisited
        this.statusNode.active = this.endNode.active = this.isVisited
        this.tili2.node.active = this.isVisited
        this.slider.node.active = !this.isVisited
    }

    onClickVisit() {
        const st = Number(this.tiliLabel.string)
        console.log("onClickVisit", this.isVisited, this.npcID, st)
        if (st <= 20) {
            return
        }
        let json = new network.ExplorationStartRequest();
        let num = ~~(this.sliderImg.contentSize.width / 312 * this.sliderNum) + 1
        AppConst.WebSocketManager.send(json.toJSON(this.npcID, Math.min(9, num)));
    }

    onClickEnd() {
        UGCModel.getInstance().onClickEnd(this.npcID, 1)
    }

    onClickStatus() {
        if (!this.textNode.active) {
            let json = new network.ExplorationLogRequest();
            let nakamaToken = RoleModel.getInstance().nakama_token != null ? String(RoleModel.getInstance().nakama_token) : '';
            nakamaToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aWQiOiI2YTU5ZGRkZS04MDk4LTQ4MWUtODYzNS1mMDcyMjMxODhhYWEiLCJ1aWQiOiJmMjIyYzU3OC0xMWZjLTQwYTAtYjdmNS0wYjMyYzIyMTM1MTQiLCJ1c24iOiJ6alpHY2t2eGFXIiwiZXhwIjoxNzgxMDY1MDM0fQ.6bA51Wwn7OpDj0Z863BrhFf-FcLVjn87xLZJs0CuO48"
            if (nakamaToken == "") {
                return
            }
            AppConst.WebSocketManager.send(json.toJSON(this.npcID, nakamaToken));
        } else {
            this.textNode.active = false
        }
    }

    onSliderChange() {
        this.sliderImg.contentSize = new Size(312 * this.slider.progress, 8)
        let num = ~~(this.sliderImg.contentSize.width / 312 * this.sliderNum) + 1
        let explorationTime = UGCModel.getInstance().getExplorationTime()
        let totalSec = Math.round(explorationTime * num)
        let h = Math.floor(totalSec / 3600)
        let m = Math.floor((totalSec % 3600) / 60)
        let s = totalSec % 60
        let text = ""
        if (h > 0) {
            text = h.toString() + "H" + (m > 0 ? m.toString() + "M" : "")
        } else if (m > 0) {
            text = m.toString() + "M" + (s > 0 ? s.toString() + "S" : "")
        } else {
            text = s.toString() + "S"
        }
        this.hourLabel.string = text
    }
}
