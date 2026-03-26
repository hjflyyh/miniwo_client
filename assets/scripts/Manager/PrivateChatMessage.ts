// PrivateChatManager.ts
// import { EventSystem } from "../EventSystem"; // 按你项目路径改
// import { AppConst } from "../AppConst";       // 按你项目路径改
import { sys } from "cc";
import { AppConst } from "../AppConst";

type Role = "self" | "peer";

export interface PrivateMsg {
  messageId: string;
  channelId: string;
  senderId: string;
  username?: string;
  text: string;
  ts: number;
  role: Role;
}

export interface ChatSession {
  peerUid: string;
  peerName?: string | null;
  peerAvatar?: string | null;
  isNPC: boolean;
  channelId: string;
  openedAt: number;
}

export interface LocalChatSessionItem {
  peerUid: string;
  peerName?: string | null;
  peerAvatar?: string | null;
  isNPC: boolean;
  channelId: string;
  lastMsg: string;
  lastTs: number;
  unread: number;
}

export class PrivateChatManager {
  private static _ins: PrivateChatManager;
  static getInstance() {
    if (!this._ins) this._ins = new PrivateChatManager();
    return this._ins;
  }

  private selfUid = "";
  private sessionsByPeer = new Map<string, ChatSession>();
  private sessionsByChannel = new Map<string, ChatSession>();
  private msgsByChannel = new Map<string, PrivateMsg[]>();
  private localSessionsByPeer = new Map<string, LocalChatSessionItem>();

  private readonly storagePrefix = "private_chat_v1";
  private readonly maxMsgPerChannel = 300;

  private readonly sessionListKey = "private_chat_v1:sessions";


  private constructor() {}

  /** 登录后调用 */
  init(selfUid: string) {
    this.selfUid = selfUid;
    this.loadLocalSessions();
    this.bindEvents();
  }

  private bindEvents() {
    EventSystem.addListent("ChannelMessage", this.onChannelMessage, this);
    EventSystem.addListent("WebSocketConnected", this.onWebSocketConnected, this);
    EventSystem.addListent("WebSocketNotifications", this.onNotification, this);
  }

  dispose() {
    
  }

  /** 会话列表（按用户聚合，按最近消息时间倒序） */
  public getSessionList(): LocalChatSessionItem[] {
    const list = Array.from(this.localSessionsByPeer.values());
    list.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
    return list;
  }

  // 兼容旧调用
  public getLocalSessionList(): LocalChatSessionItem[] {
    return this.getSessionList();
  }

  private upsertLocalSession(item: LocalChatSessionItem) {
    const prev = this.localSessionsByPeer.get(item.peerUid);
    if (prev) {
      this.localSessionsByPeer.set(item.peerUid, { ...prev, ...item });
    } else {
      this.localSessionsByPeer.set(item.peerUid, { ...item });
    }
    this.persistLocalSessions();
  }

public markSessionRead(peerUid: string) {
  const row = this.localSessionsByPeer.get(peerUid);
  if (!row) return;
  row.unread = 0;
  this.localSessionsByPeer.set(peerUid, row);
  this.persistLocalSessions();
}

  // ------------------- 会话打开 -------------------

  /** 打开 NPC 私聊 */
  async openNpcSession(npcId: number): Promise<ChatSession> {
    const r = await this.rpc("get_npc_chat_id", { npc_id: npcId });
    if (!r?.success || !r.nakama_uid) throw new Error(r?.message || "get_npc_chat_id failed");

    return this.openSessionByUid(r.nakama_uid, true, r.name ?? null, r.avatar ?? null);
  }

  /** 打开真人私聊 */
  async openUserSession(peerUid: string, peerName?: string): Promise<ChatSession> {
    return this.openSessionByUid(peerUid, false, peerName ?? null, null);
  }

  private async openSessionByUid(
    peerUid: string,
    isNPC: boolean,
    peerName: string | null,
    peerAvatar: string | null
  ): Promise<ChatSession> {
    const cached = this.sessionsByPeer.get(peerUid);
    if (cached) return cached;

    const ws = AppConst.WebSocketManager;
    const channel = await this.joinChat(peerUid); // DM type=2

    const s: ChatSession = {
      peerUid,
      peerName,
      peerAvatar,
      isNPC,
      channelId: channel.id,
      openedAt: Date.now(),
    };

    this.sessionsByPeer.set(peerUid, s);
    this.sessionsByChannel.set(s.channelId, s);

    const local = this.loadLocalMsgs(s.channelId);
    this.msgsByChannel.set(s.channelId, local);

    // 确保会话一打开就能在“按用户聚合”的列表中看到
    const last = local.length > 0 ? local[local.length - 1] : null;
    this.upsertLocalSession({
      peerUid: s.peerUid,
      peerName: s.peerName,
      peerAvatar: s.peerAvatar,
      isNPC: s.isNPC,
      channelId: s.channelId,
      lastMsg: last?.text || "",
      lastTs: last?.ts || s.openedAt,
      unread: this.localSessionsByPeer.get(s.peerUid)?.unread || 0,
    });

    return s;
  }

