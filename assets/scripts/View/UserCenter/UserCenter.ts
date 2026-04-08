import { _decorator, Component, Label, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { RoleModel } from '../../Model/RoleModel';
const { ccclass, property } = _decorator;

@ccclass('UserCenter')
export class UserCenter extends Component {
    @property(Label)
    userName : Label

    start() {
        EventSystem.send("OnSetNowShowPanel" , this.node["__url"])

        this.setUser()
    }
    
    setUser(){
        this.userName.string = RoleModel.getInstance().nickName
    }

    OnClickCard(){
        AppConst.PanelManager.openView("res/View/Card/CardList" , null , null , "res/View/UserCenter/UserCenter")
    }

    OnClickBag(){
        AppConst.PanelManager.openView("res/View/Bag/BagList" , null , null , "res/View/UserCenter/UserCenter")
    }
}


