// PrivateChatManager.ts
// import { EventSystem } from "../EventSystem"; // 按你项目路径改
// import { AppConst } from "../AppConst";       // 按你项目路径改
import { sys, log } from "cc";
import { AppConst } from "../AppConst";

type Role = "self" | "peer";

function chatLog(...args: any[]) {
  try {
    (log as any)?.apply?.(null, args);
    return;
  } catch {}
  try { console.log(...args); } catch {}
}

/** 排查「私聊连不上」：控制台搜 [ChatDebug] */
function chatDebug(...args: any[]) {
  chatLog("[ChatDebug]", ...args);
}

/** RPC payload 脱敏摘要（避免刷屏、避免泄露长文本） */
function summarizeRpcPayload(id: string, payloadObj: any): Record<string, unknown> {
  try {
    const o = payloadObj && typeof payloadObj === "object" ? payloadObj : {};
    if (id === "private_chat_send") {
      const t = String((o as any).text ?? "");
      return {
        target_uid_tail: String((o as any).target_uid ?? "").slice(-8),
        text_len: t.length,
        need_avatar: (o as any).need_avatar,
      };
    }
    if (id === "private_chat_history") {
      return {
        target_uid_tail: String((o as any).target_uid ?? "").slice(-8),
        limit: (o as any).limit,
      };
    }
    if (id === "get_npc_chat_id") {
      return { npc_id: (o as any).npc_id };
    }
    return { keys: Object.keys(o as object) };
  } catch {
    return {};
  }
}

function wsConnectedSummary(): string {
  try {
    const wsm = AppConst.WebSocketManager as any;
    if (!wsm?.isConnected) return "WebSocketManager?";
    return wsm.isConnected() ? "ws=OPEN" : "ws=NOT_CONNECTED";
  } catch {
    return "ws=?";
  }
}

/**
 * Nakama RT `channel_join` 返回「对方 UID 不存在」类错误。
 * 常见于换服、清库、或 NPC 账号重建后，本地仍缓存旧的 `nakama_uid`。
 */
function isStaleChannelTargetError(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return m.includes("invalid channel target") || m.includes("user id not found");
}

