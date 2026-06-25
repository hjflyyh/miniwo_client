import { _decorator, Component, Label, Sprite, SpriteFrame } from 'cc';
import { CreateNpcNewPersonalityStep } from './CreateNpcNewPersonalityStep';
const { ccclass, property } = _decorator;

/** 人设列表项，挂到 cell 模板上，逻辑同 RensheCell */
@ccclass('CreateNpcNewRensheCell')
export class CreateNpcNewRensheCell extends Component {
    @property(Label)
    rensheLabel: Label = null;

    @property(SpriteFrame)
    chooseSprite: SpriteFrame = null;

    @property(SpriteFrame)
    unChooseSprite: SpriteFrame = null;

    @property(Sprite)
    spriteNode: Sprite = null;

    private rensheId = 0;
    private step: CreateNpcNewPersonalityStep | null = null;

    bind(step: CreateNpcNewPersonalityStep, rensheId: number, rensheName: string) {
        this.step = step;
        this.rensheId = rensheId;
        if (this.rensheLabel) {
            this.rensheLabel.string = rensheName;
        }
        this.refreshChoose();
    }

    refreshChoose() {
        const ids = this.step?.getFlow()?.getDraft()?.rensheIds ?? [];
        const isIn = ids.indexOf(this.rensheId) >= 0;
        if (this.spriteNode && this.chooseSprite && this.unChooseSprite) {
            this.spriteNode.spriteFrame = isIn ? this.chooseSprite : this.unChooseSprite;
        }
    }

    onClickRenshe() {
        this.step?.toggleRenshe(this.rensheId);
    }
}
