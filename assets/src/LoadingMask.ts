import { _decorator, Component, Node, sys } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LoadingMask')
export class LoadingMask extends Component {
    showAry = [];

    @property(Node)
    showNode: Node = null;

    start() {
        this.showNode.active = false;
        EventSystem.addListent("ShowJuhua" , this.OnShowJuhua , this);
        EventSystem.addListent("HideJuhua" , this.OnHideJuhua , this);
        EventSystem.addListent("ClearJuhua" , this.ClearAll , this);
    }

    OnShowJuhua(type)
    {
        // if(this.showAry.indexOf(type) <= 0)
        // {
        //     this.showAry.push(type);
        // }
        this.unscheduleAllCallbacks();
        this.showAry.push(type);
        this.showNode.active = this.showAry.length > 0;

        // cc.log("waitFightEndByServer");

        this.waitAnimShow();
        // let openUIType = "";
        // if(sys.platform == sys.MOBILE_BROWSER){
        //     openUIType = "OPEN_UI"
        // }
        // if(type == "eventWaitPay" || type == "httpSend" || type == "waitWSLogin" || type == "onPVPSendList" || type == "eventWaitRestart" || type == openUIType){
        //     this.waitAnimShow();
        // }else{
        //     this.scheduleOnce(this.waitAnimShow , 2.5)
        // }
    }

    waitAnimShow(){
        // this.anim.play()
        // this.anim.active = true;
        this.showNode.active = true;
    }

    OnHideJuhua(type)
    {
        if(this.showAry.indexOf(type) >= 0)
        {
            this.showAry.splice(this.showAry.indexOf(type) , 1);
        }
        this.showNode.active = this.showAry.length > 0;
        // this.node.active = this.showAry.length > 0;
        // this.anim.play()
    }

    ClearAll(){
        this.showAry = [];
        this.showNode.active = this.showAry.length > 0;
    }
}

