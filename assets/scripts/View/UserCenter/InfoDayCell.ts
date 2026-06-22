import { _decorator, Label } from 'cc';
import viewCell from '../../tableview/viewCell';
const { ccclass, property } = _decorator;


@ccclass('InfoDayCell')
export class InfoDayCell extends viewCell {
    @property(Label) txNum!: Label;
    protected _index: number = 0;

    async init(index: number, data?: any) {
        const curData = data?.[index];
        this.node.active = true;
        this.txNum.string = curData;
    }
}

