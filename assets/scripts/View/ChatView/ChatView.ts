import { _decorator, Component, EditBox, Label, Node, Prefab, resources, UITransform, instantiate } from 'cc';
import { PrivateChatManager, PrivateMsg } from '../../Manager/PrivateChatMessage';
import { ChatScroll } from './ChatScroll';
const { ccclass, property } = _decorator;

/** 与 NPC 私聊打开后自动发送的测试文案（仅 chatType===2） */
const NPC_AUTO_TEST_TEXT = '测试消息';

type ChatRow =
    | { kind: 'msg'; msg: PrivateMsg };

@ccclass('ChatView')
export class ChatView extends Component {
    @property(Label)
    targetName : Label //聊天对象

    @property(Label)
    targetWorld: Label //npc聊天显示地图

    @property([Node])
    likes : Node[] = [] //和npc好感度
    

    @property(EditBox)
    inputBox: EditBox = null;

    @property(ChatScroll)
    chatScroll : ChatScroll

    /** 当前会话对方 Nakama UID（与 PrivateChatManager 内一致） */
    private peerUid: string | null = null;

    /** 扁平化后的列表行：日期头 + 消息交错 */
    private rows: ChatRow[] = [];

    // 兜底刷新：避免事件偶发漏投递/漏过滤导致必须重进界面
    private _pollRefreshLeft = 0;
    private _lastMsgCount = -1;

    onLoad() {
        if (!this.inputBox) {
            this.inputBox = this.node.getChildByName('EditBox')?.getComponent(EditBox) ?? null;
        }
    }

   async start() {
        const open = (this.node as any)['_openParam'] || {};
        const npcId = open.npcId;
        const npcPeerUid = open.npcPeerUid;
        const chatType = open.chatType;
        const userId = open.userId;

        const pm = PrivateChatManager.getInstance();
        try {
            if (chatType === 1) {
                const uid = userId != null ? String(userId) : '';
                if (!uid) {
                    throw new Error('缺少 userId');
                }
                // 先用本地缓存渲染
                pm.tryOpenLocalSession(uid);
                this.peerUid = uid;
                this.rebuildRows();
                
                await pm.openUserSession(uid, open.userName);
            } else if (chatType === 2) {
                const nid = Number(npcId);
                if (Number.isFinite(nid) && nid > 0) {
                    const session = await pm.openNpcSession(nid);
                    this.peerUid = session.peerUid;
                } else {
                    const puid = npcPeerUid != null ? String(npcPeerUid) : '';
                    if (!puid) {
                        throw new Error('缺少 npcId 或 npcPeerUid');
                    }
                    pm.tryOpenLocalSession(puid);
                    this.peerUid = puid;
                    this.rebuildRows();
                    const session = await pm.openNpcSessionByPeerUid(puid, open.userName);
                    this.peerUid = session.peerUid;
                }
                // try {
                //     await pm.sendText(this.peerUid, NPC_AUTO_TEST_TEXT);
                // } catch (sendErr: any) {
                //     EventSystem.send('ShowTips', String(sendErr?.message || sendErr || '发送测试消息失败'));
                // }
            } else {
                EventSystem.send('ShowTips', '聊天类型无效');
                return;
            }

            pm.markSessionRead(this.peerUid);
            this.rebuildRows();
            EventSystem.addListent('PrivateChatMessage', this.onPrivateChatMessage, this);
            

            // 打开后短时间轮询刷新，确保 NPC 回复到达必显示
            this._pollRefreshLeft = 16; // 16 * 0.3s ≈ 4.8s
            this._lastMsgCount = -1;
            this.schedule(this.pollRefresh, 0.3);
        } catch (e: any) {
            EventSystem.send('ShowTips', String(e?.message || e));
        }
    }    


    onClickSend(){
        const text = (this.inputBox?.string || '').trim();
        if (!text) {
            return;
        }
        if (!this.peerUid) {
            EventSystem.send('ShowTips', '会话未建立');
            return;
        }
        const pm = PrivateChatManager.getInstance();
        pm.sendText(this.peerUid, text)
            .then(() => {
                if (this.inputBox) {
                    this.inputBox.string = '';
                }
                this.rebuildRows();
            })
            .catch((e: any) => {
                EventSystem.send('ShowTips', String(e?.message || e || '发送失败'));
            });
    }

    onDestroy() {
        EventSystem.remove(this);
        this.unschedule(this.pollRefresh);
    }

    private onPrivateChatMessage(payload: { session?: { peerUid?: string, channelId?: string } }) {
        // 这里不要只靠 peerUid 严格过滤：在 DM channel_id 格式变化/会话迁移时，
        // 可能出现同一会话的 session/channelId 更新，但事件携带的 peerUid 一时对不上，导致 UI 不刷新。
        if (!this.peerUid) return;
        const uid = payload?.session?.peerUid;
        if (uid && uid !== this.peerUid) {
            // 若不是当前会话，也直接跳过，避免其它会话消息打断当前界面。
            return;
        }
        this.rebuildRows();
        
    }

    private pollRefresh() {
        if (!this.peerUid) {
            this.unschedule(this.pollRefresh);
            return;
        }
        if (this._pollRefreshLeft <= 0) {
            this.unschedule(this.pollRefresh);
            return;
        }
        this._pollRefreshLeft -= 1;
        const msgs = PrivateChatManager.getInstance().getMessages(this.peerUid);
        const cnt = msgs ? msgs.length : 0;
        if (cnt !== this._lastMsgCount) {
            this._lastMsgCount = cnt;
            this.rebuildRows();
        }
    }

    private rebuildRows() {
        if (!this.peerUid) {
            this.rows = [];
            return;
        }
        const msgs = PrivateChatManager.getInstance().getMessages(this.peerUid);
        this.rows = this.buildRowsFromMessages(msgs);

        this.scheduleOnce(()=>{
            this.chatScroll.setAry(this.rows);
        } , 0.2)
    }

    /** 按时间排序后，生成消息行 */
    private buildRowsFromMessages(msgs: PrivateMsg[]): ChatRow[] {
        const sorted = [...msgs].sort((a, b) => (a.ts || 0) - (b.ts || 0));
        return sorted.map((m) => ({ kind: 'msg' as const, msg: m }));
    }
}
