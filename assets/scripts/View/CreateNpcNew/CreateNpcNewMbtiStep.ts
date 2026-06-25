import { _decorator, instantiate, Node } from 'cc';
import { UGCModel } from '../../Model/UGCModel';
import { CreateNpcNewMbtiCell } from './CreateNpcNewMbtiCell';
import { CreateNpcNewStepBase } from './CreateNpcNewStepBase';
const { ccclass, property } = _decorator;

/** mbti 节点：MBTI 列表，拖入 cell 模板（挂 CreateNpcNewMbtiCell） */
@ccclass('CreateNpcNewMbtiStep')
export class CreateNpcNewMbtiStep extends CreateNpcNewStepBase {
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

        const list = UGCModel.getInstance().getMBTIList();
        for (let i = 0; i < list.length; i++) {
            let cell = this.cells[i];
            if (!cell?.isValid) {
                cell = instantiate(this.cellTemplate);
                cell.parent = this.cellTemplate.parent;
                this.cells[i] = cell;
            }
            cell.active = true;
            cell.getComponent(CreateNpcNewMbtiCell)?.bind(this, list[i].tag_name, list[i].id);
        }
        for (let i = list.length; i < this.cells.length; i++) {
            if (this.cells[i]?.isValid) {
                this.cells[i].active = false;
            }
        }
    }

    selectMbti(mbtiId: number) {
        this.getFlow()?.setMbti(mbtiId);
        this.refreshList();
    }

    onClickNext() {
        if (!this.getFlow()?.canLeaveMbti()) {
            EventSystem.send('ShowTips', 'Please select MBTI');
            return;
        }
        this.getFlow()?.goNext();
    }

    onClickBack() {
        this.getFlow()?.goPrev();
    }
}
