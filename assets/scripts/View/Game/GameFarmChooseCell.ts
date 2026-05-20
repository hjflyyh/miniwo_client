import { _decorator, Component, Label, Node, resources, Sprite, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameFarmChooseCell')
export class GameFarmChooseCell extends Component {
    @property(Sprite)
    spriteRoot : Sprite

    @property(Label)
    shownumber : Label

    itemCount = 0
    start() {

    }

    refreshNode(itemId: number, count: number, _displayName?: string){
        this.itemCount = count;
        resources.load(`UITexture/itemIcon/${itemId}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (!err && sf && this.spriteRoot.isValid) {
                this.spriteRoot.spriteFrame = sf;
            }
        });
        this.shownumber.string = `x${count}`;
    }

    onClick(){
        if(this.itemCount > 0){ 

        }else{
            EventSystem.send("ShowTips" , "Insufficient seeds")
        }
    }
}

