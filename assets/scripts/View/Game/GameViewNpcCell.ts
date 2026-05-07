import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { Utils } from '../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('GameViewNpcCell')
export class GameViewNpcCell extends Component {
    @property(Label)
    npcName : Label = null

    @property(Sprite)
    npcIcon : Sprite = null

    private npcData = null
    start() {

    }

    public refreshData(data) {
        this.npcData = data
        this.npcName.string = data.name

        //npc_sprite_url
        Utils.loadCover(data.npc_sprite_url, this.npcIcon , 78 , 78);
    }
}

