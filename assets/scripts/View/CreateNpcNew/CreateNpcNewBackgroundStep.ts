import { _decorator, instantiate, Node } from 'cc';
import { UGCModel } from '../../Model/UGCModel';
import { CreateNpcNewBackgroundCell } from './CreateNpcNewBackgroundCell';
import { CreateNpcNewStepBase } from './CreateNpcNewStepBase';
const { ccclass, property } = _decorator;

/** hobbies 节点：背景列表，拖入 cell 模板（挂 CreateNpcNewBackgroundCell） */
@ccclass('CreateNpcNewBackgroundStep')
export class CreateNpcNewBackgroundStep extends CreateNpcNewStepBase {
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

        const list = UGCModel.getInstance().getBackgroundList();
        for (let i = 0; i < list.length; i++) {
            let cell = this.cells[i];
            if (!cell?.isValid) {
                cell = instantiate(this.cellTemplate);
                cell.parent = this.cellTemplate.parent;
                this.cells[i] = cell;
            }
            cell.active = true;
            cell.getComponent(CreateNpcNewBackgroundCell)?.bind(this, list[i].id, list[i].tag_name);
        }
        for (let i = list.length; i < this.cells.length; i++) {
            if (this.cells[i]?.isValid) {
                this.cells[i].active = false;
            }
        }
    }

    toggleBackground(backgroundId: number) {
        this.getFlow()?.toggleBackground(backgroundId);
        this.refreshList();
    }

    onClickNext() {
        if (!this.getFlow()?.canLeaveBackground()) {
            EventSystem.send('ShowTips', 'Please select a background');
            return;
        }
        this.getFlow()?.goNext();
    }

    onClickBack() {
        this.getFlow()?.goPrev();
    }
}
