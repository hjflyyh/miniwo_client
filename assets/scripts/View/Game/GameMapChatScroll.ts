import { _decorator, Component, instantiate, Label, Node, Prefab, UITransform } from 'cc';
import InfiniteCell from 'db://assets/plugin/InfiniteList/InfiniteCell';
import { IFDataSource, InfiniteList } from 'db://assets/plugin/InfiniteList/InfiniteList';
import { GameViewChatCell } from './GameViewChatCell';
import { MapChatManager } from '../../Manager/ChatManager';
const { ccclass, property } = _decorator;

@ccclass('GameMapChatScroll')
export class GameMapChatScroll extends Component implements IFDataSource{
    @property(Prefab)
    cellPrefab : Prefab

    private chatAry = []

    infiniteList :InfiniteList

    /** 与 `GameViewChatCell.prefab` 内 content Label 宽一致 */
    private readonly contentWidth = 480;
    /** cell 的最小高度（与 prefab 根节点高度一致） */
    private readonly rowMinHeight = 100;
    /** 正文之外预留高度（昵称行/边距/布局间距等） */
    private readonly rowReserve = 60;

    private _measureNode: Node | null = null;
    private _measureLabel: Label | null = null;

    onLoad() {
        this.ensureMeasureLabel();
    }

    private ensureMeasureLabel() {
        if (this._measureLabel && this._measureLabel.isValid) return;
        const n = new Node('mapChatMeasureLabel');
        n.active = false;
        const ut = n.addComponent(UITransform);
        ut.setContentSize(this.contentWidth, 10);
        const lb = n.addComponent(Label);
        // 与 `GameViewChatCell` 的 content Label 对齐
        lb.overflow = Label.Overflow.RESIZE_HEIGHT;
        lb.enableWrapText = true;
        lb.fontSize = 30;
        lb.lineHeight = 35;
        this.node.addChild(n);
        this._measureNode = n;
        this._measureLabel = lb;
    }

    private measureContentHeight(text: string): number {
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
        ut.width = this.contentWidth;
        lb.updateRenderData(true);

        const h = ut.contentSize.height;

        lb.string = savedString;
        lb.overflow = savedOverflow;
        ut.setContentSize(savedW, savedH);
        lb.updateRenderData(true);

        return Math.max(0, Math.ceil(h));
    }


    start() {
        this.scheduleOnce(()=>{
            this.infiniteList = this.getComponent("InfiniteList") as InfiniteList
            this.infiniteList.Init(this)
        } , 0.1)
    }

    public refreshChat(ary){
        this.chatAry = ary

        if(this.infiniteList){
            this.infiniteList.Reload(true);

            this.scheduleOnce(()=>{
                this.infiniteList._scrollView.scrollToPercentVertical(0 , 1)
            } , 0.2)
        }

    }

    GetCellNumber(): number {
        return this.chatAry.length
    }
    GetCellIdentifer(dataIndex: number): string {
        return 'cellChat';
    }
    GetCellSize(dataIndex: number): number {
        const row = this.chatAry?.[dataIndex];
        const displayText = MapChatManager.instance.getDisplayText(row?.text);
        const textH = this.measureContentHeight(displayText);
        return Math.max(this.rowMinHeight, textH + this.rowReserve);
    }
    GetCellView(dataIndex: number, identifier?: string): InfiniteCell {
        const id = identifier || 'cellChat';
        const node = instantiate(this.cellPrefab)
        let comp = node.getComponent(GameViewChatCell);
        comp.cellIdentifier = id;
        return comp;
    }
    GetCellData?(dataIndex: number) {
        return this.chatAry[dataIndex]
    }
}

