import { _decorator, Component, Node, Size, UITransform } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MainCharacterListCell')
export class MainCharacterListCell extends Component {
    @property(UITransform)
    public bgTransform : UITransform


    @property(Node)
    public tag : Node

    start() {

    }

    refreshData(data){
        this.bgTransform.contentSize = new Size(498 , data.height)
        this.tag.y = data.height / 2
    }
}


