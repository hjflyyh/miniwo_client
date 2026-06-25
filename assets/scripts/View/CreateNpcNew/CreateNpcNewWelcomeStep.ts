import { _decorator } from 'cc';
import { CreateNpcNewStepBase } from './CreateNpcNewStepBase';
const { ccclass } = _decorator;

/** Welcome 节点：欢迎页，自行绑定按钮等 */
@ccclass('CreateNpcNewWelcomeStep')
export class CreateNpcNewWelcomeStep extends CreateNpcNewStepBase {
    onClickNext() {
        this.getFlow()?.goNext();
    }
}
