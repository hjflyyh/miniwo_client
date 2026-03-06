import { _decorator, Component, instantiate, UITransform, Vec3 } from 'cc';
import { MapEditor } from '../MapEditor';
import { MapManager } from '../MapManager';
import { AppConst } from '../../../../scripts/AppConst';
import { MapModel } from '../../../../scripts/Model/MapModel';
import { MapNpc } from '../MapNpc';
import { NpcHeadNode } from '../NpcHeadNode';
const { ccclass, property } = _decorator;

@ccclass('CustomizeMapData')
export class CustomizeMapData extends Component {
    @property(MapEditor)
    map : MapEditor

    npcNodes: Record<string, MapNpc> = {}

    protected onLoad(): void {
        EventSystem.addListent("OnMatchData" , this.OnMatchData , this)
    }

    start() {}

    public getServerTimeMs(): number {
        if (AppConst.WebSocketManager && AppConst.WebSocketManager.getServerTimestampMs) {
            return AppConst.WebSocketManager.getServerTimestampMs();
        }
        return Date.now();
    }

    private extractServerTimestamp(data: any): number | null {
        const pick = (obj: any): number | null => {
            if (!obj || typeof obj !== "object") return null;
            const keys = ["server_ts", "server_time", "serverTime", "timestamp", "time_stamp", "ts", "time"];
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (obj[key] != null) {
                    const n = Number(obj[key]);
                    if (!Number.isNaN(n) && Number.isFinite(n) && n > 0) {
                        // 兼容秒级时间戳
                        return n < 1e12 ? n * 1000 : n;
                    }
                }
            }
            return null;
        };

        return pick(data?.payload) ?? pick(data) ?? pick(data?.match_data?.payload) ?? pick(data?.rpc?.payload);
    }

    public parseServerPos(x, y): Vec3 | null {
        const px = Number(x);
        const py = Number(y);
        if (Number.isNaN(px) || Number.isNaN(py)) {
            return null;
        }
        const mapPixelW = this.map.mapWidth * this.map.tileSize
        const mapPixelH = this.map.mapHeight * this.map.tileSize

        const localX = px - mapPixelW * 0.5
        const localY = mapPixelH * 0.5 - py;

        const world = this.map.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(new Vec3(localX , localY, 0));
        const npcLocal = this.map.npcLayer.getComponent(UITransform).convertToNodeSpaceAR(world)

        return npcLocal as Vec3
    }

    AddNpc(npcId){
        let newNpc = instantiate(AppConst.UIRoot.npc)
        this.map.npcLayer.addChild(newNpc)

        let mapNpc = newNpc.addComponent(MapNpc)
        mapNpc.npcId = npcId
        mapNpc.map = this.map
        mapNpc.customizeMapData = this

        let newHead = instantiate(MapManager.GetInstance().getMapEditorUI().npcHeadNode)
        // MapManager.GetInstance().getMapEditorUI().node.addChild(newHead)
        MapManager.GetInstance().getMapEditorUI().npcHeadNode.parent.addChild(newHead)

        let npcHeadNode = newHead.getComponent(NpcHeadNode)
        npcHeadNode.setNpcId(npcId , newNpc)

        return mapNpc
    }
    
    OnMatchData(data) {
        console.log("比赛数据：")
        // console.log(data)
        const serverTs = this.extractServerTimestamp(data);
        if (serverTs && AppConst.WebSocketManager && AppConst.WebSocketManager.syncServerTimestampMs) {
            AppConst.WebSocketManager.syncServerTimestampMs(serverTs);
        }
        const globalNowMs = this.getServerTimeMs();
        if(data.opCode == 1){
            if(data.payload.map_id == this.map.map_id){
                this.npcNodes = {}
                let npcs = data.payload.npcs
                for(let n = 0 ;n < npcs.length ; n++){
                    let npcId = data.payload.npcs[n].id
                    // let newNpc = instantiate(AppConst.UIRoot.npc)
                    // this.map.npcLayer.addChild(newNpc)

                    // let mapNpc = newNpc.addComponent(MapNpc)
                    // mapNpc.npcId = npcId
                    // mapNpc.map = this.map
                    // mapNpc.customizeMapData = this
                    let mapNpc = this.AddNpc(npcId)

                    let x = data.payload.npcs[n].x
                    let y = data.payload.npcs[n].y
                    const npcLocal = this.parseServerPos(x ,y)
                    if (!npcLocal) {
                        continue;
                    }

                    mapNpc.node.x = npcLocal.x
                    mapNpc.node.y = npcLocal.y

                    mapNpc.onServerMove({
                        x: npcLocal.x,
                        y: npcLocal.y,
                        tile_x: Number(npcs[n].tile_x),
                        tile_y: Number(npcs[n].tile_y),
                        target_tile_x: Number(npcs[n].target_tile_x),
                        target_tile_y: Number(npcs[n].target_tile_y),
                        timestamp: Number(npcs[n].timestamp ?? npcs[n].ts ?? data.payload.timestamp ?? serverTs ?? globalNowMs),
                    });

                    this.npcNodes[String(npcs[n].id)] = mapNpc
                }
            }
        }else if(data.opCode == 2){
            if(data.payload.map_id == this.map.map_id){
                for(let s = 0 ;s < data.payload.npcs.length ; s++){
                    const npcData = data.payload.npcs[s];
                    const npcId = String(npcData.id);
                    const npc = this.npcNodes[npcId];
                    if(npc){
                        const npcLocal = this.parseServerPos(npcData.x, npcData.y);
                        if (!npcLocal) {
                            continue;
                        }

                        npc.onServerMove({
                            x: npcLocal.x,
                            y: npcLocal.y,
                            tile_x: Number(npcData.tile_x),
                            tile_y: Number(npcData.tile_y),
                            target_tile_x: Number(npcData.target_tile_x),
                            target_tile_y: Number(npcData.target_tile_y),
                            timestamp: Number(npcData.timestamp ?? npcData.ts ?? data.payload.timestamp ?? serverTs ?? globalNowMs),
                        })
                    }
                }
            }
        }
    }
}


