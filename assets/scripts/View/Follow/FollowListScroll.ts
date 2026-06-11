import { _decorator, Component, instantiate, Node, Prefab, CCInteger } from 'cc';
import { IFDataSource, InfiniteList } from '../../../plugin/InfiniteList/InfiniteList';
import InfiniteCell from '../../../plugin/InfiniteList/InfiniteCell';
import { SocialModel } from '../../Model/SocialModel';
import { MainFollowListCell } from '../Main/Follow/MainFollowListCell';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('FollowListScroll')
export class FollowListScroll extends Component implements IFDataSource {
    @property(Prefab)
    cellPrefab: Prefab
    @property(CCInteger)
    showtype: number = 1

    infiniteList: InfiniteList

    GetCellNumber(): number {
        if (this.showtype == 2) {
            return SocialModel.getInstance().randomPostList.length;
        }
        if (this.showtype == 3) {
            return SocialModel.getInstance().likePostList.length;
        }
        if (this.showtype == 4) {
            return SocialModel.getInstance().favoritePostList.length;
        }
        return SocialModel.getInstance().otherPostList.length;
    }

    GetCellIdentifer(dataIndex: number): string {
        return 'cellNode';
    }
    GetCellSize(dataIndex: number): number {
        let data = this.GetCellData(dataIndex)
        let imageUrl = data?.ImageURL && JSON.parse(data?.ImageURL || "[]")
        if (imageUrl && imageUrl.length > 0) {
            return 1070
        } else {
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
        if (this.showtype == 2) {
            return SocialModel.getInstance().getPostDataByRandomPostList(dataIndex)
        }
        if (this.showtype == 3) {
            return SocialModel.getInstance().getPostDataByLikePostList(dataIndex)
        }
        if (this.showtype == 4) {
            return SocialModel.getInstance().getPostDataByFavoritePostList(dataIndex)
        }
        return SocialModel.getInstance().getPostDataByOtherPostList(dataIndex)
    }
    start() {
        this.scheduleOnce(() => {
            this.infiniteList = this.getComponent("InfiniteList") as InfiniteList
            this.infiniteList.Init(this)
            if (this.showtype == 1) {
                EventSystem.addListent("otherPostList", this.refreshData, this)
            } else if(this.showtype == 2){
                EventSystem.addListent("FollowRandomPostData", this.refreshData, this)
                // AppConst.SocialHttpManager.sendGetHttp("randomTimeline", {})
            }

            // this.refreshData();
        }, 0.1)
    }

    refreshData() {
        this.infiniteList.Reload(true);
    }
}


