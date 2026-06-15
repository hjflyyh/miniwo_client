import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import InfiniteCell from 'db://assets/plugin/InfiniteList/InfiniteCell';
import { IFDataSource, InfiniteList } from 'db://assets/plugin/InfiniteList/InfiniteList';
import { MailModel } from '../../Model/MailModel';
import { MailCell } from './MailCell';
const { ccclass, property } = _decorator;

@ccclass('MailScroll')
export class MailScroll extends Component implements IFDataSource {
    @property(Prefab)
    cellPrefab : Prefab

    infiniteList :InfiniteList

    GetCellNumber(): number {
        return MailModel.getInstance().mails.length;
    }
    GetCellIdentifer(dataIndex: number): string {
        return 'cellMail';
    }
    GetCellSize(dataIndex: number): number {
        return 140
    }
    GetCellView(dataIndex: number, identifier?: string): InfiniteCell {
        const id = identifier ;
        const node = this.cellPrefab ? instantiate(this.cellPrefab) : new Node('ChatListCell');
        let comp = node.getComponent(MailCell);
        if (!comp) comp = node.addComponent(MailCell);
        comp.cellIdentifier = id;
        return comp;
    }
    GetCellData?(dataIndex: number) {
        return MailModel.getInstance().mails[dataIndex]
    }

    start() {
        this.scheduleOnce(()=>{
            this.infiniteList = this.getComponent("InfiniteList") as InfiniteList
            this.infiniteList.Init(this)
        } , 0.1)
    }
}

