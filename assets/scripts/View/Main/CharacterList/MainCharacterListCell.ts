import { _decorator, Component, Label, Node, Size, Sprite, UITransform } from 'cc';
import { Utils } from '../../../Utils/Utils';
import { AppConst } from '../../../AppConst';
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

    data
    start() {

    }

    refreshData(data){
        console.log(data)
        this.data = data
        this.npcName.string = data.name
        this.npcInfo.string = data.info
        this.likeNum.string = data.npc_like_count

        if(data["character_poster_url"]){
            Utils.loadCover(data["character_poster_url"], this.npcSp);
        }else{
            Utils.loadCover(data["avatar"], this.npcSp);
        }
    }

    onClickLike(){
        
    }

    onClickNpc(){
                AppConst.PanelManager.openView('res/View/Chat/ChatView', {
                    chatType: 2,
                    npcId: this.data.npc_id,
                    userName: this.data.name ?? undefined,
                });
    }
}


