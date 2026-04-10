import { _decorator, Component, EditBox, math } from 'cc';
import { YXCollectionView } from '../../../../plugin/list-3x/yx-collection-view';
import { CustomGridFlowLayout } from '../../../../plugin/list-3x/custom-grid-flow-layout';
import { LocalChatSessionItem, PrivateChatManager } from '../../../Manager/PrivateChatMessage';
import { MainChatListCell } from './MainChatListCell';
const { ccclass, property } = _decorator;

@ccclass('MainChatList')
export class MainChatList extends Component {

    @property(YXCollectionView)
    listComp: YXCollectionView = null;

    @property(EditBox)
    searchEditBox : EditBox

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

    /** EditBox 结束编辑时：按搜索词刷新列表 */
    public onEditEnd() {
        this.refreshPrivateSessionList();
    }

    /** 从本地拉取会话并按搜索框关键字筛选（匹配昵称、对方 id、最近一条消息） */
    private refreshPrivateSessionList() {
        const all = PrivateChatManager.getInstance().getSessionList();
        const kw = (this.searchEditBox?.string ?? '').trim().toLowerCase();
        if (!kw) {
            this.privateSessionRows = all;
        } else {
            this.privateSessionRows = all.filter((row) => {
                const name = String(row.peerName || '').toLowerCase();
                const uid = String(row.peerUid || '').toLowerCase();
                const last = String(row.lastMsg || '').toLowerCase();
                return name.includes(kw) || uid.includes(kw) || last.includes(kw);
            });
        }
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
