import { _decorator, Label } from 'cc';
import viewCell from '../../tableview/viewCell';
const { ccclass, property } = _decorator;

const MONTH_NAMES_EN = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

@ccclass('InfoBrithCell')
export class InfoBrithCell extends viewCell {
    @property(Label) txNum!: Label;
    protected _index: number = 0;

    async init(index: number, data?: any) {
        const curData = data?.[index];
        this.node.active = true;
        this.txNum.string = this.formatCellText(curData);
    }

    private formatCellText(value: unknown): string {
        if (value === '' || value == null) {
            return '';
        }
        const month = Math.floor(Number(value));
        if (month >= 1 && month <= 12) {
            return MONTH_NAMES_EN[month - 1];
        }
        return `${value}`;
    }
}

