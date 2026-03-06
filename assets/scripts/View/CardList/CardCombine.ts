import { _decorator, Component, instantiate, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CardCombine')
export class CardCombine extends Component {
    @property(Label)
    public cardName : Label

    @property(Node)
    public itemRender : Node

    private cardData

    public showItems = []

    start() {
        this.itemRender.active = false
        this.cardData = this.node["_openParam"]
        console.log(this.cardData)
        this.cardName.string = this.cardData["card_name"]

        this.setItems()
    }

    setItems(){
        for(let s = 0 ; s < this.showItems.length ; s++){
            this.showItems[s].destroy()
        }
        this.showItems = []

        for(let f = 0 ; f < this.cardData.fragment_ids.length ; f++){
            let newItem = instantiate(this.itemRender)
            newItem.active = true
            newItem.parent = this.itemRender.parent
        }
    }

    onClickCombine(){

    }
}


