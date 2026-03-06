import { _decorator, Component, instantiate, Label, Node , Animation, __private} from 'cc';
const { ccclass, property } = _decorator;

@ccclass('TipsView')
export class TipsView extends Component {
    @property(Node)
    tipsNode : Node

    start() {
        this.tipsNode.active = false
        EventSystem.addListent("ShowTips" , this.OnShowTips , this)
    }
    

    OnShowTips(a){
        let newText = instantiate(this.tipsNode)
        newText.active = true
        this.node.addChild(newText)

        let label = newText.getChildByName("bg").getChildByName("tipTxt").getComponent(Label)
        label.string = a

        let labelAnim = newText.getComponent(Animation) as Animation
        labelAnim.on("finished" , this.onFinished, this)
    }

    onFinished(a , b){
        b._target.node.destroy()
    }
}


