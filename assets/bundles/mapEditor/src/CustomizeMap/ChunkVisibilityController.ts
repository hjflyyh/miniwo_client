import { _decorator, Camera, Component, Node, Vec2, director, view, UITransform, Size } from 'cc';
import { MapEditor } from '../MapEditor';
import { MapManager } from '../MapManager';
import { MapModel } from 'db://assets/scripts/Model/MapModel';
// import { MapManager } from './MapManager';
// import { MapEditor } from './MapEditor';
// import { MapModel } from '../../../scripts/Model/MapModel';

const { ccclass, property } = _decorator;

@ccclass('ChunkVisibilityController')
export class ChunkVisibilityController extends Component {
    @property(Camera)
    public camera: Camera | null = null;

    @property
    public chunkSize = 8;

    @property
    public hotExpandChunks = 1;

    @property
    public warmExpandChunks = 2;

    @property
    public updateIntervalFrames = 8;

    @property
    public coldHideDelayFrames = 12;

    @property
    public rescanIntervalFrames = 30;

    @property
    public warmupFrames = 45;

    @property
    public enableDebugLog = false;

    @property
    public debugLogIntervalFrames = 30;

    private mapEditor: MapEditor | null = null;
    private mapContainer: Node | null = null; // disMapContainer
    private mapGridContainer: Node | null = null; // mapContainer

    private chunkNodes: Map<string, Set<Node>> = new Map();
    private nodeToChunk: Map<Node, string> = new Map();
    private chunkVisibleState: Map<string, boolean> = new Map();
    private chunkColdSinceFrame: Map<string, number> = new Map();

    private lastCameraChunkX = Number.MIN_SAFE_INTEGER;
    private lastCameraChunkY = Number.MIN_SAFE_INTEGER;
    private lastRescanFrame = -1;
    private startFrame = -1;
    private lastDebugLogFrame = -1;
    private lastMapWidth = -1;
    private lastMapHeight = -1;
    private missingGridKeyCount = 0;

    update(): void {
        if (!this.tryBindEditor()) return;

        const frame = director.getTotalFrames();
        if (this.mapEditor) {
            if (this.lastMapWidth !== this.mapEditor.mapWidth || this.lastMapHeight !== this.mapEditor.mapHeight) {
                // map 尺寸一旦变化，必须重建 chunk 索引；否则会出现“chunkKey 不匹配 hot/warm”导致误隐藏
                this.rebuildChunkIndexByScanningChildren();
                this.lastMapWidth = this.mapEditor.mapWidth;
                this.lastMapHeight = this.mapEditor.mapHeight;
                this.lastRescanFrame = frame;
            }
        }
        if (this.startFrame < 0) this.startFrame = frame;

        // 定期重扫 disMapContainer children，完全不依赖 MapEditor 回调
        if (this.lastRescanFrame < 0 || frame - this.lastRescanFrame >= this.rescanIntervalFrames) {
            this.rebuildChunkIndexByScanningChildren();
            this.lastRescanFrame = frame;
        }

        this.updateChunkVisibility();
    }

    private tryBindEditor(): boolean {
        if (this.mapEditor && this.mapContainer && this.mapGridContainer && this.camera) return true;

        const mgr = MapManager.GetInstance();
        if (!mgr) return false;

        const editor = mgr.getMapEditor() as MapEditor;
        if (!editor) return false;

        this.mapEditor = editor;
        this.mapContainer = editor.disMapContainer;
        this.mapGridContainer = editor.mapContainer;
        if (!this.camera) this.camera = editor.mainCamera;

        return !!this.mapEditor && !!this.mapContainer && !!this.mapGridContainer && !!this.camera;
    }

    private getChunkKey(cx: number, cy: number): string {
        return `${cx},${cy}`;
    }

    private gridToChunk(gx: number, gy: number): { cx: number; cy: number } {
        return {
            cx: Math.floor(gx / this.chunkSize),
            cy: Math.floor(gy / this.chunkSize),
        };
    }

