import { AppConst } from "../AppConst";
import { Utils } from "../Utils/Utils";
import { MapModel } from "../Model/MapModel";
import { network } from "../Model/RequestData";
import { RoleModel } from "../Model/RoleModel";
import { HttpManager } from "./HttpManager";


type ChatMessage = {
  from_type: string; // "player" / "npc"
  from_id: string;   // user id 或 npc id
  text: unknown;
  map_id: number;
  ts: number;
  username : string;
  npc_name ?: string; // 可选，只有 from_type 是 npc 时才有
};

export class MapChatManager {
  private static _instance: MapChatManager;
  public static get instance() {
    if (!this._instance) this._instance = new MapChatManager();
    return this._instance;
  }

  public onMessages: (msgs: ChatMessage[]) => void = () => {

  };
  public msessages: ChatMessage[] = [];
  private _currentMapId = -1;
  private _inited = false;

  public init(){
        EventSystem.addListent("WebSocketMessage" , this.OnWebSocketMessage , this)
        EventSystem.addListent("ChannelMessage" , this.OnChannelMessage , this)
  }

  /** 离开地图时重置，下次进入可重新 join 并拉历史 */
  public leaveMap() {
    this._inited = false;
    this._currentMapId = -1;
    this.msessages = [];
  }

  /** 在 websocket 连接成功后、进入地图后调用一次 */
  public initMap(mapId?: number) {
    const mid = Number(mapId ?? MapModel.getInstance().currentMapId);
    if (this._inited && this._currentMapId === mid) {
      return;
    }

    this._currentMapId = mid;

    // 1) joinChat：加入 Room 才会收到实时推送
    // 假设你的 WebSocketManager 支持像 rpc 一样的指令透传：
    // 如果你项目里的字段名不是 joinChat，请把你的 send(playload)结构贴我，我帮你对齐。
    // console.log("MapChatManager init, joining chat channel for map", this._currentMapId);
    AppConst.WebSocketManager.send({
      channel_join: {
        target: `map:${this._currentMapId}`,
        type: 1,              // 1 = ROOM
        persistence: true,
        hidden: false
      }
    });

    

    // 2) 拉历史：RPC（你已做过类似）
    AppConst.WebSocketManager.send({
      rpc: network.MapChatHistory.toJSON(),
    });

    this._inited = true;
  }

