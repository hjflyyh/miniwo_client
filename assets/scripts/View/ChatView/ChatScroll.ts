import { _decorator, Component, Label, Node, Prefab, UITransform, instantiate } from 'cc';
import InfiniteCell from 'db://assets/plugin/InfiniteList/InfiniteCell';
import { IFDataSource, InfiniteList } from 'db://assets/plugin/InfiniteList/InfiniteList';
import { ChatListCell } from './ChatListCell';
import {
    MY_BUBBLE_FONT_SIZE,
    MY_BUBBLE_LINE_HEIGHT,
    MY_BUBBLE_MAX_TEXT_WIDTH,
    MY_BUBBLE_ROW_EXTRA,
    measureMyBubbleText,
} from './ChatMyBubbleLayout';
const { ccclass, property } = _decorator;

@ccclass('ChatScroll')
export class ChatScroll extends Component implements IFDataSource{
    
    showAry = []

    @property(Prefab)
    cellPrefab : Prefab

    infiniteList :InfiniteList

    /** 对方消息气泡文本宽（other 仍用固定宽） */
    private readonly peerBubbleTextWidth = 374;
    private readonly rowMinHeightMsg = 170;
    private _measureNode: Node | null = null;
    private _measureLabel: Label | null = null;

    onLoad() {
        this.ensureMeasureLabel();
    }

    private ensureMeasureLabel() {
        if (this._measureLabel && this._measureLabel.isValid) return;
        const n = new Node('chatMeasureLabel');
        n.active = false;
        const ut = n.addComponent(UITransform);
        ut.setContentSize(this.peerBubbleTextWidth, 10);
        const lb = n.addComponent(Label);
        lb.overflow = Label.Overflow.RESIZE_HEIGHT;
        lb.enableWrapText = true;
        lb.fontSize = MY_BUBBLE_FONT_SIZE;
        lb.lineHeight = MY_BUBBLE_LINE_HEIGHT;
        this.node.addChild(n);
        this._measureNode = n;
        this._measureLabel = lb;
    }

    private measurePeerBubbleTextHeight(text: string): number {
        this.ensureMeasureLabel();
        const lb = this._measureLabel;
        const ut = lb?.node.getComponent(UITransform);
        if (!lb || !ut) return 0;

        const savedString = lb.string;
        const savedOverflow = lb.overflow;
        const savedW = ut.width;
        const savedH = ut.height;

        lb.string = text || '';
        lb.overflow = Label.Overflow.RESIZE_HEIGHT;
        ut.width = this.peerBubbleTextWidth;
        lb.updateRenderData(true);

        const textH = ut.contentSize.height;

        lb.string = savedString;
        lb.overflow = savedOverflow;
        ut.setContentSize(savedW, savedH);
        lb.updateRenderData(true);

        return Math.max(0, Math.ceil(textH));
    }

    private measureMyRowHeight(text: string): number {
        this.ensureMeasureLabel();
        const lb = this._measureLabel!;
        const m = measureMyBubbleText(lb, text);
        return Math.max(this.rowMinHeightMsg, m.bubbleHeight + MY_BUBBLE_ROW_EXTRA);
    }

    GetCellNumber(): number {
        return this.showAry.length;
    }
    GetCellIdentifer(dataIndex: number): string {
        return 'cellChat';
    }
    GetCellSize(dataIndex: number): number {
        const row = this.showAry?.[dataIndex];
        const text = row?.msg?.text != null ? String(row.msg.text) : (row?.text != null ? String(row.text) : '');
        const isSelf = row?.msg?.role === 'self';

        if (isSelf) {
            return this.measureMyRowHeight(text);
        }

        const textH = this.measurePeerBubbleTextHeight(text);
        const lineHeight = Math.max(1, this._measureLabel?.lineHeight || MY_BUBBLE_LINE_HEIGHT);
        const lineCount = Math.max(1, Math.ceil(textH / lineHeight));
        const extra = 110 + (lineCount > 2 ? 30 : 0);
        return Math.max(this.rowMinHeightMsg, textH + extra);
    }
    GetCellView(dataIndex: number, identifier?: string): InfiniteCell {
        const id = identifier || 'cellChat';
        const node = this.cellPrefab ? instantiate(this.cellPrefab) : new Node('ChatListCell');
        let comp = node.getComponent(ChatListCell);
        if (!comp) comp = node.addComponent(ChatListCell);
        comp.cellIdentifier = id;
        return comp;
    }
    GetCellData?(dataIndex: number) {
        return this.showAry?.[dataIndex] ?? null;
    }


    start() {
        this.scheduleOnce(()=>{
            this.infiniteList = this.getComponent("InfiniteList") as InfiniteList
            this.infiniteList.Init(this)
        } , 0.1)
    }

    setAry(ary){
        if(this.showAry.length == ary.length){
            return;
        }
        this.showAry = ary;
        this.infiniteList.Reload(true);

        this.scheduleOnce(()=>{
             this.infiniteList._scrollView.scrollToPercentVertical(0 , 1)
        } , 0.2)

    }
}
