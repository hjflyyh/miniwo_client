import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { Utils } from '../../Utils/Utils';
import { CGView } from './CGView';
const { ccclass, property } = _decorator;

@ccclass('CGViewCell')
export class CGViewCell extends Component {
    @property(Label)
    showIndex : Label

    @property(Sprite)
    showSp : Sprite

    @property(Label)
    title : Label

    cgview : CGView
    data
    start() {

    }

    refreshNode(data , index , CGView){
        this.data = data
        this.showIndex.string = index + 1
        this.title.string = data.title
        this.showSp.spriteFrame = null
        Utils.loadCover(data.cg_url , this.showSp)
        this.cgview = CGView
    }

    onClick(){
        this.cgview.showMax(this.data.cg_url);
    }
}

