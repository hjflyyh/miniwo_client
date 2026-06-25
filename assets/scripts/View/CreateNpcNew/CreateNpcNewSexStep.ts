import { _decorator, instantiate, Node } from 'cc';
import { CreateNpcNewSexCell } from './CreateNpcNewSexCell';
import { CreateNpcNewStepBase } from './CreateNpcNewStepBase';
const { ccclass, property } = _decorator;

/** sex 节点：性别列表（3 项），拖入 cell 模板（挂 CreateNpcNewSexCell） */
@ccclass('CreateNpcNewSexStep')
export class CreateNpcNewSexStep extends CreateNpcNewStepBase {
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

        for (let i = 0; i < 3; i++) {
            let cell = this.cells[i];
            if (!cell?.isValid) {
                cell = instantiate(this.cellTemplate);
                cell.parent = this.cellTemplate.parent;
                this.cells[i] = cell;
            }
            cell.active = true;
            cell.getComponent(CreateNpcNewSexCell)?.bind(this, i);
        }
    }

    selectSex(sex: number) {
        this.getFlow()?.setSex(sex);
        this.refreshList();
    }

    onClickNext() {
        this.getFlow()?.goNext();
    }

    onClickBack() {
        this.getFlow()?.goPrev();
    }
}
