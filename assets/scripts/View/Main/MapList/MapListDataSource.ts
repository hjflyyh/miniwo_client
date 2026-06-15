import { _decorator, Component, Node, Prefab } from 'cc';
import { IFDataSource, InfiniteList } from '../../../../plugin/InfiniteList/InfiniteList';
import { MapListItem } from './MapListItem';
import { Utils } from '../../../Utils/Utils';
import { MapModel } from '../../../Model/MapModel';
const { ccclass, property } = _decorator;

@ccclass('MapListDataSource')
export class MapListDataSource extends Component implements IFDataSource{
    @property(Prefab)
    cellPrefab : Prefab

    infiniteList :InfiniteList
    start() {
        this.scheduleOnce(()=>{
            this.infiniteList = this.getComponent("InfiniteList") as InfiniteList
            this.infiniteList.Init(this)
        } , 0.1)
    }

    GetCellNumber(): number {
        if(!MapModel.getInstance().sceneMaps){
            return 0
        }
        return MapModel.getInstance().sceneMaps.length
    }

    GetCellIdentifer(dataIndex: number): string {
        return ""
    }
    GetCellSize(dataIndex: number): number {
        return 500
    }
    GetCellView(dataIndex: number, identifier?: string): MapListItem {
        let node = Utils.instantiate(this.cellPrefab);
        return node.getComponent("MapListItem");
    }

    GetCellData(dataIndex: number) {
        return dataIndex
    }
}