  // ------------------- 发送 -------------------

  /**
   * 统一发送：走后端 private_chat_send
   * - 发送给 NPC：无限制
   * - 发送给真人：后端会校验在线，不在线直接失败
   */
  async sendText(peerUid: string, text: string): Promise<void> {
    const s = this.sessionsByPeer.get(peerUid);
    if (!s) throw new Error("session not opened");

    const pure = (text || "").trim();
    if (!pure) return;

    const r = await this.rpc("private_chat_send", {
      target_uid: peerUid,
      text: pure,
    });

    if (!r?.success) {
      throw new Error(r?.message || "send failed");
    }

    // 本地先插入一条，避免等回推
    const msg: PrivateMsg = {
      messageId: r.message_id || `local-${Date.now()}`,
      channelId: s.channelId,
      senderId: this.selfUid,
      text: pure,
      ts: Date.now(),
      role: "self",
    };
    this.insertMsg(msg);
    this.persist(s.channelId);
    this.upsertLocalSession({
      peerUid: s.peerUid,
      peerName: s.peerName,
      peerAvatar: s.peerAvatar,
      isNPC: s.isNPC,
      channelId: s.channelId,
      lastMsg: msg.text,
      lastTs: msg.ts,
      unread: 0,
    });
  }

  // ------------------- 读取 -------------------

  getMessages(peerUid: string): PrivateMsg[] {
    const s = this.sessionsByPeer.get(peerUid);
    if (!s) return [];
    return [...(this.msgsByChannel.get(s.channelId) || [])];
  }

  // ------------------- 实时接收 -------------------

  private onChannelMessage(data: any) {
    const channelId = data?.channel_id;
    if (!channelId) return;

    let session = this.sessionsByChannel.get(channelId);
    if (!session) {
      // 未打开会话也尽量补一份最小会话，避免列表漏消息
      const senderId = String(data?.sender_id || "");
      if (!senderId) return;
      const peerUid = senderId === this.selfUid ? "" : senderId;
      if (!peerUid) return;
      session = {
        peerUid,
        peerName: data?.username || null,
        peerAvatar: null,
        isNPC: false,
        channelId,
        openedAt: Date.now(),
      };
      this.sessionsByPeer.set(peerUid, session);
      this.sessionsByChannel.set(channelId, session);
      if (!this.msgsByChannel.has(channelId)) {
        this.msgsByChannel.set(channelId, this.loadLocalMsgs(channelId));
      }
    }

    const content = data.content || {};
    const text = this.extractText(content);
    if (!text) return;

    const msg: PrivateMsg = {
      messageId: data.message_id || "",
      channelId,
      senderId: data.sender_id || "",
      username: data.username || "",
      text,
      ts: this.extractTs(content, data.create_time),
      role: data.sender_id === this.selfUid ? "self" : "peer",
    };

    // 去重
    const list = this.msgsByChannel.get(channelId) || [];
    if (msg.messageId && list.some((x) => x.messageId === msg.messageId)) return;

    this.insertMsg(msg);
    this.persist(channelId);

    const prevUnread = this.localSessionsByPeer.get(session.peerUid)?.unread || 0;
    this.upsertLocalSession({
      peerUid: session.peerUid,
      peerName: session.peerName,
      peerAvatar: session.peerAvatar,
      isNPC: session.isNPC,
      channelId: session.channelId,
      lastMsg: msg.text,
      lastTs: msg.ts,
      unread: msg.role === "peer" ? (prevUnread + 1) : prevUnread,
    });

    EventSystem.send("PrivateChatMessage", { session, message: msg });
  }

  private onNotification(n: any) {
    // 后端 private_chat_send（真人在线）会发 type=private_chat_new
    let content: any = n?.content;
    if (typeof content === "string") {
      try { content = JSON.parse(content); } catch { content = null; }
    }
    if (!content || content.type !== "private_chat_new") return;

    EventSystem.send("PrivateChatSessionHint", content);
  }

  // ------------------- 重连恢复 -------------------

  private async onWebSocketConnected(payload: { reconnected?: boolean }) {
    if (!payload?.reconnected) return;

    // 重连后重建 channelId 映射（DM id 理论稳定，但以 join 返回为准）
    const sessions = Array.from(this.sessionsByPeer.values());
    this.sessionsByChannel.clear();

    for (const s of sessions) {
      try {
        const ch = await this.joinChat(s.peerUid);
        s.channelId = ch.id;
        this.sessionsByChannel.set(s.channelId, s);

        // 若本地缓存是旧 channelId，可做迁移（可选）
        if (!this.msgsByChannel.has(s.channelId)) {
          const local = this.loadLocalMsgs(s.channelId);
          this.msgsByChannel.set(s.channelId, local);
        }
        const localMsgs = this.msgsByChannel.get(s.channelId) || [];
        const last = localMsgs.length > 0 ? localMsgs[localMsgs.length - 1] : null;
        this.upsertLocalSession({
          peerUid: s.peerUid,
          peerName: s.peerName,
          peerAvatar: s.peerAvatar,
          isNPC: s.isNPC,
          channelId: s.channelId,
          lastMsg: last?.text || "",
          lastTs: last?.ts || s.openedAt,
          unread: this.localSessionsByPeer.get(s.peerUid)?.unread || 0,
        });
      } catch (e) {
        console.warn("rejoin chat failed:", s.peerUid, e);
      }
    }

    EventSystem.send("PrivateChatReconnected");
  }