    /**
     * 从文本中解析 @名字，与当前地图 mapNpcs 的 name 完全匹配则收集对应 npc id（去重）。
     * 例：`sfsdfsf  @NPC_6  sfsdf` → 若某 npc.name === "NPC_6" 则 mentions 包含其 id。
     */
    public buildMentionsFromText(text: string): string[] {
        const map = MapModel.getInstance().mapNpcs as Record<string, { name?: string }>;
        const re = /@\s*([^\s@]+)/g;
        const seen = new Set<string>();
        const ids: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
            const token = (m[1] ?? '').trim();
            if (!token) continue;
            for (const npcId in map) {
                const npc = map[npcId];
                if (!npc) continue;
                const name = npc.name != null ? String(npc.name) : '';
                if (name === token && !seen.has(npcId)) {
                    seen.add(npcId);
                    ids.push(String(npcId));
                    break;
                }
            }
        }
        return ids;
    }

     // mapId: 传 <=0 也可以（服务端会用“当前所在地图”）
    public async sendMapChat(text: string, mapId: number = -1) {
        const t = (text ?? '').trim();
        if (!t) return { success: false, message: '消息不能为空' };
        // 服务端限制：<= 200 字（按 rune 计数更稳）
        if ([...t].length > 200) return { success: false, message: '消息内容过长（最多200字）' };
        const payload: Record<string, unknown> = {
          map_id: mapId,
          text: t,
          player_id : RoleModel.getInstance().playerId
        };
        const mentions = this.buildMentionsFromText(t);
        if (mentions.length > 0) {
          payload.mentions = mentions;
        }
        const result = await this.rpc('map_chat_send_player', payload);
        // 期望：{success:true, message_id:...} 或 {success:false, message:...}
        return result;
    }

    public async rpc(name: string, payload: any) {
        const base = HttpManager.chatBaseUrl.replace(/\/+$/, ''); // 去掉末尾 /
        const url = `${base}/v2/rpc/${name}`;

        const token = RoleModel.getInstance().nakama_token;
        if (!token) {
            throw new Error('nakama_token 为空，无法调用 RPC');
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            },
            body: JSON.stringify(JSON.stringify(payload ?? {})),
        });

        const raw = await res.text();
        if (!res.ok) {
            console.error('RPC failed', name, res.status, raw);
            throw new Error(`RPC ${name} HTTP ${res.status}: ${raw}`);
        }

        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error('RPC JSON parse error', name, raw);
            throw e;
        }
    }

    private OnChannelMessage(data){
        const c = data?.content;
        // 过滤：地图群聊只消费带 map_id/from_type 的消息；私聊等其它 channel_message 直接忽略
        if (!c || typeof c !== "object") return;
        if (c.map_id == null || c.from_type == null) return;

        const mapId = Number(c.map_id);
        if (Number.isFinite(this._currentMapId) && this._currentMapId > 0 && mapId !== this._currentMapId) {
            return;
        }
        const msg: ChatMessage = {
            from_type: String(c.from_type || ""),
            from_id: String(c.from_id ?? ""),
            // 保留原始类型（可能是 string 或 {message,mentions} 对象），交给 getDisplayText 解析展示
            text: (c as any).text ?? "",
            map_id: mapId,
            ts: Number(c.ts ?? Utils.getServerNowMs()),
            username: String(c.nick_name ?? data?.username ?? ""),
            npc_name: c.npc_name != null ? String(c.npc_name) : undefined,
        };
        this.msessages.push(msg);

        EventSystem.send("EventRefreshChat")
    }

    private OnWebSocketMessage(data){
      if(data["id"] == "map_chat_history"){
        let payload: { messages?: Array<{ content: any; username?: string }> };
        try {
          payload = JSON.parse(data["payload"]);
        } catch {
          payload = { messages: [] };
        }
        this.msessages = [];
        const list = Array.isArray(payload?.messages) ? payload.messages : [];
        for(let m = 0 ; m < list.length ; m++){ 
          let content = list[m].content
          const msg: ChatMessage = {
            from_type: content.from_type,
            from_id: String(content.from_id ?? ""),
            text: content.text,
            map_id: Number(content.map_id),
            ts: Number(content.ts),
            username : list[m].username,
            npc_name : content.npc_name
          };
          this.msessages.push(msg);
        }

        EventSystem.send("EventRefreshChat");
      }
    }

    /** data.text 可能是普通字符串，也可能是 JSON：{"message":"...","mentions":[]} */
    public getDisplayText(raw: unknown): string {
        if (raw == null) return '';
        if (typeof raw !== 'string') {
            if(raw["message"]){
                return String(raw["message"])
            }
            return String(raw);
        }
        const s = raw.trim();
        if (s.length === 0) return '';
        if (s[0] !== '{') return raw;
        try {
            const obj = JSON.parse(s) as { message?: unknown; mentions?: unknown };
            if (obj && typeof obj === 'object' && 'message' in obj && obj.message != null) {
                return String(obj.message);
            }
        } catch {
            // 不是合法 JSON，按普通文本展示
        }
        return raw;
    }


  /** 在你的 websocket onmessage 里，把 notification.content 丢给这个 */
  // public handleNotification(notification: any) {
  //   if (!notification || notification.code !== 100) return;

  //   let content: any = null;
  //   try {
  //     content = JSON.parse(notification.content);
  //   } catch {
  //     return;
  //   }

  //   // 兼容你的现有 npc_update 解析：你之前是 content.data.npcs
  //   // chat 消息通常 content.data 里带 from_type/text/map_id/ts
  //   const payload = content?.data ?? content;

  //   if (
  //     payload &&
  //     typeof payload.from_type === "string" &&
  //     typeof payload.text === "string" &&
  //     payload.map_id !== undefined &&
  //     payload.ts !== undefined
  //   ) {
  //     const msg: ChatMessage = {
  //       from_type: payload.from_type,
  //       from_id: String(payload.from_id ?? ""),
  //       text: payload.text,
  //       map_id: Number(payload.map_id),
  //       ts: Number(payload.ts),
  //     };

  //     // 你可以改成 append 单条
  //     this.onMessages([msg]);
  //   }
  // }
}