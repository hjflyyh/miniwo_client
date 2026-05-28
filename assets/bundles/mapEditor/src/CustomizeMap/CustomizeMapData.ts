import { _decorator, Component, instantiate, UITransform, Vec2, Vec3 } from 'cc';
import { MapEditor, NpcDebugTileData } from '../MapEditor';
import { MapManager } from '../MapManager';
import { AppConst } from '../../../../scripts/AppConst';
import { MapModel } from '../../../../scripts/Model/MapModel';
import { MapNpc } from '../MapNpc';
import { NpcHeadNode } from '../NpcHeadNode';
const { ccclass, property } = _decorator;

/** 服务端下发的 NPC 序列帧动作 URL */
export interface NpcSpriteAnimations {
    idle_url?: string;
    walking_left_url?: string;
    walking_up_url?: string;
    walking_down_url?: string;
}

@ccclass('CustomizeMapData')
export class CustomizeMapData extends Component {
    @property(MapEditor)
    map : MapEditor

    npcNodes: Record<string, MapNpc> = {}
    npcDebugTiles: Record<string, NpcDebugTileData> = {}
    /** npcId → 各方向序列帧条带图 URL */
    private npcSpriteAnimations: Record<string, NpcSpriteAnimations> = {}
    private npcTileCoordMode: 'raw' | 'flipY' | 'oneBased' | 'oneBasedFlipY' = 'raw';

    protected onLoad(): void {
    }

    start() {
        
        EventSystem.addListent("OnMatchData" , this.OnMatchData , this)
    }

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

    private addNpcs = {}
    AddNpc(npcId){
        let newNpc = instantiate(AppConst.UIRoot.npc)
        this.map.npcLayer.addChild(newNpc)

        let mapNpc = newNpc.addComponent(MapNpc)
        mapNpc.initNpcNode();
        mapNpc.npcId = npcId
        mapNpc.map = this.map
        mapNpc.customizeMapData = this

        let newHead = instantiate(MapManager.GetInstance().getMapEditorUI().npcHeadNode)
        // MapManager.GetInstance().getMapEditorUI().node.addChild(newHead)
        MapManager.GetInstance().getMapEditorUI().npcHeadNode.parent.addChild(newHead)

        let npcHeadNode = newHead.getComponent(NpcHeadNode)
        npcHeadNode.setNpcId(npcId, newNpc)
        npcHeadNode.refreshNpcIconFromMap()

        const cachedAnims = this.getNpcSpriteAnimations(npcId);
        if (cachedAnims) {
            mapNpc.setSpriteAnimations(cachedAnims);
        }

        return mapNpc
    }

    public setNpcSpriteAnimations(npcId: string | number, anims: NpcSpriteAnimations | null) {
        const key = String(npcId);
        if (!anims) {
            delete this.npcSpriteAnimations[key];
            return;
        }
        this.npcSpriteAnimations[key] = { ...anims };
        const npc = this.npcNodes[key];
        if (npc) {
            npc.setSpriteAnimations(this.npcSpriteAnimations[key]);
        }
    }

    public getNpcSpriteAnimations(npcId: string | number): NpcSpriteAnimations | null {
        const key = String(npcId);
        return this.npcSpriteAnimations[key] ?? null;
    }

    private applyTileCoordMode(mode: 'raw' | 'flipY' | 'oneBased' | 'oneBasedFlipY', rawX: number, rawY: number): Vec2 {
        const x = Math.round(rawX);
        const y = Math.round(rawY);
        if (mode === 'flipY') {
            return new Vec2(x, this.map.mapHeight - 1 - y);
        }
        if (mode === 'oneBased') {
            return new Vec2(x - 1, y - 1);
        }
        if (mode === 'oneBasedFlipY') {
            return new Vec2(x - 1, this.map.mapHeight - y);
        }
        return new Vec2(x, y);
    }

    private gridToNpcLayerPos(grid: Vec2): Vec3 | null {
        if (!this.map?.mapContainer || !this.map?.npcLayer) {
            return null;
        }
        const mapLocal = MapModel.getInstance().gridToWorld(grid, null, this.map);
        const world = this.map.mapContainer.getComponent(UITransform).convertToWorldSpaceAR(mapLocal);
        return this.map.npcLayer.getComponent(UITransform).convertToNodeSpaceAR(world);
    }

    private normalizeNpcTileCoord(rawX: any, rawY: any, npcLocal?: Vec3): Vec2 | null {
        const x = Number(rawX);
        const y = Number(rawY);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }

        const modes: Array<'raw' | 'flipY' | 'oneBased' | 'oneBasedFlipY'> = ['raw', 'flipY', 'oneBased', 'oneBasedFlipY'];
        if (!npcLocal) {
            return this.applyTileCoordMode(this.npcTileCoordMode, x, y);
        }

