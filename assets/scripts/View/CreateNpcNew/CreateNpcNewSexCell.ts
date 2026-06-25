import { _decorator, Component, Label, Node } from 'cc';
import { CreateNpcNewSexStep } from './CreateNpcNewSexStep';
const { ccclass, property } = _decorator;

/** 性别列表项（0=Man 1=Woman 2=Other），挂到 cell 模板上，逻辑同 SexCell */
@ccclass('CreateNpcNewSexCell')
export class CreateNpcNewSexCell extends Component {
    @property(Label)
    sexLabel: Label = null;

    @property(Node)
    chooseNode: Node = null;

    private sexId = 0;
    private step: CreateNpcNewSexStep | null = null;

    bind(step: CreateNpcNewSexStep, sex: number) {
        this.step = step;
        this.sexId = sex;
        if (this.sexLabel) {
            if (sex === 0) {
                this.sexLabel.string = 'Man';
            } else if (sex === 1) {
                this.sexLabel.string = 'Woman';
            } else {
                this.sexLabel.string = 'Other';
            }
        }
        this.refreshChoose();
    }

    refreshChoose() {
        const selected = this.step?.getFlow()?.getDraft()?.sex ?? 0;
        if (this.chooseNode) {
            this.chooseNode.active = selected === this.sexId;
        }
    }

    onClickSex() {
        this.step?.selectSex(this.sexId);
    }
}
