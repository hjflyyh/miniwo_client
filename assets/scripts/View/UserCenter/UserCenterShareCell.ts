import { _decorator, Component, Node } from 'cc';
import InfiniteCell from '../../../plugin/InfiniteList/InfiniteCell';
const { ccclass, property } = _decorator;

@ccclass('UserCenterShareCell')
export class UserCenterShareCell extends InfiniteCell{
    UpdateContent(data: any): void {
        //更新数据
    }
    start() {

    }
}