/** 调试：会话列表一行写入/落盘时的摘要（便于对照后端字段与 peerName 来源） */
function logSessionRow(tag: string, row: LocalChatSessionItem) {
  try {
    chatLog(`[pm][sessionList][${tag}]`, {
      peerUid: row.peerUid,
      peerName: row.peerName,
      peerAvatar: row.peerAvatar,
      isNPC: row.isNPC,
      channelId: row.channelId,
      lastMsg: typeof row.lastMsg === "string" ? row.lastMsg.slice(0, 80) : row.lastMsg,
      lastTs: row.lastTs,
      unread: row.unread,
    });
  } catch {}
}

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

  // NPC 私聊：避免“上一条回复延迟到下一条才出现”的错觉，做一个轻量 pending 锁。
  private npcPendingByPeer = new Map<string, { lastSendTs: number; startedAt: number }>();
  private npcPendingUnlockTimerByPeer = new Map<string, number>();

  private readonly storagePrefix = "private_chat_v1";
  private readonly maxMsgPerChannel = 300;

  /** 升级前未按账号隔离的全局 key（仅用于一次性迁移） */
  private readonly legacySessionListKey = "private_chat_v1:sessions";
  private readonly legacyNpcUidMapKey = "private_chat_v1:npc_uid_map";
  private legacyChannelStorageKey(channelId: string): string {
    return `${this.storagePrefix}:${channelId}`;
  }

  /** 未登录时用占位，避免与其他 key 冲突 */
  private scopedStorageUid(): string {
    const uid = String(this.selfUid || "").trim();
    return uid || "_";
  }

  /** npcId -> peerUid 的本地缓存，避免打开 NPC 私聊必须先等 RPC 才能显示本地记录 */
  private npcUidMapStorageKey(): string {
    return `${this.storagePrefix}:u:${this.scopedStorageUid()}:npc_uid_map`;
  }

  private sessionListStorageKey(): string {
    return `${this.storagePrefix}:u:${this.scopedStorageUid()}:sessions`;
  }

  /** 某频道消息列表 */
  private channelMsgsStorageKey(channelId: string): string {
    return `${this.storagePrefix}:u:${this.scopedStorageUid()}:${channelId}`;
  }

  private _eventsBound = false;

  /** Nakama RT 请求 cid（与应答 echo 一致；用简单递增字符串，避免服务端回显数字 1/2 与自定义 cj_ 前缀不一致导致永远匹配不上） */
  private _rtCidSeq = 0;

  private nextRtCid(): string {
    this._rtCidSeq += 1;
    return String(this._rtCidSeq);
  }

  private constructor() {}

  /** 登录后调用 */
  init(selfUid: string) {
    const next = String(selfUid || "").trim();
    if (next !== this.selfUid) {
      this.clearRuntimeStateForUserSwitch();
    }
    this.selfUid = next;
    if (!this.selfUid) {
      return;
    }
    this.migrateLegacyStorageIfNeeded();
    this.loadLocalSessions();
    if (!this._eventsBound) {
      this.bindEvents();
      this._eventsBound = true;
    }
  }

  /** 切换 Nakama 账号时清空内存中的会话与消息，避免与本地存储串档 */
  private clearRuntimeStateForUserSwitch(): void {
    for (const t of this.npcPendingUnlockTimerByPeer.values()) {
      clearTimeout(t);
    }
    this.npcPendingUnlockTimerByPeer.clear();
    this.npcPendingByPeer.clear();
    this.sessionsByPeer.clear();
    this.sessionsByChannel.clear();
    this.msgsByChannel.clear();
    this.localSessionsByPeer.clear();
  }

  /**
   * 将旧版「全局一份」的私聊缓存迁到当前账号命名空间，并删除旧 key。
   * 仅在当前账号尚无会话存档且检测到 legacy key 时执行。
   */
  private migrateLegacyStorageIfNeeded(): void {
    const uid = String(this.selfUid || "").trim();
    if (!uid) return;

    const sessionKey = this.sessionListStorageKey();
    const legacySessionsRaw = sys.localStorage.getItem(this.legacySessionListKey);

    if (!sys.localStorage.getItem(sessionKey) && legacySessionsRaw) {
      try {
        sys.localStorage.setItem(sessionKey, legacySessionsRaw);
        const arr = JSON.parse(legacySessionsRaw);
        if (Array.isArray(arr)) {
          for (let i = 0; i < arr.length; i++) {
            const row = arr[i] as LocalChatSessionItem;
            const cid = row && String(row.channelId || "");
            if (!cid) continue;
            const legacyChan = this.legacyChannelStorageKey(cid);
            const nextChan = this.channelMsgsStorageKey(cid);
            if (!sys.localStorage.getItem(nextChan)) {
              const blob = sys.localStorage.getItem(legacyChan);
              if (blob) {
                sys.localStorage.setItem(nextChan, blob);
              }
            }
          }
        }
      } catch {
        // ignore
      }
      try {
        sys.localStorage.removeItem(this.legacySessionListKey);
        const arr = JSON.parse(legacySessionsRaw);
        if (Array.isArray(arr)) {
          for (let i = 0; i < arr.length; i++) {
            const row = arr[i] as LocalChatSessionItem;
            const cid = row && String(row.channelId || "");
            if (cid) {
              sys.localStorage.removeItem(this.legacyChannelStorageKey(cid));
            }
          }
        }
      } catch {
        // ignore
      }
    }

    const npcKey = this.npcUidMapStorageKey();
    if (!sys.localStorage.getItem(npcKey)) {
      const legacyNpc = sys.localStorage.getItem(this.legacyNpcUidMapKey);
      if (legacyNpc) {
        try {
          sys.localStorage.setItem(npcKey, legacyNpc);
        } catch {
          // ignore
        }
        try {
          sys.localStorage.removeItem(this.legacyNpcUidMapKey);
        } catch {
          // ignore
        }
      }
    }
  }

  private bindEvents() {
    EventSystem.addListent("ChannelMessage", this.onChannelMessage, this);
    EventSystem.addListent("WebSocketConnected", this.onWebSocketConnected, this);
    EventSystem.addListent("WebSocketNotifications", this.onNotification, this);
  }

  dispose() {
    
  }

  /**
   * 会话列表（按用户聚合，按最近消息时间倒序）。
   *
   * 数据来源（非后端直接一条接口返回整张表）：
   * - 内存 Map `localSessionsByPeer`，启动时由 `loadLocalSessions()` 从「当前账号」对应的 `localStorage` key（`private_chat_v1:u:<selfUid>:sessions`）读入；
   * - 之后每次 `upsertLocalSession` / `markSessionRead` 会 `persistLocalSessions()` 写回磁盘。
   *
   * `peerName` 可能来自：
   * - `get_npc_chat_id` RPC 的 `name`（见 `openNpcSession` → `openSessionByUid`）；
   * - 打开真人会话时传入的 `userName` / `openUserSession`；
   * - `channel_message` 里 Nakama 带的 `username`（补会话时 `data.username`，易与“显示昵称”混淆，不一定是业务上的 NPC 名）；
   * - 本地合并时保留上一次的 `peerName`。
   */
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
    const uid = String(item.peerUid || "");
    const inferredNpc = uid ? this.isKnownNpcPeerUid(uid) : false;
    const merged: LocalChatSessionItem = {
      ...item,
      isNPC: !!item.isNPC || inferredNpc,
    };
    const prev = this.localSessionsByPeer.get(merged.peerUid);
    if (prev) {
      this.localSessionsByPeer.set(merged.peerUid, { ...prev, ...merged });
    } else {
      this.localSessionsByPeer.set(merged.peerUid, { ...merged });
    }
    const saved = this.localSessionsByPeer.get(merged.peerUid);
    if (saved) {
      logSessionRow("upsertLocalSession(merge后)", saved);
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

  /**
   * 仅用本地缓存打开会话（不 join channel），用于进入 ChatView 先渲染本地聊天记录。
   * 返回 null 表示本地没有对应会话缓存。
   */
  public tryOpenLocalSession(peerUid: string): ChatSession | null {
    const uid = String(peerUid || "");
    if (!uid) return null;

    const cached = this.sessionsByPeer.get(uid);
    if (cached) return cached;

    const local = this.localSessionsByPeer.get(uid);
    if (!local || !local.channelId) return null;

    const s: ChatSession = {
      peerUid: uid,
      peerName: local.peerName ?? null,
      peerAvatar: local.peerAvatar ?? null,
      isNPC: !!local.isNPC || this.isKnownNpcPeerUid(uid),
      channelId: String(local.channelId),
      openedAt: Date.now(),
    };
    this.sessionsByPeer.set(uid, s);
    this.sessionsByChannel.set(s.channelId, s);
    this.msgsByChannel.set(s.channelId, this.loadLocalMsgs(s.channelId));
    return s;
  }

  /** 仅本地读取消息（不要求 sessionByPeer 已打开） */
  public getLocalMessagesByPeer(peerUid: string): PrivateMsg[] {
    const uid = String(peerUid || "");
    const local = this.localSessionsByPeer.get(uid);
    if (!local || !local.channelId) return [];
    return this.loadLocalMsgs(String(local.channelId));
  }

  private loadNpcUidMap(): Record<string, string> {
    const raw = sys.localStorage.getItem(this.npcUidMapStorageKey());
    if (!raw) return {};
    try {
      const o = JSON.parse(raw);
      if (o && typeof o === "object") return o;
    } catch {}
    return {};
  }

  private saveNpcUidMap(map: Record<string, string>) {
    try {
      sys.localStorage.setItem(this.npcUidMapStorageKey(), JSON.stringify(map || {}));
    } catch {}
  }

  /** 根据 Nakama UID 反查本地缓存的 npcId（无则 null） */
  public getNpcIdByPeerUid(peerUid: string): number | null {
    const uid = String(peerUid || "");
    if (!uid) return null;
    const m = this.loadNpcUidMap();
    for (const key of Object.keys(m)) {
      if (String(m[key]) === uid) {
        const n = Number(key);
        return Number.isFinite(n) && n > 0 ? n : null;
      }
    }
    return null;
  }

  /** 是否在本地 npc 映射中（用于纠正仅靠 channel_message 建会话时误标 isNPC=false） */
  private isKnownNpcPeerUid(peerUid: string): boolean {
    return this.getNpcIdByPeerUid(peerUid) != null;
  }

  private getCachedNpcPeerUid(npcId: number): string | null {
    const id = Number(npcId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const m = this.loadNpcUidMap();
    const uid = m[String(id)];
    return uid ? String(uid) : null;
  }

  private cacheNpcPeerUid(npcId: number, peerUid: string) {
    const id = Number(npcId);
    const uid = String(peerUid || "");
    if (!Number.isFinite(id) || id <= 0 || !uid) return;
    const m = this.loadNpcUidMap();
    m[String(id)] = uid;
    this.saveNpcUidMap(m);
  }

  /** 清除某 NPC 在本地映射里缓存的 nakama_uid，便于下次走 `get_npc_chat_id` 重拉 */
  private removeNpcPeerUidCacheForNpc(npcId: number): void {
    const id = Number(npcId);
    if (!Number.isFinite(id) || id <= 0) return;
    const m = this.loadNpcUidMap();
    if (m[String(id)] == null) return;
    delete m[String(id)];
    this.saveNpcUidMap(m);
  }

  /** 仅清内存中的会话对象（localStorage 会话列表不动，避免误删历史） */
  private evictRuntimeSessionForPeer(peerUid: string): void {
    const uid = String(peerUid || "");
    if (!uid) return;
    const s = this.sessionsByPeer.get(uid);
    if (s?.channelId) {
      const cid = String(s.channelId);
      this.sessionsByChannel.delete(cid);
      this.msgsByChannel.delete(cid);
    }
    this.sessionsByPeer.delete(uid);
  }

  /** 打开 NPC 私聊 */
  async openNpcSession(npcId: number): Promise<ChatSession> {
    try { chatLog("[openNpcSession]", { npcId }); } catch {}
    const cachedUid = this.getCachedNpcPeerUid(npcId);
    if (cachedUid) {
      this.tryOpenLocalSession(cachedUid);
      try {
        return await this.openSessionByUid(
          cachedUid,
          true,
          this.localSessionsByPeer.get(cachedUid)?.peerName ?? null,
          this.localSessionsByPeer.get(cachedUid)?.peerAvatar ?? null
        );
      } catch (e) {
        const msg = String((e as any)?.message || e);
        if (isStaleChannelTargetError(msg)) {
          try {
            chatDebug("openNpcSession: 缓存 nakama_uid 对当前 Nakama 无效，清除映射并重拉", {
              npcId,
              old_uid_tail: cachedUid.slice(-8),
            });
          } catch {}
          this.removeNpcPeerUidCacheForNpc(npcId);
          this.evictRuntimeSessionForPeer(cachedUid);
        } else {
          throw e instanceof Error ? e : new Error(msg);
        }
      }
    }
    const r = await this.rpc("get_npc_chat_id", { npc_id: npcId });
    try {
      chatLog("[pm] get_npc_chat_id RPC 原始返回（用于核对 name/avatar 等字段）", r);
    } catch {}
    if (!r?.success || !r.nakama_uid) {
      try {
        chatDebug("get_npc_chat_id failed", { npcId, message: r?.message, success: r?.success });
      } catch {}
      throw new Error(r?.message || "get_npc_chat_id failed");
    }

    this.cacheNpcPeerUid(npcId, String(r.nakama_uid));
    try { chatLog("[openNpcSession] got uid", { npcId, peerUid: String(r.nakama_uid) }); } catch {}
    return this.openSessionByUid(r.nakama_uid, true, r.name ?? null, r.avatar ?? null);
  }

  /** 打开真人私聊 */
  async openUserSession(peerUid: string, peerName?: string): Promise<ChatSession> {
    return this.openSessionByUid(peerUid, false, peerName ?? null, null);
  }

  /** 会话列表等：已知 NPC 的 Nakama UID、本地无 npcId 映射时打开 */
  async openNpcSessionByPeerUid(peerUid: string, peerName?: string | null): Promise<ChatSession> {
    const uid = String(peerUid || "");
    if (!uid) throw new Error("peerUid 无效");
    return this.openSessionByUid(uid, true, peerName ?? null, null);
  }

  private async openSessionByUid(
    peerUid: string,
    isNPC: boolean,
    peerName: string | null,
    peerAvatar: string | null
  ): Promise<ChatSession> {
    try { chatLog("[openSessionByUid] enter", { peerUid, isNPC }); } catch {}
    const cached = this.sessionsByPeer.get(peerUid);
    if (cached) {
      // 注意：tryOpenLocalSession 会提前塞一个“本地缓存 session”，如果这里直接 return，
      // 就永远不会 join realtime channel，导致收不到后端主动推送的 channel_message。
      await this.loadDmHistory(cached).catch(() => {});
      // 无论是否命中缓存，都确保建立 realtime 订阅（后台修正 channelId 映射）。
      try {
        chatLog("[openSessionByUid] cached -> ensure joinChat", { peerUid });
        const ch = await this.joinChat(peerUid);
        chatLog("[openSessionByUid] cached joinChat ok", { peerUid, channel: ch });
        if (ch?.id && typeof ch.id === "string" && ch.id !== cached.channelId) {
          this.migrateSessionChannelId(cached, ch.id);
        }
      } catch (e) {
        const msg = String((e as any)?.message || e);
        try { chatLog("[openSessionByUid] cached joinChat failed", { peerUid, err: msg }); } catch {}
        if (isNPC && isStaleChannelTargetError(msg) && this.getNpcIdByPeerUid(peerUid) != null) {
          try {
            chatDebug("cached joinChat: NPC 目标 UID 过期，抛出以触发 openNpcSession 重拉", {
              peer_tail: peerUid.slice(-8),
            });
          } catch {}
          throw e instanceof Error ? e : new Error(msg);
        }
      }
      return cached;
    }

    // 进入界面时优先用本地缓存（若存在），让 ChatView 先渲染本地记录；随后再 join 实时 channel
    const localRow = this.localSessionsByPeer.get(peerUid);
    if (localRow?.channelId) {
      const s0: ChatSession = {
        peerUid,
        peerName: peerName ?? localRow.peerName ?? null,
        peerAvatar: peerAvatar ?? localRow.peerAvatar ?? null,
        isNPC,
        channelId: String(localRow.channelId),
        openedAt: Date.now(),
      };
      this.sessionsByPeer.set(peerUid, s0);
      this.sessionsByChannel.set(s0.channelId, s0);
      this.msgsByChannel.set(s0.channelId, this.loadLocalMsgs(s0.channelId));
      // 不 await：本地先用，服务端 history 后续再合并
      this.loadDmHistory(s0).catch(() => {});
    }

    try { chatLog("[openSessionByUid] calling joinChat", { peerUid }); } catch {}
    const channel = await this.joinChat(peerUid); // DM type=2（实时）
    try { chatLog("[openSessionByUid] joinChat ok", { peerUid, channel }); } catch {}

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

    await this.loadDmHistory(s).catch(() => {});

    return s;
  }

  /** 从服务端拉取 DM 最近消息（含 NPC 回复），合并进本地并刷新 UI */
  private async loadDmHistory(session: ChatSession): Promise<void> {
    try {
      chatDebug("loadDmHistory ->", wsConnectedSummary(), {
        peer_tail: String(session.peerUid || "").slice(-8),
      });
    } catch {}
    const r = await this.rpc("private_chat_history", {
      target_uid: session.peerUid,
      limit: 50,
    });
    if (!r?.success || !Array.isArray(r.messages) || r.messages.length === 0) {
      try {
        chatDebug("loadDmHistory empty/fail", {
          success: r?.success,
          message: (r as any)?.message,
          keys: r ? Object.keys(r) : [],
        });
      } catch {}
      return;
    }
    const channelId = session.channelId;
    const list = [...(this.msgsByChannel.get(channelId) || [])];
    const seen = new Set(list.filter((m) => m.messageId).map((m) => m.messageId as string));
    for (const row of r.messages) {
      const mid = String(row.message_id || "");
      const text = String(row.text || "").trim();
      if (!text) continue;
      if (mid && seen.has(mid)) continue;
      const ts =
        typeof row.create_time_ms === "number" ? row.create_time_ms : Date.now();
      // 对账：历史里出现“自己刚发的消息”，若本地已存在 local-*，则升级而不是插入新的一条
      const isSelf = String(row.sender_id || "") === String(this.selfUid || "");
      if (isSelf) {
        const idx = list.findIndex((x) => {
          if (!x) return false;
          if (x.role !== "self") return false;
          if ((String(x.text || "").trim()) !== (String(text || "").trim())) return false;
          const dt = Math.abs((x.ts || 0) - (ts || 0));
          if (dt > 10000) return false;
          const midLocal = String(x.messageId || "");
          return midLocal.startsWith("local-");
        });
        if (idx >= 0) {
          const local = list[idx];
          if (mid) {
            local.messageId = mid;
            seen.add(mid);
          }
          if (Number.isFinite(ts) && ts > 0) {
            local.ts = ts;
          }
          continue;
        }
      }
      const msg: PrivateMsg = {
        messageId: mid || `hist-${ts}-${row.sender_id || ""}`,
        channelId,
        senderId: String(row.sender_id || ""),
        username: row.username || "",
        text,
        ts,
        role: isSelf ? "self" : "peer",
      };
      if (mid) seen.add(mid);
      list.push(msg);
    }
    list.sort(
      (a, b) =>
        (a.ts - b.ts) || (a.messageId || "").localeCompare(b.messageId || "")
    );
    this.msgsByChannel.set(channelId, list.slice(-this.maxMsgPerChannel));
    this.persist(channelId);
    const last = list.length > 0 ? list[list.length - 1] : null;
    this.upsertLocalSession({
      peerUid: session.peerUid,
      peerName: session.peerName,
      peerAvatar: session.peerAvatar,
      isNPC: session.isNPC,
      channelId: session.channelId,
      lastMsg: last?.text || "",
      lastTs: last?.ts || session.openedAt,
      unread: this.localSessionsByPeer.get(session.peerUid)?.unread || 0,
    });
    // 若正在等 NPC 回复，只要历史里出现新 peer 消息就解除 pending
    if (session.isNPC) {
      const pending = this.npcPendingByPeer.get(session.peerUid);
      if (pending) {
        const hasNewPeer = list.some((m) => m.role === "peer" && (m.ts || 0) > pending.lastSendTs);
        if (hasNewPeer) {
          this.npcPendingByPeer.delete(session.peerUid);
        }
      }
    }
    EventSystem.send("PrivateChatMessage", { session, message: undefined });
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

    if (s.isNPC) {
      const pending = this.npcPendingByPeer.get(peerUid);
      if (pending) {
        throw new Error("请等待NPC回复");
      }
    }

    const needAvatar = !this.hasLocalPeerAvatar(peerUid);
    try {
      chatDebug("sendText ->", wsConnectedSummary(), summarizeRpcPayload("private_chat_send", {
        target_uid: peerUid,
        text: pure,
        need_avatar: needAvatar,
      }));
    } catch {}
    const r = await this.rpc("private_chat_send", {
      target_uid: peerUid,
      text: pure,
      need_avatar: needAvatar,
    });

    if (!r?.success) {
      try {
        chatDebug("sendText RPC fail", r);
      } catch {}
      throw new Error(r?.message || "send failed");
    }

    // 与 RPC 返回的 channel_id 对齐（避免 join 与 ChannelIdBuild 在边界情况下不一致导致收不到 channel_message）
    if (typeof r.channel_id === "string" && r.channel_id && r.channel_id !== s.channelId) {
      this.migrateSessionChannelId(s, r.channel_id);
    }

    // 发送成功不在本地插入消息，以 WebSocket channel_message 回推为准
    const serverTsRaw = Number((r as any)?.ts);
    const serverTsMs =
      Number.isFinite(serverTsRaw) && serverTsRaw > 0
        ? (serverTsRaw > 1e12 ? serverTsRaw : serverTsRaw * 1000)
        : 0;
    const sentTs = serverTsMs > 0 ? serverTsMs : Date.now();

    // NPC 回复异步写入；若 WS 推丢失，短时拉历史补全
    if (s.isNPC) {
      // 标记 pending，直到收到 NPC 新消息（ts > sentTs）或超时自动解除
      this.npcPendingByPeer.set(peerUid, { lastSendTs: sentTs, startedAt: Date.now() });
      // 彻底关闭“发送后轮询拉历史”：只依赖后端主动推送（channel_message）。
      // 为避免永远卡住，给一个超时解锁（不拉历史、不主动补消息）。
      this.startNpcPendingUnlock(peerUid);
    }
  }

  private startNpcPendingUnlock(peerUid: string) {
    const old = this.npcPendingUnlockTimerByPeer.get(peerUid);
    if (old) {
      clearTimeout(old);
      this.npcPendingUnlockTimerByPeer.delete(peerUid);
    }
    const t = setTimeout(() => {
      // 超时解锁：仅用于防止卡死，消息是否到达完全依赖后端推送。
      this.npcPendingByPeer.delete(peerUid);
      this.npcPendingUnlockTimerByPeer.delete(peerUid);
    }, 12000) as unknown as number;
    this.npcPendingUnlockTimerByPeer.set(peerUid, t);
  }

  private hasLocalPeerAvatar(peerUid: string): boolean {
    const uid = String(peerUid || "");
    if (!uid) return false;
    const s = this.sessionsByPeer.get(uid);
    const local = this.localSessionsByPeer.get(uid);
    const avatar = String(s?.peerAvatar || local?.peerAvatar || "").trim();
    return avatar.length > 0;
  }

  /** 将会话与本地消息从旧 channelId 迁到 RPC 返回的 channelId */
  private migrateSessionChannelId(session: ChatSession, newChannelId: string) {
    const oldId = session.channelId;
    if (!oldId || oldId === newChannelId) return;
    const msgs = this.msgsByChannel.get(oldId) || [];
    this.msgsByChannel.delete(oldId);
    this.sessionsByChannel.delete(oldId);
    session.channelId = newChannelId;
    for (const m of msgs) {
      m.channelId = newChannelId;
    }
    this.msgsByChannel.set(newChannelId, msgs);
    this.sessionsByChannel.set(newChannelId, session);
    try {
      if (String(this.selfUid || "").trim()) {
        sys.localStorage.removeItem(this.channelMsgsStorageKey(oldId));
      }
    } catch {
      // ignore
    }
    this.persist(newChannelId);
    const row = this.localSessionsByPeer.get(session.peerUid);
    if (row) {
      row.channelId = newChannelId;
      this.localSessionsByPeer.set(session.peerUid, row);
      this.persistLocalSessions();
    }
  }

  // ------------------- 读取 -------------------

  getMessages(peerUid: string): PrivateMsg[] {
    const s = this.sessionsByPeer.get(peerUid);
    if (!s) return [];
    return [...(this.msgsByChannel.get(s.channelId) || [])];
  }

  // ------------------- 实时接收 -------------------

  /** channel_message.content 可能是对象或 JSON 字符串 */
  private normalizeChannelContent(raw: any): any {
    if (raw == null) return {};
    if (typeof raw === "string") {
      const t = raw.trim();
      if (!t) return {};
      try {
        return JSON.parse(t);
      } catch {
        return { text: raw };
      }
    }
    return raw;
  }

  private onChannelMessage(data: any) {
    const channelId = data?.channel_id;
    if (!channelId) return;

    const content = this.normalizeChannelContent(data?.content);

    // 过滤：地图群聊（ROOM）也会走 channel_message，这里只处理私聊内容，避免串台
    // MapChatManager 的 content 结构：{ from_type, from_id, text, map_id, ts, ... }
    if (content.map_id != null || content.from_type != null) {
      return;
    }

    const npcNameRaw =
      typeof content.npc_name === "string" && content.npc_name.trim()
        ? content.npc_name.trim()
        : null;
    const sendNameRaw =
      typeof content.send_name === "string" && content.send_name.trim()
        ? content.send_name.trim()
        : null;
    const npcAvatarRaw =
      typeof content.npc_sprite_url === "string" && content.npc_sprite_url.trim()
        ? content.npc_sprite_url.trim()
        : (typeof content.npc_avatar === "string" && content.npc_avatar.trim()
            ? content.npc_avatar.trim()
            : null);

    try {
      chatLog("[pm] onChannelMessage", {
        channelId,
        senderId: data?.sender_id,
        username: data?.username,
        create_time: data?.create_time,
        content,
        npc_name: npcNameRaw,
        npc_sprite_url: typeof content.npc_sprite_url === "string" ? content.npc_sprite_url : null,
        npc_avatar: npcAvatarRaw,
      });
    } catch {}

    let session = this.sessionsByChannel.get(channelId);
    if (!session) {
      // 未打开会话也尽量补一份最小会话，避免列表漏消息
      const senderId = String(data?.sender_id || "");
      if (!senderId) return;
      const peerUid = senderId === this.selfUid ? "" : senderId;
      if (!peerUid) return;
      // 如果这个 peerUid 已经有会话，但 channelId 不一致（很常见：join 返回的 channel.id 与服务端推送里的 channel_id 不同格式），
      // 则把会话迁移到新的 channelId，确保 ChatView 通过 peerUid 取消息时不会“取错桶”。
      const existing = this.sessionsByPeer.get(peerUid);
      if (existing) {
        if (existing.channelId !== channelId) {
          this.migrateSessionChannelId(existing, channelId);
        }
        session = existing;
      } else {
        session = {
          peerUid,
          peerName: npcNameRaw || data?.username || null,
          peerAvatar: npcAvatarRaw,
          isNPC: this.isKnownNpcPeerUid(peerUid),
          channelId,
          openedAt: Date.now(),
        };
        this.sessionsByPeer.set(peerUid, session);
        this.sessionsByChannel.set(channelId, session);
      }
      if (!this.msgsByChannel.has(channelId)) {
        this.msgsByChannel.set(channelId, this.loadLocalMsgs(channelId));
      }
    }

    if (session && !session.isNPC && this.isKnownNpcPeerUid(session.peerUid)) {
      session.isNPC = true;
    }

    // 后端 NPC 私聊 content：{ npc_name, send_name, text, ts } —— 用 npc_name 作为展示名并写入会话
    if (session && npcNameRaw) {
      session.peerName = npcNameRaw;
    }
    if (session && npcAvatarRaw) {
      session.peerAvatar = npcAvatarRaw;
    }

    const text = this.extractText(content);
    if (!text) return;

    const isSelf = data.sender_id === this.selfUid;
    const displayName = isSelf
      ? sendNameRaw || data.username || ""
      : npcNameRaw || data.username || "";

    const msg: PrivateMsg = {
      messageId: data.message_id || "",
      channelId,
      senderId: data.sender_id || "",
      username: displayName,
      text,
      ts: this.extractTs(content, data.create_time),
      role: isSelf ? "self" : "peer",
    };

    // 去重
    const list = this.msgsByChannel.get(channelId) || [];
    // 1) 优先按 messageId 去重
    if (msg.messageId && list.some((x) => x.messageId === msg.messageId)) return;
    // 1.5) 自发消息对账：
    // - 本地发送时用 local-* id
    // - 回推到达时把本地那条升级为服务端 message_id（若有）
    if (msg.role === "self" && msg.text) {
      const idx = list.findIndex((x) => {
        if (!x) return false;
        if (x.role !== "self") return false;
        if ((String(x.text || "").trim()) !== (String(msg.text || "").trim())) return false;
        const dt = Math.abs((x.ts || 0) - (msg.ts || 0));
        if (dt > 10000) return false;
        // 优先升级“本地临时 id”的消息；也兼容 rpcMessageId 对账
        const mid = String(x.messageId || "");
        const rpcMid = String((x as any)?.rpcMessageId || "");
        if (mid.startsWith("local-")) return true;
        if (rpcMid && msg.messageId && rpcMid === String(msg.messageId)) return true;
        return false;
      });
      if (idx >= 0) {
        const local = list[idx];
        // 用服务端 message_id 覆盖本地 id（若服务端没给则保持 local-*）
        if (msg.messageId) {
          local.messageId = msg.messageId;
        }
        local.ts = msg.ts || local.ts;
        // senderId/role 不变
        this.msgsByChannel.set(channelId, [...list]);
        this.persist(channelId);
        // 会话列表 lastMsg/lastTs 也保持一致（不再重复插入）
        const last = list.length > 0 ? list[list.length - 1] : null;
        this.upsertLocalSession({
          peerUid: session.peerUid,
          peerName: session.peerName,
          peerAvatar: session.peerAvatar,
          isNPC: session.isNPC,
          channelId: session.channelId,
          lastMsg: last?.text || "",
          lastTs: last?.ts || session.openedAt,
          unread: this.localSessionsByPeer.get(session.peerUid)?.unread || 0,
        });
        EventSystem.send("PrivateChatMessage", { session, message: local });
        return;
      }
    }
    // 2) 某些网关/回包可能缺 message_id：对“自己发送的回推”做软去重，避免 UI 出现两条相同发送内容
    if (!msg.messageId && msg.role === "self") {
      const same = list.some((x) => {
        if (!x) return false;
        if (x.role !== "self") return false;
        if ((String(x.text || "").trim()) !== (String(msg.text || "").trim())) return false;
        const dt = Math.abs((x.ts || 0) - (msg.ts || 0));
        return dt <= 10000; // 10 秒内同文案视为同一条
      });
      if (same) return;
    }

    this.insertMsg(msg);
    this.persist(channelId);

    // 收到 NPC 的新消息：解除 pending 锁
    if (session.isNPC && msg.role === "peer") {
      const pending = this.npcPendingByPeer.get(session.peerUid);
      if (pending && (msg.ts || 0) > pending.lastSendTs) {
        this.npcPendingByPeer.delete(session.peerUid);
      }
    }

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

    try {
      const listNow = this.msgsByChannel.get(session.channelId) || [];
      chatLog("[pm] emit PrivateChatMessage", {
        peerUid: session.peerUid,
        sessionChannelId: session.channelId,
        incomingChannelId: channelId,
        msgId: msg.messageId,
        ts: msg.ts,
        total: listNow.length,
      });
    } catch {}
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
        await this.loadDmHistory(s).catch(() => {});
      } catch (e) {
        // 重连后单会话 rejoin 失败：静默，避免刷屏；需要时可在此打日志
      }
    }

    EventSystem.send("PrivateChatReconnected");
  }

  // ------------------- 工具 -------------------

  private async joinChat(targetUid: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const listenerToken: Record<string, unknown> = {};
      let settled = false;
      const cid = this.nextRtCid();
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const finish = (err: Error | null, channel?: any) => {
        if (settled) return;
        settled = true;
        if (timeout !== undefined) clearTimeout(timeout);
        EventSystem.remove(listenerToken);
        if (err) reject(err);
        else resolve(channel);
      };

      try {
        // Nakama RT：根节点带 cid，应答里带回同一 cid，避免并发多次 channel_join 错配
        // Nakama RT channel_join type：1=ROOM, 2=DIRECT, 3=GROUP。这里必须用 2（私聊）。
        // 注意：channel_id 字符串前缀（你们看到的 "4."）不是这里的 type。
        try {
          chatDebug("joinChat send", wsConnectedSummary(), {
            cid,
            target_tail: String(targetUid || "").slice(-8),
            type: 2,
          });
        } catch {}
        try { chatLog("[joinChat] send", { cid, target: targetUid, type: 2 }); } catch {}
        const ok = AppConst.WebSocketManager.send({
          cid,
          channel_join: {
            target: targetUid,
            type: 2,
            persistence: true,
            hidden: false,
          },
        });
        if (!ok) {
          try {
            chatDebug("joinChat send() returned false — WebSocket 未就绪或未 OPEN", wsConnectedSummary());
          } catch {}
          return reject(new Error("channel_join send failed"));
        }

        timeout = setTimeout(() => {
          try {
            chatDebug("joinChat timeout 8s", { cid, target_tail: String(targetUid || "").slice(-8), ws: wsConnectedSummary() });
          } catch {}
          finish(new Error("joinChat timeout"));
        }, 8000);

        const onRt = (data: any) => {
          if (data == null) return;
          try { chatLog("[joinChat] rt", data); } catch {}
          // 仅当「请求与应答都带 cid」时才严格匹配；避免一端为数字一端为字符串导致误判
          if (data.cid != null && cid != null) {
            const a = String(data.cid).trim();
            const b = String(cid).trim();
            if (a !== b && a !== "" && b !== "") {
              return;
            }
          }

          if (data.error != null) {
            const msg =
              typeof data.error === "string"
                ? data.error
                : data.error.message || data.error.msg || JSON.stringify(data.error);
            finish(new Error(msg || "channel_join failed"));
            return;
          }

          const ch = data.channel;
          if (!ch?.id) return;
          // DM=2；部分网关可能省略 type 或给字符串
          const t = ch.type;
          const isDm =
            t === 2 ||
            t === "2" ||
            t === undefined ||
            t === null ||
            Number(t) === 2;
          if (isDm) {
            finish(null, ch);
          }
        };
        EventSystem.addListent("WebSocketRT", onRt, listenerToken);
      } catch (e) {
        EventSystem.remove(listenerToken);
        reject(e);
      }
    });
  }

  private async rpc(id: string, payloadObj: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const listenerToken: Record<string, unknown> = {};
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const finish = (err: Error | null, parsed?: any) => {
        if (settled) return;
        settled = true;
        if (timeout !== undefined) clearTimeout(timeout);
        EventSystem.remove(listenerToken);
        if (err) reject(err);
        else resolve(parsed);
      };

      try {
        chatDebug(`rpc -> ${id}`, wsConnectedSummary(), summarizeRpcPayload(id, payloadObj));
      } catch {}

      const req = { rpc: { id, payload: JSON.stringify(payloadObj) } };
      const ok = AppConst.WebSocketManager.send(req);
      if (!ok) {
        try {
          chatDebug(`rpc send failed (ws not ready): ${id}`, wsConnectedSummary());
        } catch {}
        return reject(new Error("rpc send failed"));
      }

      timeout = setTimeout(() => {
        try {
          chatDebug(`rpc timeout: ${id}`, wsConnectedSummary());
        } catch {}
        finish(new Error(`rpc timeout: ${id}`));
      }, 8000);

      const onRpc = (rpcData: any) => {
        if (rpcData?.id !== id) return;
        try {
          const parsed = typeof rpcData.payload === "string" ? JSON.parse(rpcData.payload) : rpcData.payload;
          if (parsed && typeof parsed === "object" && (parsed as any).success === false) {
            try {
              chatDebug(`rpc response success=false: ${id}`, {
                message: (parsed as any).message,
                error: (parsed as any).error,
              });
            } catch {}
          }
          finish(null, parsed);
        } catch (e) {
          try {
            chatDebug(`rpc payload parse error: ${id}`, e);
          } catch {}
          finish(e instanceof Error ? e : new Error(String(e)));
        }
      };

      EventSystem.addListent("WebSocketMessage", onRpc, listenerToken);
    });
  }

  private extractText(content: any): string {
    if (content == null) return "";
    if (typeof content === "string") {
      const t = content.trim();
      if (!t) return "";
      try {
        return this.extractText(JSON.parse(t));
      } catch {
        return t;
      }
    }
    if (typeof content.text === "string") {
      const s = content.text.trim();
      if (!s) return "";
      if (s.startsWith("{") || s.startsWith("[")) {
        try {
          return this.extractText(JSON.parse(s));
        } catch {
          return s;
        }
      }
      return s;
    }
    if (content.text && typeof content.text === "object") {
      const o = content.text as Record<string, unknown>;
      if (typeof o.message === "string") return o.message.trim();
      if (typeof o.text === "string") return o.text.trim();
    }
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
    try {
      const last = arr[arr.length - 1];
      chatLog("[pm] insertMsg", {
        channelId: msg.channelId,
        role: msg.role,
        ts: msg.ts,
        messageId: msg.messageId,
        len: arr.length,
        lastTs: last?.ts,
        lastText: (last?.text || "").slice(0, 40),
      });
    } catch {}
  }

  private persist(channelId: string) {
    if (!String(this.selfUid || "").trim()) return;
    const arr = this.msgsByChannel.get(channelId) || [];
    sys.localStorage.setItem(this.channelMsgsStorageKey(channelId), JSON.stringify(arr));
  }

  private loadLocalMsgs(channelId: string): PrivateMsg[] {
    if (!String(this.selfUid || "").trim()) return [];
    const raw = sys.localStorage.getItem(this.channelMsgsStorageKey(channelId));
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  private loadLocalSessions() {
    this.localSessionsByPeer.clear();
    if (!String(this.selfUid || "").trim()) {
      return;
    }
    const raw = sys.localStorage.getItem(this.sessionListStorageKey());
    if (!raw) return;
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i] as LocalChatSessionItem;
        if (!s || !s.peerUid) continue;
        const uid = String(s.peerUid);
        const inferredNpc = this.isKnownNpcPeerUid(uid);
        this.localSessionsByPeer.set(uid, {
          peerUid: uid,
          peerName: s.peerName ?? null,
          peerAvatar: s.peerAvatar ?? null,
          isNPC: !!s.isNPC || inferredNpc,
          channelId: String(s.channelId || ""),
          lastMsg: String(s.lastMsg || ""),
          lastTs: Number(s.lastTs || 0),
          unread: Number(s.unread || 0),
        });
      }
      try {
        chatLog("[pm] loadLocalSessions 从磁盘读入条数", this.localSessionsByPeer.size);
      } catch {}
      this.persistLocalSessions();
    } catch {
      // ignore
    }
  }

  private persistLocalSessions() {
    const list = this.getSessionList();
    try {
      chatLog("[pm] persistLocalSessions 写入 localStorage", {
        key: this.sessionListStorageKey(),
        count: list.length,
        rows: list.map((x) => ({
          peerUid: x.peerUid,
          peerName: x.peerName,
          isNPC: x.isNPC,
          channelId: x.channelId,
          lastTs: x.lastTs,
          lastMsgPreview: (x.lastMsg || "").slice(0, 60),
        })),
      });
    } catch {}
    if (!String(this.selfUid || "").trim()) {
      return;
    }
    sys.localStorage.setItem(this.sessionListStorageKey(), JSON.stringify(list));
  }
}