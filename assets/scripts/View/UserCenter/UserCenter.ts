import { _decorator, Component, Label, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { RoleModel } from '../../Model/RoleModel';
const { ccclass, property } = _decorator;

@ccclass('UserCenter')
export class UserCenter extends Component {
    @property(Label)
    userName : Label

    @property(Label)
    userId : Label

    @property(Label)
    info : Label


    start() {
        EventSystem.send("OnSetNowShowPanel" , this.node["__url"])

        this.setUser()
    }
    
    setUser(){
        this.userName.string = RoleModel.getInstance().nickName
        this.userId.string = RoleModel.getInstance().playerId
        this.info.string =  RoleModel.getInstance().bio
    }

    OnClickCard(){
        AppConst.PanelManager.openView("res/View/Card/CardList" , null , null , "res/View/UserCenter/UserCenter")
    }

    OnClickBag(){
        AppConst.PanelManager.openView("res/View/Bag/BagList" , null , null , "res/View/UserCenter/UserCenter")
    }
}


