import { _decorator, Component, Label, Node } from 'cc';
import { CreateNpcNewMbtiStep } from './CreateNpcNewMbtiStep';
const { ccclass, property } = _decorator;

/** MBTI 列表项，挂到 cell 模板上，逻辑同 MTBICell */
@ccclass('CreateNpcNewMbtiCell')
export class CreateNpcNewMbtiCell extends Component {
    @property(Label)
    mbtiLabel: Label = null;

    @property(Node)
    chooseNode: Node = null;

    private mbtiId = 0;
    private step: CreateNpcNewMbtiStep | null = null;

    bind(step: CreateNpcNewMbtiStep, mbtiName: string, mbtiId: number) {
        this.step = step;
        this.mbtiId = mbtiId;
        if (this.mbtiLabel) {
            this.mbtiLabel.string = mbtiName;
        }
        this.refreshChoose();
    }

    refreshChoose() {
        const selected = this.step?.getFlow()?.getDraft()?.mbtiId ?? 0;
        if (this.chooseNode) {
            this.chooseNode.active = selected === this.mbtiId;
        }
    }

    onClickMBTI() {
        this.step?.selectMbti(this.mbtiId);
    }
}
