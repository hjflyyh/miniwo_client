import { _decorator, Component, Node, Sprite } from 'cc';
import { AppConst } from '../../AppConst';
import { FollowImgChoose } from './FollowImgChoose';
import { Utils } from '../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('FollowImgCell')
export class FollowImgCell extends Component {
    @property(Node)
    public chooseNode : Node;

    @property(Sprite)
    public showSp : Sprite;

    @property(Node)
    public waitNode : Node;

    private data
    private parentView : FollowImgChoose
    start() {

    }

    protected update(dt: number): void {
        this.waitNode.active = !this.showSp.spriteFrame
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
        if(this.data["type"] == "modelImg"){
            Utils.loadCoverFitInsideParent(this.data["model_url"], this.showSp)
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