        let bestMode = this.npcTileCoordMode;
        let bestDistSq = Number.POSITIVE_INFINITY;
        for (let i = 0; i < modes.length; i++) {
            const mode = modes[i];
            const grid = this.applyTileCoordMode(mode, x, y);
            const pos = this.gridToNpcLayerPos(grid);
            if (!pos) {
                continue;
            }
            const dx = pos.x - npcLocal.x;
            const dy = pos.y - npcLocal.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestMode = mode;
            }
        }
        this.npcTileCoordMode = bestMode;
        return this.applyTileCoordMode(bestMode, x, y);
    }

    private updateNpcDebugTileCache(npcData: any, npcLocal?: Vec3) {
        const npcId = String(npcData?.id ?? '');
        if (!npcId) {
            return;
        }
        const tile = this.normalizeNpcTileCoord(npcData?.tile_x, npcData?.tile_y, npcLocal);
        const targetTile = this.normalizeNpcTileCoord(npcData?.target_tile_x, npcData?.target_tile_y, npcLocal);
        this.npcDebugTiles[npcId] = {
            tile_x: tile?.x,
            tile_y: tile?.y,
            target_tile_x: targetTile?.x,
            target_tile_y: targetTile?.y,
        };
    }

    private renderNpcDebugTileOverlay() {
        this.map.renderNpcTileDebugOverlay(Object.values(this.npcDebugTiles));
    }
    
    OnMatchData(data) {
        // console.log("比赛数据：")
        // console.log(data)
        const serverTs = this.extractServerTimestamp(data);
        if (serverTs && AppConst.WebSocketManager && AppConst.WebSocketManager.syncServerTimestampMs) {
            AppConst.WebSocketManager.syncServerTimestampMs(serverTs);
        }
        const globalNowMs = this.getServerTimeMs();
        const payloadMapId = Number(data?.payload?.map_id ?? 0);
        // 二次进入场景时，map.map_id 可能还没初始化完成，使用 currentMapId 兜底匹配，避免丢掉首包 NPC 初始化数据。
        const localMapId = Number(this.map?.map_id || MapModel.getInstance().currentMapId || 0);

        if(data.opCode == 1){
            if(payloadMapId > 0 && payloadMapId == localMapId){
                // this.npcNodes = {}
                // this.npcDebugTiles = {}
                this.npcTileCoordMode = 'raw';
                let npcs = data.payload.npcs
                for (let n = 0; n < npcs.length; n++) {
                    const npcEntry = npcs[n];
                    const npcId = npcEntry.id;
                    if (npcEntry.sprite_animations != null) {
                        this.setNpcSpriteAnimations(npcId, npcEntry.sprite_animations);
                    }
                    if (!this.npcNodes[npcId]) {
                        const mapNpc = this.AddNpc(npcId);

                        const x = npcEntry.x;
                        const y = npcEntry.y;
                        const npcLocal = this.parseServerPos(x, y);
                        if (!npcLocal) {
                            continue;
                        }
                        this.updateNpcDebugTileCache(npcEntry, npcLocal);

                        mapNpc.node.x = npcLocal.x;
                        mapNpc.node.y = npcLocal.y;

                        mapNpc.onServerMove({
                            x: npcLocal.x,
                            y: npcLocal.y,
                            tile_x: Number(npcEntry.tile_x),
                            tile_y: Number(npcEntry.tile_y),
                            target_tile_x: Number(npcEntry.target_tile_x),
                            target_tile_y: Number(npcEntry.target_tile_y),
                            timestamp: Number(npcEntry.timestamp ?? npcEntry.ts ?? data.payload.timestamp ?? serverTs ?? globalNowMs),
                        });

                        this.npcNodes[npcId] = mapNpc;
                    }
                }
                this.renderNpcDebugTileOverlay();
            }
        }else if(data.opCode == 2){
            if(payloadMapId > 0 && payloadMapId == localMapId){
                for(let s = 0 ;s < data.payload.npcs.length ; s++){
                    const npcData = data.payload.npcs[s];
                    if (npcData.sprite_animations != null) {
                        this.setNpcSpriteAnimations(npcData.id, npcData.sprite_animations);
                    }
                    let npc = this.npcNodes[npcData.id];
                    // 兜底：如果首包没赶上，增量包到达时补创建 NPC，避免“第二次进入 NPC 不见”
                    if (!npc) {
                        npc = this.AddNpc(npcData.id);
                        this.npcNodes[npcData.id] = npc;
                    }
                    if(npc){
                        const npcLocal = this.parseServerPos(npcData.x, npcData.y);
                        if (!npcLocal) {
                            continue;
                        }
                        this.updateNpcDebugTileCache(npcData, npcLocal);

                        if(npcData.state == 1 || npcData.state == 0){
                            npc.onServerMove({
                                x: npcLocal.x,
                                y: npcLocal.y,
                                tile_x: Number(npcData.tile_x),
                                tile_y: Number(npcData.tile_y),
                                target_tile_x: Number(npcData.target_tile_x),
                                target_tile_y: Number(npcData.target_tile_y),
                                timestamp: Number(npcData.timestamp ?? npcData.ts ?? data.payload.timestamp ?? serverTs ?? globalNowMs),
                            })
                            npc.onServerDialog(npcData)
                        }else if(npcData.state == 2){
                            if(!npc.inited){
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
                            npc.onServerDialog(npcData)
                        }
                    }
                }
                this.renderNpcDebugTileOverlay();
            }
        }
    }
}