    // 通过 tile 的本地坐标反算 grid（适配你现有 gridToWorld 规则）
    private localPosToGrid(localX: number, localY: number): { gx: number; gy: number } {
        const map = this.mapEditor!;
        const startX = -map.tileSize * (map.mapWidth - 1) / 2;
        const startY = map.tileSize * (map.mapHeight - 1) / 2;

        // 注意：MapModel.gridToWorld 会引入 buildingSize 的偏移项。
        // 这里为了避免不同设备/缩放导致 contentSize 变化造成误归类，需要用节点 UITransform 尺寸反推 buildingSize。
        // 由于本函数当前只接收 localX/localY，所以交给调用方通过 node 的 UITransform 提供一个更精确的 buildingSize。
        // 为了不破坏调用方，默认 buildingSize = 1（等价于 tileSize）。
        const buildingSize = new Vec2(1, 1);
        const offsetX = (buildingSize.x * map.tileSize) / 2 - map.tileSize / 2;
        const offsetY = (buildingSize.y * map.tileSize) / 2 - map.tileSize / 2;

        const gx = Math.floor(((localX - startX - offsetX) / map.tileSize) + 0.5);
        const gy = Math.floor(((startY + offsetY - localY) / map.tileSize) + 0.5);

        return {
            gx: Math.max(0, Math.min(map.mapWidth - 1, gx)),
            gy: Math.max(0, Math.min(map.mapHeight - 1, gy)),
        };
    }

    private localPosToGridWithBuildingSize(localX: number, localY: number, buildingSize: Vec2): { gx: number; gy: number } {
        const map = this.mapEditor!;
        const startX = -map.tileSize * (map.mapWidth - 1) / 2;
        const startY = map.tileSize * (map.mapHeight - 1) / 2;
        const offsetX = (buildingSize.x * map.tileSize) / 2 - map.tileSize / 2;
        const offsetY = (buildingSize.y * map.tileSize) / 2 - map.tileSize / 2;
        const gx = Math.floor(((localX - startX - offsetX) / map.tileSize) + 0.5);
        const gy = Math.floor(((startY + offsetY - localY) / map.tileSize) + 0.5);
        return {
            gx: Math.max(0, Math.min(map.mapWidth - 1, gx)),
            gy: Math.max(0, Math.min(map.mapHeight - 1, gy)),
        };
    }

    private rebuildChunkIndexByScanningChildren(): void {
        const container = this.mapContainer!;
        const mapGridContainer = this.mapGridContainer!;
        const mapGridUI = mapGridContainer.getComponent(UITransform);
        const newChunkNodes: Map<string, Set<Node>> = new Map();
        const newNodeToChunk: Map<Node, string> = new Map();

        this.missingGridKeyCount = 0;
        const children = container.children;
        for (let i = 0; i < children.length; i++) {
            const n = children[i];
            if (!n || !n.isValid) continue;

            // 只处理 DisplayTitle tile，避免误伤其他节点
            if (!n.getComponent('DisplayTitle')) continue;

            // 最可靠：直接使用 DisplayTitle 里保存的 gridKey。
            // gridKey 在 MapEditor.setDisplayTile 处被赋值为 `${newPos.x},${newPos.y}`，
            // 其坐标系与 hot/warm 的 bounds 计算使用的 grid 坐标一致。
            const disp = n.getComponent('DisplayTitle') as any;
            const gridKey: string | undefined = disp?.gridKey;
            if (!gridKey || typeof gridKey !== 'string') {
                this.missingGridKeyCount++;
                continue;
            }
            const parts = gridKey.split(',');
            const gx = parseInt(parts[0]);
            const gy = parseInt(parts[1]);
            if (!Number.isFinite(gx) || !Number.isFinite(gy)) {
                this.missingGridKeyCount++;
                continue;
            }
            const { cx, cy } = this.gridToChunk(gx, gy);
            const chunkKey = this.getChunkKey(cx, cy);

            let set = newChunkNodes.get(chunkKey);
            if (!set) {
                set = new Set<Node>();
                newChunkNodes.set(chunkKey, set);
            }
            set.add(n);
            newNodeToChunk.set(n, chunkKey);
        }

        this.chunkNodes = newChunkNodes;
        this.nodeToChunk = newNodeToChunk;
    }

    private getCameraVisibleGridBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
        const map = this.mapEditor!;
        const cam = this.camera!;

