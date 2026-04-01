import { _decorator, Component, Node, SpriteFrame, Texture2D } from 'cc';
import { AppConst } from '../AppConst';
const { ccclass, property } = _decorator;

@ccclass('JournalManager')
export class JournalManager extends Component {

    @property([SpriteFrame])
    public imgSprite : SpriteFrame[] = []

    public journalImgs = [
        {id : 1 , type : "localImg" , localImgIndex : 0},
        {id : 2 , type : "localImg" , localImgIndex : 1},
        {id : 3 , type : "localImg" , localImgIndex : 2},
    ]

    protected onLoad(): void {
        AppConst.JournalManager = this    
    }


    start() {

    }
}


