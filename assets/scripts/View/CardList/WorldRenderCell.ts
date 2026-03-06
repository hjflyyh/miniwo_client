import { _decorator, Component, Label, Node } from 'cc';
import { CardList } from './CardList';
import { CardModel } from '../../Model/CardModel';
const { ccclass, property } = _decorator;

@ccclass('WorldRenderCell')
export class WorldRenderCell extends Component {
    @property(CardList)
    cardList : CardList = null

    mapId 

    @property(Label)
    chooseName : Label

    @property(Label)
    unChooseName : Label

    @property(Node)
    chooseNode : Node

    start() {
        EventSystem.addListent("changeCardListWorld" , this.setChange , this)
    }
    
    setMapId(map_id){
        this.mapId = map_id
        this.chooseName.string = CardModel.getInstance().mapNames[map_id]
        this.unChooseName.string = CardModel.getInstance().mapNames[map_id]

        this.setChange()
    }

    setChange(){
        this.chooseNode.active = this.mapId == this.cardList.chooseWorldId
        this.unChooseName.node.active = this.mapId == this.cardList.chooseWorldId
        this.chooseName.node.active = this.mapId == this.cardList.chooseWorldId
    }

    OnClick(){
        this.cardList.OnChangeWorld(this.mapId)

        EventSystem.send("changeCardListWorld")
    }
}


