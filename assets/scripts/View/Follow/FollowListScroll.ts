import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { IFDataSource, InfiniteList } from '../../../plugin/InfiniteList/InfiniteList';
import InfiniteCell from '../../../plugin/InfiniteList/InfiniteCell';
import { SocialModel } from '../../Model/SocialModel';
import { MainFollowListCell } from '../Main/Follow/MainFollowListCell';
const { ccclass, property } = _decorator;

@ccclass('FollowListScroll')
export class FollowListScroll extends Component implements IFDataSource{
    @property(Prefab)
    cellPrefab : Prefab

    infiniteList :InfiniteList

    GetCellNumber(): number {
        return SocialModel.getInstance().otherPostList.length;
    }
    GetCellIdentifer(dataIndex: number): string {
        return 'cellNode';
    }
    GetCellSize(dataIndex: number): number {
        let data = SocialModel.getInstance().otherPostList[dataIndex]
        let imageUrl = data?.ImageURL && JSON.parse(data?.ImageURL || "[]")
        if (imageUrl && imageUrl.length > 0) {
            return 1070
        }else{
            return 420
        }

    }
    GetCellView(dataIndex: number, identifier?: string): InfiniteCell {
        const id = identifier || 'cellNode';
        const node = this.cellPrefab ? instantiate(this.cellPrefab) : new Node('ChatListCell');
        let comp = node.getComponent(MainFollowListCell);
        if (!comp) comp = node.addComponent(MainFollowListCell);
        comp.cellIdentifier = id;
        return comp;
    }
    GetCellData?(dataIndex: number) {
        return SocialModel.getInstance().otherPostList[dataIndex]
    }
    start() {
        this.scheduleOnce(()=>{
            EventSystem.addListent("otherPostList", this.refreshData, this)
            this.infiniteList = this.getComponent("InfiniteList") as InfiniteList
            this.infiniteList.Init(this)

            this.refreshData();
        } , 0.1)
    }

    refreshData() {
        this.infiniteList.Reload(true);
    }
}


