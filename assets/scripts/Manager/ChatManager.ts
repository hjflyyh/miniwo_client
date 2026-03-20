import { AppConst } from "../AppConst";
import { MapModel } from "../Model/MapModel";
import { network } from "../Model/RequestData";


type ChatMessage = {
  from_type: string; // "player" / "npc"
  from_id: string;   // user id 或 npc id
  text: string;
  map_id: number;
  ts: number;
};

export class MapChatManager {
  private static _instance: MapChatManager;
  public static get instance() {
    if (!this._instance) this._instance = new MapChatManager();
    return this._instance;
  }

  public onMessages: (msgs: ChatMessage[]) => void = () => {};
  private _currentMapId = -1;
  private _inited = false;

  /** 在 websocket 连接成功后、进入地图后调用一次 */
  public init(mapId?: number) {
    if (this._inited) return;

    const mid = mapId ?? MapModel.getInstance().currentMapId;
    this._currentMapId = Number(mid);

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

  /** 发送聊天（RPC） */
  public send(text: string) {
    // const t = (text ?? "").trim();
    // if (!t) return;

    // AppConst.WebSocketManager.send({
    //   rpc: network.MapChatSendPlayer.toJSON(t, this._currentMapId),
    // });
  }

  /** 在你的 websocket onmessage 里，把 notification.content 丢给这个 */
  public handleNotification(notification: any) {
    if (!notification || notification.code !== 100) return;

    let content: any = null;
    try {
      content = JSON.parse(notification.content);
    } catch {
      return;
    }

    // 兼容你的现有 npc_update 解析：你之前是 content.data.npcs
    // chat 消息通常 content.data 里带 from_type/text/map_id/ts
    const payload = content?.data ?? content;

    if (
      payload &&
      typeof payload.from_type === "string" &&
      typeof payload.text === "string" &&
      payload.map_id !== undefined &&
      payload.ts !== undefined
    ) {
      const msg: ChatMessage = {
        from_type: payload.from_type,
        from_id: String(payload.from_id ?? ""),
        text: payload.text,
        map_id: Number(payload.map_id),
        ts: Number(payload.ts),
      };

      // 你可以改成 append 单条
      this.onMessages([msg]);
    }
  }
}