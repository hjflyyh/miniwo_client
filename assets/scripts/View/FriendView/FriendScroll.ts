import { _decorator, Component, instantiate, Node, Prefab, CCInteger } from 'cc';
import { IFDataSource, InfiniteList } from '../../../plugin/InfiniteList/InfiniteList';
import InfiniteCell from '../../../plugin/InfiniteList/InfiniteCell';
import { SocialModel } from '../../Model/SocialModel';
import { FriendListCell } from './FriendListCell';
const { ccclass, property } = _decorator;

@ccclass('FriendScroll')
export class FriendScroll extends Component implements IFDataSource {
    @property(Prefab)
    cellPrefab: Prefab = null

    /** 1=互关列表 mutual_follow_list，2=粉丝列表 follower_list */
    @property(CCInteger)
    showtype: number = 1

    infiniteList: InfiniteList

    private getList() {
        const relations = SocialModel.getInstance().userFollowRelations
        if (!relations) {
            return []
        }
        return this.showtype == 2 ? relations.follower_list : relations.mutual_follow_list
    }

    GetCellNumber(): number {
        return this.getList().length
    }

    GetCellIdentifer(dataIndex: number): string {
        return 'friendCell'
    }

    GetCellSize(dataIndex: number): number {
        return 120
    }

    GetCellView(dataIndex: number, identifier?: string): InfiniteCell {
        const id = identifier || 'friendCell'
        const node = this.cellPrefab ? instantiate(this.cellPrefab) : new Node('FriendListCell')
        let comp = node.getComponent(FriendListCell)
        if (!comp) {
            comp = node.addComponent(FriendListCell)
        }
        comp.cellIdentifier = id
        return comp
    }

    GetCellData(dataIndex: number) {
        return {data : this.getList()[dataIndex] , type : this.showtype}
    }

    start() {
        this.scheduleOnce(() => {
            this.infiniteList = this.getComponent("InfiniteList") as InfiniteList
            if (!this.infiniteList) {
                return
            }
            this.infiniteList.Init(this)
            EventSystem.addListent("userFollowRelations", this.refreshData, this)
        }, 0.1)
    }

    refreshData() {
        if (!this.infiniteList) {
            return
        }
        this.infiniteList.Reload(true)
    }
}
