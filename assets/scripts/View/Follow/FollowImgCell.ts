import { _decorator, Component, Node, Sprite } from 'cc';
import { AppConst } from '../../AppConst';
import { FollowImgChoose } from './FollowImgChoose';
const { ccclass, property } = _decorator;

@ccclass('FollowImgCell')
export class FollowImgCell extends Component {
    @property(Node)
    public chooseNode : Node;

    @property(Sprite)
    public showSp : Sprite;

    private data
    private parentView : FollowImgChoose
    start() {

    }

    refreshData(data){
        this.data = data.data
        this.parentView = data.view

        this.setChooseNode();
        this.setImg();

        EventSystem.addListent("OnFollowChooseImgCell" , this.setChooseNode , this)
    }

    setImg(){
        if(this.data["type"] == "localImg"){
            this.showSp.spriteFrame = AppConst.JournalManager.imgSprite[this.data["localImgIndex"]]
        }
    }

    setChooseNode(){
        for(let i = 0 ; i < this.parentView.openData.length ; i++){
            if(this.parentView.openData[i]["id"] == this.data["id"] && this.parentView.openData[i]["type"] == this.data["type"]){
                this.chooseNode.active = true
                return;
            }
        }
        this.chooseNode.active = false
    }

    onClick(){
        this.parentView.clickCell(this.data)
    }
}


