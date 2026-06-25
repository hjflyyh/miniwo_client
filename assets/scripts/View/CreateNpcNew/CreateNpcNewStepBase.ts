import { _decorator, Component } from 'cc';
import { CreateNpcNew } from './CreateNpcNew';
const { ccclass } = _decorator;

/** 各流程页基类：在编辑器里把具体脚本挂到对应大节点上 */
@ccclass('CreateNpcNewStepBase')
export class CreateNpcNewStepBase extends Component {
    protected flow: CreateNpcNew | null = null;

    bindFlow(flow: CreateNpcNew) {
        this.flow = flow;
    }

    /** 切换到本页时调用 */
    onStepShow() {}

    /** 离开本页时调用 */
    onStepHide() {}

    protected getFlow(): CreateNpcNew | null {
        return this.flow;
    }
}
