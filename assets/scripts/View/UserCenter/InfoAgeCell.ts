import { _decorator, Component, Label, Node } from 'cc';
import viewCell from '../../tableview/viewCell';
const { ccclass, property } = _decorator;

@ccclass('InfoAgeCell')
export class InfoAgeCell extends viewCell {
    @property(Label) txNum!: Label;
    protected _index: number = 0;

    async init(index: number, data?: any) {
        const curData = data?.[index];
        this.node.active = true;
        this.txNum.string = curData;
    }
}

