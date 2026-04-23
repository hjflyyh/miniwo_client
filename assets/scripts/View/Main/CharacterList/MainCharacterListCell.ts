import { _decorator, Component, Label, Node, Size, Sprite, UITransform } from 'cc';
import { Utils } from '../../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('MainCharacterListCell')
export class MainCharacterListCell extends Component {
    @property(UITransform)
    public bgTransform : UITransform

    @property(Node)
    public tag : Node

    @property(Label)
    npcName : Label

    @property(Sprite)
    npcSp : Sprite

    @property(Label)
    npcInfo : Label

    @property(Label)
    likeNum : Label

    start() {

    }

    refreshData(data){
        console.log(data)
        this.npcName.string = data.name
        this.npcInfo.string = data.info
        this.likeNum.string = data.npc_like_count

        Utils.loadCover(data["avatar"], this.npcSp);
    }

    onClickLike(){
        
    }
}


