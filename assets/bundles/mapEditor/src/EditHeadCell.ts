import { _decorator, Component, Node, Sprite } from 'cc';
import { EditHead } from './EditHead';
const { ccclass, property } = _decorator;

@ccclass('EditHeadCell')
export class EditHeadCell extends Component {
    private npcData: any;

    @property(Node)
    public editHead: Node;

    private editHComp: EditHead | null = null;

    start() {
    }

    init(npcData: any) {
        this.npcData = npcData;
        this.editHComp = this.editHead.getComponent("EditHead") as EditHead;
        this.editHComp?.registerCell(String(npcData.id), this);
    }

    setSelected(selected: boolean) {
        const sp = this.node.getChildByName('Sprite')?.getComponent(Sprite);
        if (sp) {
            sp.grayscale = !selected;
        }
    }

    onClickNpc() {
        this.editHComp?.addHead(this.npcData.id);
    }
}
