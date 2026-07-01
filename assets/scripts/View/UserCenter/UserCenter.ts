import { _decorator, Component, Label, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { RoleModel } from '../../Model/RoleModel';
import { network } from '../../Model/RequestData';
const { ccclass, property } = _decorator;

@ccclass('UserCenter')
export class UserCenter extends Component {
    @property(Label)
    userName: Label

    @property(Label)
    userId: Label

    @property(Label)
    info: Label


    start() {
        this.httpRequest()
        EventSystem.addListent("WebSocketNotifications", this.OnWSNotification, this)
        EventSystem.addListent("RefreshRoleData" , this.setUser , this)

        EventSystem.send("OnSetNowShowPanel", this.node["__url"])
        this.setUser()
    }
    

    httpRequest() {
        AppConst.SocialHttpManager.sendGetHttp("myfollows", {} , false)
        AppConst.SocialHttpManager.sendGetHttp("timelineList", {} , false)
    }

    setUser() {
        this.userName.string = RoleModel.getInstance().nickName
        this.userId.string = "id: " + RoleModel.getInstance().playerId
        this.info.string = RoleModel.getInstance().bio
    }

    OnClickCollect(){
        AppConst.PanelManager.openView("res/View/Main/Follow/CollectFollowList", null, null, "res/View/UserCenter/UserCenter")
    }

    OnClickLike(){
        AppConst.PanelManager.openView("res/View/Main/Follow/LikeFollowList", null, null, "res/View/UserCenter/UserCenter")
    }

    OnClickCard() {
        AppConst.PanelManager.openView("res/View/Card/CardList", null, null, "res/View/UserCenter/UserCenter")
    }

    OnClickBag() {
        AppConst.PanelManager.openView("res/View/Bag/BagList", null, null, "res/View/UserCenter/UserCenter")
    }

    OnClickShop() {
        AppConst.PanelManager.openView("res/View/Shop/ShopList", null, null, "res/View/UserCenter/UserCenter")
    }

    OnClickUserInfo() {
        AppConst.PanelManager.openView("res/View/UserCenter/UserInfo", null, null)
    }

    OnClickMail(){
        AppConst.PanelManager.openView("res/View/Mail/MailView", null, null)
    }
    OnClickVisit(){
        AppConst.PanelManager.openView("res/View/Visit/VisitList", null, null, "res/View/UserCenter/UserCenter")
    }

    private OnWSNotification(data) {
        if (data.code == network.ServerCode.CodeProfile) {
            this.setUser()
        }
    }
}


