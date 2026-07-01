import { _decorator, assetManager, Component, ImageAsset, Label, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { LocalChatSessionItem, PrivateChatManager } from '../../../Manager/PrivateChatMessage';
import { AppConst } from '../../../AppConst';
import { HttpManager } from '../../../Manager/HttpManager';
const { ccclass, property } = _decorator;

@ccclass('MainChatListCell')
export class MainChatListCell extends Component {
    @property(Label)
    npcName: Label = null;

    @property(Label)
    lastChat: Label = null;

    @property(Sprite)
    private npcHead : Sprite;

    @property(Label)
    laseTime : Label

    private _session: LocalChatSessionItem | null = null;
    private _avatarReqSeq = 0;

    setSession(item: LocalChatSessionItem | null) {
        this._session = item;
        if (!item) {
            if (this.npcName) this.npcName.string = '';
            if (this.lastChat) this.lastChat.string = '';
            if (this.laseTime) this.laseTime.string = '--';
            if (this.npcHead) this.npcHead.spriteFrame = null;
            return;
        }
        const name =
            (item.peerName && String(item.peerName).trim()) ||
            (item.peerUid ? String(item.peerUid) : '');
        if (this.npcName) this.npcName.string = name;
        if (this.lastChat) this.lastChat.string = item.lastMsg != null ? String(item.lastMsg) : '';
        if (this.laseTime) this.laseTime.string = this.formatLastTs(item.lastTs);

        this.loadAvatarSafe(item.peerAvatar);
    }

    private formatLastTs(lastTs?: number | null): string {
        const ts = Number(lastTs);
        if (!Number.isFinite(ts) || ts <= 0) {
            return '--';
        }
        const ms = ts < 1e12 ? ts * 1000 : ts;
        const date = new Date(ms);
        if (Number.isNaN(date.getTime())) {
            return '--';
        }
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    private loadAvatarSafe(rawUrl?: string | null) {
        const reqId = ++this._avatarReqSeq;
        if (!this.npcHead) return;
        const url = String(rawUrl || '').trim();
        if (!url) {
            this.npcHead.spriteFrame = null;
            return;
        }
        const finalUrl = url.includes('http') ? url : `${HttpManager.baseUrl}${url}`;
        assetManager.loadRemote<ImageAsset>(finalUrl, { ext: '.png' }, (err, imageAsset) => {
            if (reqId !== this._avatarReqSeq || !this.npcHead?.isValid) return;
            if (err || !imageAsset) {
                this.npcHead.spriteFrame = null;
                return;
            }
            const tex = new Texture2D();
            tex.image = imageAsset;
            const sf = new SpriteFrame();
            sf.texture = tex;
            this.npcHead.spriteFrame = sf;
            const ui = this.npcHead.getComponent(UITransform) || this.npcHead.node.getComponent(UITransform);
            if (!ui) return;
            const targetW = 160;
            const targetH = 160;
            const srcW = imageAsset.width;
            const srcH = imageAsset.height;
            if (srcW <= 0 || srcH <= 0) return;
            const scale = Math.max(targetW / srcW, targetH / srcH);
            ui.setContentSize(srcW * scale, srcH * scale);
        });
    }

    /** 按钮绑定：chatType 1=真人 userId；2=NPC，优先 npcId，否则 npcPeerUid */
    onClickChat() {
        const item = this._session;
        if (!item?.peerUid) {
            EventSystem.send('ShowTips', '无法打开会话');
            return;
        }
        const pm = PrivateChatManager.getInstance();
        const npcIdFromMap = pm.getNpcIdByPeerUid(item.peerUid);
        const treatAsNpc = item.isNPC || npcIdFromMap != null;
        if (treatAsNpc) {
            const npcId = npcIdFromMap;
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
