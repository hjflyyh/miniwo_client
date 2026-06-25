import { _decorator, instantiate, Node } from 'cc';
import { UGCModel } from '../../Model/UGCModel';
import { CreateNpcNewRensheCell } from './CreateNpcNewRensheCell';
import { CreateNpcNewStepBase } from './CreateNpcNewStepBase';
const { ccclass, property } = _decorator;

/** personality 节点：人设列表（最多选 3 个），拖入 cell 模板（挂 CreateNpcNewRensheCell） */
@ccclass('CreateNpcNewPersonalityStep')
export class CreateNpcNewPersonalityStep extends CreateNpcNewStepBase {
    @property(Node)
    cellTemplate: Node = null;

    private cells: Node[] = [];

    onStepShow() {
        this.refreshList();
    }

    refreshList() {
        if (!this.cellTemplate?.isValid) {
            return;
        }
        this.cellTemplate.active = false;

        const list = UGCModel.getInstance().getRensheList();
        for (let i = 0; i < list.length; i++) {
            let cell = this.cells[i];
            if (!cell?.isValid) {
                cell = instantiate(this.cellTemplate);
                cell.parent = this.cellTemplate.parent;
                this.cells[i] = cell;
            }
            cell.active = true;
            cell.getComponent(CreateNpcNewRensheCell)?.bind(this, list[i].id, list[i].tag_name);
        }
        for (let i = list.length; i < this.cells.length; i++) {
            if (this.cells[i]?.isValid) {
                this.cells[i].active = false;
            }
        }
    }

    toggleRenshe(rensheId: number) {
        if (this.getFlow()?.toggleRenshe(rensheId)) {
            this.refreshList();
        }
    }

    onClickNext() {
        if (!this.getFlow()?.canLeavePersonality()) {
            EventSystem.send('ShowTips', 'Please select at least one trait');
            return;
        }
        this.getFlow()?.goNext();
    }

    onClickBack() {
        this.getFlow()?.goPrev();
    }
}
