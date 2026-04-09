import { _decorator, Component, math } from 'cc';
import { YXCollectionView } from '../../../../plugin/list-3x/yx-collection-view';
import { CustomGridFlowLayout } from '../../../../plugin/list-3x/custom-grid-flow-layout';
import { LocalChatSessionItem, PrivateChatManager } from '../../../Manager/PrivateChatMessage';
import { MainChatListCell } from './MainChatListCell';
const { ccclass, property } = _decorator;

@ccclass('MainChatList')
export class MainChatList extends Component {

    @property(YXCollectionView)
    listComp: YXCollectionView = null;

    /** 本地私聊会话（每人一行） */
    private privateSessionRows: LocalChatSessionItem[] = [];

    private listCallbacksReady = false;

    private column = 1;
    private alignment = 1;

    start() {
        this.scheduleOnce(() => {
            if (!this.listComp) return;
            this.listComp.enabled = true;
            this.listComp.numberOfItems = () => this.privateSessionRows.length;
            this.listComp.cellForItemAt = (indexPath, collectionView) => {
                const cell = collectionView.dequeueReusableCell(`cell`);
                const row = this.privateSessionRows[indexPath.item];
                const listCell = cell.getComponent(MainChatListCell);
                listCell?.setSession(row ?? null);
                return cell;
            };
            this.updateFlowLayout();
            this.listCallbacksReady = true;
            this.refreshPrivateSessionList();
        }, 0.1);
    }

    onEnable() {
        if (this.listCallbacksReady) {
            this.refreshPrivateSessionList();
        }
    }

    /** 从本地缓存拉取按人聚合的私聊会话列表（最近活跃在前） */
    private refreshPrivateSessionList() {
        this.privateSessionRows = PrivateChatManager.getInstance().getSessionList();
        if (this.listComp) {
            this.listComp.reloadData();
        }
    }

    updateFlowLayout(column: number = this.column, alignment: number = this.alignment) {
        const layout = new CustomGridFlowLayout();
        layout.horizontalSpacing = 10;
        layout.verticalSpacing = 10;
        layout.alignment = alignment;
        layout.itemSize = new math.Size(1000, 200);
        this.listComp.layout = layout;
    }
}
