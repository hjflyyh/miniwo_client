import { _decorator, Component } from "cc";
const { ccclass, property } = _decorator;

import tableView from './tableView';

@ccclass("viewCell")
export default class viewCell extends Component {
    static getSize(index: number, data?: any): number {
        return 0;
    }

    init(index: number, data?: any, tv?: tableView) {
    }

    uninit() {
    }

    reload(data?: any) {
    }
}
