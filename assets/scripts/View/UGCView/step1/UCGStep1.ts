import { _decorator, Component, instantiate, Node } from 'cc';
import { RoleModel } from '../../../Model/RoleModel';
import { UCGStepCell1 } from './UCGStepCell1';
// import { RoleModel } from '../../Model/RoleModel';
const { ccclass, property } = _decorator;

@ccclass('UCGStep1')
export class UCGStep1 extends Component {
    @property(Node)
    public tagCell: Node = null;

    private tagNodes = []
    start() {
        this.initTags();
    }

    initTags(){
        console.log(RoleModel.getInstance().tags)
        for(let i = 0 ; i < RoleModel.getInstance().tags.length ; i++){
            if(RoleModel.getInstance().tags[i].tag_type == 1){
                let tagNode = instantiate(this.tagCell)
                tagNode.parent = this.tagCell.parent
                tagNode.active = true
                
                let tagCell : UCGStepCell1 = tagNode.getComponent(UCGStepCell1)
                tagCell.initCell(RoleModel.getInstance().tags[i])

                this.tagNodes.push(tagNode)
            }
        }

        this.tagCell.active = false;
    }
}

