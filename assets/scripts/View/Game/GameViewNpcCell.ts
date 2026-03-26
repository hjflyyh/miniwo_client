import { _decorator, Component, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameViewNpcCell')
export class GameViewNpcCell extends Component {
    @property(Label)
    npcName : Label = null

    private npcData = null
    start() {

    }

    public refreshData(data) {
        this.npcData = data
        this.npcName.string = data.name
    }
}

