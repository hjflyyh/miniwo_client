import { _decorator, Component, Label, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { RoleModel } from '../../Model/RoleModel';
import { SocialModel } from '../../Model/SocialModel';
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

    @property(Label)
    likeNumber : Label

    @property(Label)
    firendNumber : Label

    @property(Label)
    heatNumber : Label

    start() {
        this.httpRequest()
        EventSystem.addListent("WebSocketNotifications", this.OnWSNotification, this)
        EventSystem.addListent("RefreshRoleData" , this.setUser , this)
        EventSystem.addListent("userSocialStats", this.setSocialStats, this)

        EventSystem.send("OnSetNowShowPanel", this.node["__url"])
        this.setUser()
        this.setSocialStats(SocialModel.getInstance().userSocialStats)
    }
    

    httpRequest() {
        AppConst.SocialHttpManager.sendGetHttp("myfollows", {} , false)
        AppConst.SocialHttpManager.sendGetHttp("timelineList", {} , false)
        AppConst.SocialHttpManager.sendGetHttp("userSocialStats", {}, false)
    }

    setSocialStats(stats?: {
        mutual_follow_count: number
        liked_post_count: number
        post_received_like_count: number
    }) {
        const data = stats ?? SocialModel.getInstance().userSocialStats
        if (!data) {
            return
        }
        if (this.likeNumber) {
            this.likeNumber.string = String(data.liked_post_count ?? 0)
        }
        if (this.firendNumber) {
            this.firendNumber.string = String(data.mutual_follow_count ?? 0)
        }
        if (this.heatNumber) {
            this.heatNumber.string = String(data.post_received_like_count ?? 0)
        }
    }

    OnClickSwitch(){
             AppConst.PanelManager.openView('res/View/Common/CheckCancelCommon', {
                showText: `Log out and switch accounts`,
                "callback" : this.callBackSwitch ,
                "callbackParent" : this
            });       
    }

    callBackSwitch(){
        RoleModel.getInstance().switchAccount()
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

    OnClickFriend(){
         AppConst.PanelManager.openView("res/View/FriendView/FriendView", null, null , "res/View/UserCenter/UserCenter")
    }

    private OnWSNotification(data) {
        if (data.code == network.ServerCode.CodeProfile) {
            this.setUser()
        }
    }
}