        const visible = view.getVisibleSize();
        // 更稳：用相机四个屏幕角点反算 grid 范围，避免不同设备/适配导致 orthoHeight/viewport 估算偏移。
        const w = visible.width;
        const h = visible.height;
        const pBL = MapModel.getInstance().worldPosToGride(new Vec2(0, 0), map);
        const pBR = MapModel.getInstance().worldPosToGride(new Vec2(w, 0), map);
        const pTL = MapModel.getInstance().worldPosToGride(new Vec2(0, h), map);
        const pTR = MapModel.getInstance().worldPosToGride(new Vec2(w, h), map);

        if (!pBL || !pBR || !pTL || !pTR) {
            return {
                minX: 0,
                maxX: map.mapWidth - 1,
                minY: 0,
                maxY: map.mapHeight - 1,
            };
        }

        const xs = [pBL.x, pBR.x, pTL.x, pTR.x];
        const ys = [pBL.y, pBR.y, pTL.y, pTR.y];

        const minXRaw = Math.min(...xs);
        const maxXRaw = Math.max(...xs);
        const minYRaw = Math.min(...ys);
        const maxYRaw = Math.max(...ys);

        if (![minXRaw, maxXRaw, minYRaw, maxYRaw].every((v) => Number.isFinite(v))) {
            return {
                minX: 0,
                maxX: map.mapWidth - 1,
                minY: 0,
                maxY: map.mapHeight - 1,
            };
        }

