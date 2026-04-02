import { _decorator, Component, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('UGCNpcTabCell')
export class UGCNpcTabCell extends Component {
    @property(Label)
    public npcNameLabel : Label = null;

    start() {

    }

    refreshNpcInfo(npcInfo){
        this.npcNameLabel.string = npcInfo.name;
    }
}

