import { _decorator, Component, Label, Node } from 'cc';
import { CreateNpcNewBackgroundStep } from './CreateNpcNewBackgroundStep';
const { ccclass, property } = _decorator;

/** 背景列表项，挂到 cell 模板上，逻辑同 BackgroundCell */
@ccclass('CreateNpcNewBackgroundCell')
export class CreateNpcNewBackgroundCell extends Component {
    @property(Label)
    backgroundLabel: Label = null;

    @property(Node)
    chooseNode: Node = null;

    private backgroundId = 0;
    private step: CreateNpcNewBackgroundStep | null = null;

    bind(step: CreateNpcNewBackgroundStep, backgroundId: number, backgroundName: string) {
        this.step = step;
        this.backgroundId = backgroundId;
        if (this.backgroundLabel) {
            this.backgroundLabel.string = backgroundName;
        }
        this.refreshChoose();
    }

    refreshChoose() {
        const ids = this.step?.getFlow()?.getDraft()?.backgroundIds ?? [];
        const isIn = ids.indexOf(this.backgroundId) >= 0;
        if (this.chooseNode) {
            this.chooseNode.active = isIn;
        }
    }

    onClick() {
        this.step?.toggleBackground(this.backgroundId);
    }
}
