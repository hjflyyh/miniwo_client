import { _decorator, EditBox } from 'cc';
import { CreateNpcNewStepBase } from './CreateNpcNewStepBase';
const { ccclass, property } = _decorator;

/** name 节点：输入名字并创建 NPC，自行绑定输入框与按钮 */
@ccclass('CreateNpcNewNameStep')
export class CreateNpcNewNameStep extends CreateNpcNewStepBase {
    @property(EditBox)
    nameEdit: EditBox = null;

    @property(EditBox)
    ageEdit: EditBox = null;

    onStepShow() {
        const draft = this.getFlow()?.getDraft();
        if (!draft) {
            return;
        }
        // if (this.nameEdit && draft.name) {
        //     this.nameEdit.string = draft.name;
        // }
        // if (this.ageEdit) {
        //     this.ageEdit.string = String(draft.age || 18);
        // }
    }

    onClickCreate() {
        if(this.nameEdit?.string == "" || this.ageEdit?.string == ""){
            EventSystem.send("ShowTips" , "Enter npc name and age")
            return
        }
        const name = this.nameEdit?.string?.trim() ?? '';
        const ageRaw = this.ageEdit?.string?.trim() ?? '';
        const age = ageRaw ? Number(ageRaw) : 18;
        this.getFlow()?.submitCreateNpc(name, age);
    }

    onClickBack() {
        this.getFlow()?.goPrev();
    }å
}
