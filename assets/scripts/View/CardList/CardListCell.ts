import { _decorator, Component, Label, Node, ProgressBar } from 'cc';
import { CardModel } from '../../Model/CardModel';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('CardListCell')
export class CardListCell extends Component {
    @property(Label)
    cardInfo: Label = null

    @property(Label)
    cardNum : Label

    @property(Node)
    deleteNode : Node

    @property(ProgressBar)
    suipianPorg : ProgressBar

    @property(Label)
    suipianNum : Label

    cardData
    start() {

    }

    setCardId(card_data){
        this.cardData = card_data
        console.log(this.cardData)
        this.cardInfo.string = this.cardData.story
        this.cardNum.string = this.cardData.card_num > 0 ? this.cardData.card_num : ""
        if(this.cardData.card_num <= 0){
            this.suipianPorg.node.active = true
            this.suipianNum.node.active = true

            let combine = CardModel.getInstance().combine[this.cardData["quality"]]
            let combineCfg = CardModel.getInstance().getCardCombineCfg(combine)
            let suipian_number = combineCfg.suipian_number
            let player_suipian_number = CardModel.getInstance().getCardSuipianNum(this.cardData)
            this.suipianNum.string = player_suipian_number + "/" + suipian_number
            this.suipianPorg.progress = player_suipian_number / suipian_number
        } else {
            this.suipianPorg.node.active = false
            this.suipianNum.node.active = false
        }
        this.deleteNode.active = this.cardData.card_num > 1
    }

    onClickCell(){
        console.log(this.cardData)
        if(this.cardData.level <= 0){
            AppConst.PanelManager.openView("res/View/Card/CardCombine" , this.cardData , null , "res/View/Card/CardList")
        }else{
            AppConst.PanelManager.openView("res/View/Card/CardDetail" , this.cardData , null , "res/View/Card/CardList")
        }
    }
}


