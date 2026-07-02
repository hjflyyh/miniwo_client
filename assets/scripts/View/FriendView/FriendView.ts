import { _decorator, Component, Label, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { SocialModel } from '../../Model/SocialModel';
import { FriendScroll } from './FriendScroll';
const { ccclass, property } = _decorator;

@ccclass('FriendView')
export class FriendView extends Component {
    @property(FriendScroll)
    friendScroll: FriendScroll = null

    @property([Node])
    chooseNodes : Node[] = []

    @property([Node])
    chooseLabelNodes : Node[] = []

    @property(Label)
    emptyLabel: Label = null

    showIndex = 1

    start() {
        EventSystem.addListent("userFollowRelations", this.onUserFollowRelations, this)
        EventSystem.addListent("followBack", this.onFollowBack, this)
        EventSystem.send("OnSetNowShowPanel", this.node["__url"])
        this.onUserFollowRelations(SocialModel.getInstance().userFollowRelations)
        this.httpRequest()
        this.refreshTab();
    }

    httpRequest() {
        AppConst.SocialHttpManager.sendGetHttp("userFollowRelations", {            
            page: 1,
            pageSize: 100,
        })
    }

    onUserFollowRelations(data?: {
        mutual_follow_list: { player_id: number, nick_name: string }[]
        mutual_follow_total: number
        follower_list: { player_id: number, nick_name: string }[]
        follower_total: number
        page: number
        page_size: number
    }) {
        console.log("------------------------")
        console.log(data?.mutual_follow_list)
        console.log(data?.follower_list)
        this.refreshTab();
        const relations = data ?? SocialModel.getInstance().userFollowRelations

        if (!relations) {
            return
        }
        
        // if (this.mutualTabLabel) {
        //     this.mutualTabLabel.string = String(relations.mutual_follow_total ?? 0)
        // }
        // if (this.followerTabLabel) {
        //     this.followerTabLabel.string = String(relations.follower_total ?? 0)
        // }
    }

    refreshTab(){
        for(let i = 0; i < this.chooseNodes.length; i++){
            this.chooseLabelNodes[i].active = i+1 == this.showIndex
            this.chooseNodes[i].active = i+1 == this.showIndex
        }
        this.friendScroll.showtype = this.showIndex
        this.friendScroll.refreshData()
        
        const relations = SocialModel.getInstance().userFollowRelations
        if (!relations) {
            this.emptyLabel.string = this.showIndex == 1 ? "No friends" : "No fans"
        }
        if(this.showIndex == 1){
            this.emptyLabel.string = relations?.mutual_follow_total ? "" : "No friends"
        }
        if(this.showIndex == 2){
            this.emptyLabel.string = relations?.follower_total ? "" : "No fans"
        }

    }

    onClickTab(a , b){
        this.showIndex = b
        this.refreshTab()
    }

    onFollowBack() {
        this.refreshTab()
    }
}
