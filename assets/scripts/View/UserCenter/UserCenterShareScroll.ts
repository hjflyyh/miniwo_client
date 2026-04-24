import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { IFDataSource, InfiniteList } from '../../../plugin/InfiniteList/InfiniteList';
import InfiniteCell from '../../../plugin/InfiniteList/InfiniteCell';
import { UserCenterShareCell } from './UserCenterShareCell';
import { SocialModel } from '../../Model/SocialModel';
const { ccclass, property } = _decorator;

@ccclass('UserCenterShareScroll')
export class UserCenterShareScroll extends Component implements IFDataSource {
    @property(Prefab)
    cellPrefab: Prefab

    infiniteList: InfiniteList
    start() {

        this.scheduleOnce(() => {
            this.infiniteList = this.getComponent("InfiniteList") as InfiniteList
            this.infiniteList.Init(this)
        }, 0.1)

        //刷新，需要在init之后
        // this.infiniteList.Reload(true)
    }
    GetCellNumber(): number {
        return Math.ceil(SocialModel.getInstance().postList.length / 2)
    }
    GetCellIdentifer(dataIndex: number): string {
        //不用改
        return ""
    }
    GetCellSize(dataIndex: number): number {
        //不用改
        return 600
    }
    GetCellView(dataIndex: number, identifier?: string): InfiniteCell {
        const id = identifier || 'cellChat';
        const node = instantiate(this.cellPrefab);
        let comp = node.getComponent(UserCenterShareCell);
        //显示节点，2个一组
        if (!comp) comp = node.addComponent(UserCenterShareCell);

        return comp;
    }
    GetCellData?(dataIndex: number) {
        //朋友圈具体数据，2个一组
        return dataIndex
    }
}


