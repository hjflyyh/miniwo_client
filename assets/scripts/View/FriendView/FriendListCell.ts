import { _decorator, Label, Sprite, Node } from 'cc';
import InfiniteCell from '../../../plugin/InfiniteList/InfiniteCell';
import { AppConst } from '../../AppConst';
import { SocialModel } from '../../Model/SocialModel';
import { RoleModel } from '../../Model/RoleModel';
const { ccclass, property } = _decorator;

@ccclass('FriendListCell')
export class FriendListCell extends InfiniteCell {
    @property(Label)
    nickName: Label = null

    @property(Label)
    playerIdLabel: Label = null

    @property(Sprite)
    headSp: Sprite = null

    @property(Node)
    followNode: Node = null

    private playerId: number = 0
    private cellType: number = 1

    start() {
        EventSystem.addListent("followBack", this.onFollowBack, this)
    }

    UpdateContent(data: any): void {
        this.cellType = data?.type ?? 1
        this.followNode.active = this.cellType == 2
        this.onRefresh(data?.data)
    }

    onRefresh(data: { player_id?: number, nick_name?: string }) {
        this.playerId = Number(data?.player_id ?? 0)
        if (this.nickName) {
            this.nickName.string = data?.nick_name || ""
        }
        if (this.playerIdLabel) {
            this.playerIdLabel.string = this.playerId ? "id:" + String(this.playerId) : ""
        }
        this.updateFollowVisible()
    }

    onClickFollow() {
        if (!this.playerId) {
            return
        }
        if (SocialModel.getInstance().isFollowing(this.playerId)) {
            this.updateFollowVisible()
            return
        }
        if (this.followNode) {
            this.followNode.active = false
        }
        AppConst.SocialHttpManager.sendPostHttp("follow", {
            followedUserId: this.playerId,
        })
    }

    onFollowBack(followedUserId?: number) {
        if (followedUserId != null && followedUserId != this.playerId) {
            return
        }
        this.updateFollowVisible()
    }

    updateFollowVisible() {
        if (!this.followNode || this.cellType !== 2) {
            return
        }
        this.followNode.active = !SocialModel.getInstance().isFollowing(this.playerId)
    }
}
