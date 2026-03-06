import { _decorator, CCInteger, Color, Component, Label, Node, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('SelectionItem')
export class SelectionItem extends Component {
    @property(CCInteger)
    public changeIndex : number = -1

    @property(Sprite)
    public imgSprite : Sprite

    //选中状态的图
    @property(SpriteFrame)
    public chooseFrame : SpriteFrame

    //未选中状态的图
    @property(SpriteFrame)
    public unChooseFrame : SpriteFrame

    @property(Label)
    public showLabel : Label

    // @property(Color)
    // public chooseLabelColor : Color

    // @property(Color)
    // public unChooseLabelColor : Color

    start() {

    }


    public setIndex(index){
        if(this.imgSprite != null){
            if(index == this.changeIndex){
                this.imgSprite.spriteFrame = this.chooseFrame
            }else{
                this.imgSprite.spriteFrame = this.unChooseFrame
            }
        }
        // if(this.showLabel != null && this.chooseLabelColor != null && this.unChooseLabelColor != null){
        //     if(index == this.changeIndex){
        //         this.showLabel.color = this.chooseLabelColor
        //     }else{
        //         this.showLabel.color = this.unChooseLabelColor
        //     }
        // }
    }
}