        return {
            minX: Math.max(0, Math.floor(minXRaw)),
            maxX: Math.min(map.mapWidth - 1, Math.ceil(maxXRaw)),
            minY: Math.max(0, Math.floor(minYRaw)),
            maxY: Math.min(map.mapHeight - 1, Math.ceil(maxYRaw)),
        };
    }

    private forceAllVisible(): void {
        this.chunkNodes.forEach((_nodes, chunkKey) => {
            this.setChunkVisible(chunkKey, true);
        });
    }

    private debugLog(state: Record<string, unknown>): void {
        if (!this.enableDebugLog) return;
        const frame = director.getTotalFrames();
        if (this.lastDebugLogFrame >= 0 && frame - this.lastDebugLogFrame < Math.max(1, this.debugLogIntervalFrames)) {
            return;
        }
        this.lastDebugLogFrame = frame;
        console.log("[ChunkVisibility]", JSON.stringify(state));
    }

    private buildChunkSetFromGridBounds(
        minX: number, maxX: number, minY: number, maxY: number, expandChunks: number
    ): Set<string> {
        const minCX = Math.floor(minX / this.chunkSize) - expandChunks;
        const maxCX = Math.floor(maxX / this.chunkSize) + expandChunks;
        const minCY = Math.floor(minY / this.chunkSize) - expandChunks;
        const maxCY = Math.floor(maxY / this.chunkSize) + expandChunks;

        const set = new Set<string>();
        for (let cx = minCX; cx <= maxCX; cx++) {
            for (let cy = minCY; cy <= maxCY; cy++) {
                set.add(this.getChunkKey(cx, cy));
            }
        }
        return set;
    }

    private setChunkVisible(chunkKey: string, visible: boolean): void {
        const prev = this.chunkVisibleState.get(chunkKey);
        if (prev === visible) return;

        const nodes = this.chunkNodes.get(chunkKey);
        if (nodes) {
            nodes.forEach((n) => {
                if (n && n.isValid) n.active = visible;
            });
        }

        this.chunkVisibleState.set(chunkKey, visible);
    }

    private updateChunkVisibility(): void {
        const frame = director.getTotalFrames();
        if (frame % Math.max(1, this.updateIntervalFrames) !== 0) return;
        if (!this.mapEditor || !this.camera || !this.mapContainer) return;

        // 启动预热期：先全显，避免低端设备首帧尺寸/相机未稳定导致全图误隐藏
        const inWarmup = this.startFrame >= 0 && (frame - this.startFrame) < Math.max(0, this.warmupFrames);
        if (inWarmup) {
            this.forceAllVisible();
            this.debugLog({
                phase: "warmup",
                frame,
                warmupFrames: this.warmupFrames,
                chunkNodes: this.chunkNodes.size,
                mapWidth: this.mapEditor.mapWidth,
                mapHeight: this.mapEditor.mapHeight,
                orthoHeight: this.camera.orthoHeight,
            });
            return;
        }

        if (this.chunkNodes.size === 0) {
            this.debugLog({
                phase: "empty_chunks",
                frame,
                chunkNodes: 0,
            });
            return;
        }

        const b = this.getCameraVisibleGridBounds();
        const invalidBounds =
            !Number.isFinite(b.minX) || !Number.isFinite(b.maxX) ||
            !Number.isFinite(b.minY) || !Number.isFinite(b.maxY) ||
            b.minX > b.maxX || b.minY > b.maxY;
        if (invalidBounds) {
            this.forceAllVisible();
            this.debugLog({
                phase: "invalid_bounds",
                frame,
                bounds: b,
                chunkNodes: this.chunkNodes.size,
            });
            return;
        }

        const hotSet = this.buildChunkSetFromGridBounds(
            b.minX, b.maxX, b.minY, b.maxY, this.hotExpandChunks
        );
        const warmSet = this.buildChunkSetFromGridBounds(
            b.minX, b.maxX, b.minY, b.maxY, this.warmExpandChunks
        );

        // 兜底：异常情况下不执行隐藏
        if (hotSet.size === 0 && warmSet.size === 0) {
            this.forceAllVisible();
            this.debugLog({
                phase: "empty_visible_set",
                frame,
                bounds: b,
                chunkNodes: this.chunkNodes.size,
                missingGridKeyCount: this.missingGridKeyCount,
            });
            return;
        }

        // 取当前摄像机中心 chunk，用于跨 chunk 时强制刷新（避免慢速拖动漏切）
        const centerGrid = MapModel.getInstance().worldPosToGride(
            new Vec2(view.getVisibleSize().width * 0.5, view.getVisibleSize().height * 0.5),
            this.mapEditor!
        );
        if (!Number.isFinite(centerGrid.x) || !Number.isFinite(centerGrid.y)) {
            this.forceAllVisible();
            this.debugLog({
                phase: "invalid_center_grid",
                frame,
                centerGrid,
                bounds: b,
                chunkNodes: this.chunkNodes.size,
            });
            return;
        }
        const centerChunk = this.gridToChunk(centerGrid.x, centerGrid.y);
        const crossedChunk =
            centerChunk.cx !== this.lastCameraChunkX || centerChunk.cy !== this.lastCameraChunkY;
        this.lastCameraChunkX = centerChunk.cx;
        this.lastCameraChunkY = centerChunk.cy;

        // 统计当前 active 数量，帮助判断 chunkKey 归属是否正确
        let activeNodeCount = 0;
        let matchedChunkCount = 0;
        for (const [chunkKey, nodes] of this.chunkNodes.entries()) {
            if (hotSet.has(chunkKey) || warmSet.has(chunkKey)) matchedChunkCount++;
            nodes.forEach((n) => {
                if (n && n.isValid && n.active) activeNodeCount++;
            });
        }

        this.chunkNodes.forEach((_nodes, chunkKey) => {
            if (hotSet.has(chunkKey) || warmSet.has(chunkKey)) {
                this.chunkColdSinceFrame.delete(chunkKey);
                this.setChunkVisible(chunkKey, true);
                return;
            }

            const coldSince = this.chunkColdSinceFrame.get(chunkKey);
            if (coldSince == null || crossedChunk) {
                this.chunkColdSinceFrame.set(chunkKey, frame);
                return;
            }

            if (frame - coldSince >= this.coldHideDelayFrames) {
                this.setChunkVisible(chunkKey, false);
            }
        });

        this.debugLog({
            phase: "normal",
            frame,
            hotSet: hotSet.size,
            warmSet: warmSet.size,
            chunkNodes: this.chunkNodes.size,
            matchedChunksInHotWarm: matchedChunkCount,
            activeNodes: activeNodeCount,
            // 如果归类依赖 gridKey 失败，会导致误隐藏
            missingGridKeyCount: this.missingGridKeyCount,
            // 仅保留最关键的边界信息（便于你贴日志时判断）
            bounds: b,
            centerGrid,
            mapWidth: this.mapEditor.mapWidth,
            mapHeight: this.mapEditor.mapHeight,
            orthoHeight: this.camera.orthoHeight,
        });
    }
}