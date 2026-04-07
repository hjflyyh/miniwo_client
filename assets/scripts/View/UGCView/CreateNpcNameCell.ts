import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { CreateNpc } from './CreateNpc';
const { ccclass, property } = _decorator;

@ccclass('CreateNpcNameCell')
export class CreateNpcNameCell extends Component {
    @property(Sprite)
    public chooseNode : Sprite = null;

    @property(Label)
    public nameLabel : Label = null;

    private npcId = 0
    start() {

    }

    refreshNpcInfo(npcInfo: any , createNpcView : CreateNpc){
        this.npcId = npcInfo.id;
        this.chooseNode.enabled = createNpcView.chooseNpcId == npcInfo.id;
        this.nameLabel.string = npcInfo.name;
    }

    onClickNpc(){
        EventSystem.send("CreateNpcNameCell" , this.npcId)
    }
}

