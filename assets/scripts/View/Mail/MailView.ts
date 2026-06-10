import { _decorator, Component, Label, Node } from 'cc';
import { network } from '../../Model/RequestData';
import { AppConst } from '../../AppConst';
import { MailModel } from '../../Model/MailModel';
const { ccclass, property } = _decorator;

@ccclass('MailView')
export class MailView extends Component {
    @property(Node)
    public mailContent : Node

    @property(Label)
    public tipsContent : Label

    @property(Label)
    public tipsTitle : Label

    start() {
        EventSystem.addListent("OnClickMailCell" , this.OnClickMailCell , this)
        this.mailContent.active = false
    }

    OnClickMailCell(data){
        this.mailContent.active = true
        this.tipsTitle.string = data.title
        this.tipsContent.string = data.content

        MailModel.getInstance().OnRead(data.id)
    }
    
    public onClickCloseContent(){
        this.mailContent.active = false
    }
}

