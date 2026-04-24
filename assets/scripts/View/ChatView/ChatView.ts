import { _decorator, Component, EditBox, Label, Node, Prefab, resources, UITransform, instantiate } from 'cc';
import { PrivateChatManager, PrivateMsg } from '../../Manager/PrivateChatMessage';
import { ChatScroll } from './ChatScroll';
import { AffinitieModel } from '../../Model/AffinitieModel';
import { HttpManager } from '../../Manager/HttpManager';
import { RoleModel } from '../../Model/RoleModel';
const { ccclass, property } = _decorator;

/** 与 NPC 私聊打开后自动发送的测试文案（仅 chatType===2） */
const NPC_AUTO_TEST_TEXT = '测试消息';

type ChatRow =
    | { kind: 'msg'; msg: PrivateMsg; npc_sprite_url?: string | null; npc_avatar?: string | null };

@ccclass('ChatView')
export class ChatView extends Component {
    @property(Label)
    targetName : Label //聊天对象

    @property(Label)
    targetWorld: Label //npc聊天显示地图

    @property([Node])
    likes : Node[] = [] //根据和npc好感度得到lv，显示星星
    

    @property(EditBox)
    inputBox: EditBox = null;

    @property(ChatScroll)
    chatScroll : ChatScroll

    /** 当前会话对方 Nakama UID（与 PrivateChatManager 内一致） */
    private peerUid: string | null = null;
    private chatType: number = 0;
    private npcId: number = 0;

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
        this.chatType = Number(chatType) || 0;
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
                    this.npcId = nid;
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
                    // 尝试从本地 npc 映射反查 npcId（若无则保持 0）
                    this.npcId = pm.getNpcIdByPeerUid?.(puid) ?? 0;
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

            if (chatType === 1) {
                this.refreshUserHeader(open);
            } else if (chatType === 2) {
                this.clearNpcHeader();
                await this.loadNpcInfoFromServer();
            }
            pm.markSessionRead(this.peerUid);
            this.rebuildRows();
            EventSystem.addListent('PrivateChatMessage', this.onPrivateChatMessage, this);
            EventSystem.addListent('NpcAffinityUpdated', this.onNpcAffinityUpdated, this);
            

            // 打开后短时间轮询刷新，确保 NPC 回复到达必显示
            this._pollRefreshLeft = 16; // 16 * 0.3s ≈ 4.8s
            this._lastMsgCount = -1;
            this.schedule(this.pollRefresh, 0.3);
        } catch (e: any) {
            EventSystem.send('ShowTips', String(e?.message || e));
        }
    }    

    /** 真人私聊：直接显示标题 */
    private refreshUserHeader(openParam: any) {
        const pm = PrivateChatManager.getInstance();
        const name =
            (openParam?.userName != null ? String(openParam.userName) : '').trim() ||
            (this.peerUid ? (pm as any).getLocalSessionList?.()?.find?.((x: any) => x?.peerUid === this.peerUid)?.peerName : '') ||
            (this.peerUid ?? '');
        if (this.targetName) this.targetName.string = name;
        if (this.targetWorld) {
            this.targetWorld.string = '';
            this.targetWorld.node.active = false;
        }
        this.refreshLikesUI();
    }

    /** NPC 私聊：进入时先不显示名字与地图，等 getNpcInfo 返回后再填 */
    private clearNpcHeader() {
        if (this.targetName) this.targetName.string = '';
        if (this.targetWorld) {
            this.targetWorld.string = '';
            this.targetWorld.node.active = false;
        }
    }

    private async loadNpcInfoFromServer() {
        if (this.npcId <= 0) {
            EventSystem.send('ShowTips', '缺少 npcId，无法拉取 NPC 信息');
            this.refreshLikesUI();
            return;
        }
        const token = RoleModel.getInstance().token;
        if (!token) {
            EventSystem.send('ShowTips', '未登录');
            this.refreshLikesUI();
            return;
        }
        try {
            const res = await fetch(`${HttpManager.baseUrl}/getNpcInfo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, npcId: this.npcId }),
            });
            const json = await res.json();
            if (!json?.success || !json?.data) {
                const err = json?.error || json?.message || '获取 NPC 信息失败';
                EventSystem.send('ShowTips', String(err));
                this.refreshLikesUI();
                return;
            }
            const d = json.data;
            if (this.targetName) this.targetName.string = d.npc_name != null ? String(d.npc_name) : '';
            if (this.targetWorld) {
                this.targetWorld.string = d.map_name != null ? String(d.map_name) : '';
                this.targetWorld.node.active = true;
            }
            this.refreshLikesUI();
        } catch (e: any) {
            EventSystem.send('ShowTips', String(e?.message || e || '网络错误'));
            this.refreshLikesUI();
        }
    }

    private refreshLikesUI() {
        if (!this.likes || this.likes.length <= 0) return;
        const isNpc = this.chatType === 2;
        if (!isNpc || !(this.npcId > 0)) {
            for (const n of this.likes) {
                if (n) n.active = false;
            }
            return;
        }
        const lv = AffinitieModel.getInstance().getAffinityLevel(this.npcId);
        const onCount = Math.max(0, Math.min(this.likes.length, Number(lv) || 0));
        for (let i = 0; i < this.likes.length; i++) {
            const n = this.likes[i];
            if (n) n.active = i < onCount;
        }
    }

    private onNpcAffinityUpdated() {
        // NPC 好感度更新后刷新星星显示
        this.refreshLikesUI();
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
        const pm = PrivateChatManager.getInstance();
        const npcAvatar =
            (this.peerUid
                ? (pm as any).getLocalSessionList?.()?.find?.((x: any) => x?.peerUid === this.peerUid)?.peerAvatar
                : null) ?? null;
        const sorted = [...msgs].sort((a, b) => (a.ts || 0) - (b.ts || 0));
        return sorted.map((m) => ({
            kind: 'msg' as const,
            msg: m,
            npc_sprite_url: npcAvatar,
            npc_avatar: npcAvatar, // 兼容旧读取
        }));
    }
}
