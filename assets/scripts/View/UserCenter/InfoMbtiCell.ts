import { _decorator, Component, Label, Node } from 'cc';
import viewCell from '../../tableview/viewCell';
const { ccclass, property } = _decorator;

@ccclass('InfoMbtiCell')
export class InfoMbtiCell extends viewCell{
    @property(Label) txNum!: Label;
    protected _index: number = 0;
    
    start() {

    }

    async init(index: number, data?: any) {
        const curData = data?.[index];
        this.node.active = true;
        this.txNum.string = curData;
    }    
}