  // ------------------- 工具 -------------------

  private async joinChat(targetUid: string): Promise<any> {
    // 你当前 ws send 是裸 JSON，可封装一个 Promise 版 RPC/请求匹配
    // 这里假设你有 ws 封装函数，示例用 Promise 包装：
    return new Promise((resolve, reject) => {
      try {
        // Nakama RT: { channel_join: { target, type, persistence, hidden } }
        const ok = AppConst.WebSocketManager.send({
          channel_join: {
            target: targetUid,
            type: 2,
            persistence: true,
            hidden: false,
          },
        });
        if (!ok) return reject(new Error("channel_join send failed"));

        // 你项目里建议加 cid 做请求-响应匹配；这里给简化版
        const timeout = setTimeout(() => {
          EventSystem.remove(this);
          reject(new Error("joinChat timeout"));
        }, 5000);

        const onMsg = (msg: any) => {
          // 按你项目实际 RT 回包结构调整
          if (msg?.channel?.id && msg.channel?.type === 2) {
            clearTimeout(timeout);
            EventSystem.remove(this);
            resolve(msg.channel);
          }
        };
        EventSystem.addListent("WebSocketMessage", onMsg, this);
      } catch (e) {
        reject(e);
      }
    });
  }

  private async rpc(id: string, payloadObj: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = { rpc: { id, payload: JSON.stringify(payloadObj) } };
      const ok = AppConst.WebSocketManager.send(req);
      if (!ok) return reject(new Error("rpc send failed"));

      const timeout = setTimeout(() => {
        EventSystem.remove(this);
        reject(new Error(`rpc timeout: ${id}`));
      }, 8000);

      const onRpc = (rpcData: any) => {
        if (rpcData?.id !== id) return;
        clearTimeout(timeout);
        EventSystem.remove(this);

        try {
          const parsed = typeof rpcData.payload === "string" ? JSON.parse(rpcData.payload) : rpcData.payload;
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      };

      EventSystem.addListent("WebSocketMessage", onRpc, this);
    });
  }

  private extractText(content: any): string {
    if (!content) return "";
    if (typeof content.text === "string") return content.text.trim();
    if (content.text && typeof content.text.message === "string") return content.text.message.trim();
    return "";
  }

  private extractTs(content: any, createTime: any): number {
    if (typeof content?.ts === "number") return content.ts;
    if (typeof createTime === "number") return createTime > 1e12 ? createTime : createTime * 1000;
    if (typeof createTime === "string") {
      const t = Date.parse(createTime);
      if (!Number.isNaN(t)) return t;
    }
    return Date.now();
  }

  private insertMsg(msg: PrivateMsg) {
    const arr = this.msgsByChannel.get(msg.channelId) || [];
    arr.push(msg);
    arr.sort((a, b) => (a.ts - b.ts) || (a.messageId || "").localeCompare(b.messageId || ""));
    this.msgsByChannel.set(msg.channelId, arr.slice(-this.maxMsgPerChannel));
  }

  private persist(channelId: string) {
    const arr = this.msgsByChannel.get(channelId) || [];
    sys.localStorage.setItem(this.storageKey(channelId), JSON.stringify(arr));
  }

  private loadLocalMsgs(channelId: string): PrivateMsg[] {
    const raw = sys.localStorage.getItem(this.storageKey(channelId));
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  private storageKey(channelId: string) {
    return `${this.storagePrefix}:${channelId}`;
  }

  private loadLocalSessions() {
    this.localSessionsByPeer.clear();
    const raw = sys.localStorage.getItem(this.sessionListKey);
    if (!raw) return;
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i] as LocalChatSessionItem;
        if (!s || !s.peerUid) continue;
        this.localSessionsByPeer.set(String(s.peerUid), {
          peerUid: String(s.peerUid),
          peerName: s.peerName ?? null,
          peerAvatar: s.peerAvatar ?? null,
          isNPC: !!s.isNPC,
          channelId: String(s.channelId || ""),
          lastMsg: String(s.lastMsg || ""),
          lastTs: Number(s.lastTs || 0),
          unread: Number(s.unread || 0),
        });
      }
    } catch {
      // ignore
    }
  }

  private persistLocalSessions() {
    const list = this.getSessionList();
    sys.localStorage.setItem(this.sessionListKey, JSON.stringify(list));
  }
}