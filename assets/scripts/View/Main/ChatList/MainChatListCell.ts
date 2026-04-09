import { _decorator, Component, Label } from 'cc';
import { LocalChatSessionItem, PrivateChatManager } from '../../../Manager/PrivateChatMessage';
import { AppConst } from '../../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('MainChatListCell')
export class MainChatListCell extends Component {
    @property(Label)
    npcName: Label = null;

    @property(Label)
    lastChat: Label = null;

    private _session: LocalChatSessionItem | null = null;

    setSession(item: LocalChatSessionItem | null) {
        this._session = item;
        if (!item) {
            if (this.npcName) this.npcName.string = '';
            if (this.lastChat) this.lastChat.string = '';
            return;
        }
        const name =
            (item.peerName && String(item.peerName).trim()) ||
            (item.peerUid ? String(item.peerUid) : '');
        if (this.npcName) this.npcName.string = name;
        if (this.lastChat) this.lastChat.string = item.lastMsg != null ? String(item.lastMsg) : '';
    }

    /** 按钮绑定：chatType 1=真人 userId；2=NPC，优先 npcId，否则 npcPeerUid */
    onClickChat() {
        const item = this._session;
        if (!item?.peerUid) {
            EventSystem.send('ShowTips', '无法打开会话');
            return;
        }
        if (item.isNPC) {
            const pm = PrivateChatManager.getInstance();
            const npcId = pm.getNpcIdByPeerUid(item.peerUid);
            if (npcId != null) {
                AppConst.PanelManager.openView('res/View/Chat/ChatView', {
                    chatType: 2,
                    npcId,
                    userName: item.peerName ?? undefined,
                });
            } else {
                AppConst.PanelManager.openView('res/View/Chat/ChatView', {
                    chatType: 2,
                    npcPeerUid: item.peerUid,
                    userName: item.peerName ?? undefined,
                });
            }
        } else {
            AppConst.PanelManager.openView('res/View/Chat/ChatView', {
                chatType: 1,
                userId: item.peerUid,
                userName: item.peerName ?? undefined,
            });
        }
    }
}
