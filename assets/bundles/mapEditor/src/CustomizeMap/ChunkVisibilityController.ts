import { _decorator, Camera, Component, Node, Vec2, director, view } from 'cc';
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

    private mapEditor: MapEditor | null = null;
    private mapContainer: Node | null = null; // disMapContainer

    private chunkNodes: Map<string, Set<Node>> = new Map();
    private nodeToChunk: Map<Node, string> = new Map();
    private chunkVisibleState: Map<string, boolean> = new Map();
    private chunkColdSinceFrame: Map<string, number> = new Map();

    private lastCameraChunkX = Number.MIN_SAFE_INTEGER;
    private lastCameraChunkY = Number.MIN_SAFE_INTEGER;
    private lastRescanFrame = -1;

    update(): void {
        if (!this.tryBindEditor()) return;

        const frame = director.getTotalFrames();

        // 定期重扫 disMapContainer children，完全不依赖 MapEditor 回调
        if (this.lastRescanFrame < 0 || frame - this.lastRescanFrame >= this.rescanIntervalFrames) {
            this.rebuildChunkIndexByScanningChildren();
            this.lastRescanFrame = frame;
        }

        this.updateChunkVisibility();
    }

    private tryBindEditor(): boolean {
        if (this.mapEditor && this.mapContainer && this.camera) return true;

        const mgr = MapManager.GetInstance();
        if (!mgr) return false;

        const editor = mgr.getMapEditor() as MapEditor;
        if (!editor) return false;

        this.mapEditor = editor;
        this.mapContainer = editor.disMapContainer;
        if (!this.camera) this.camera = editor.mainCamera;

        return !!this.mapEditor && !!this.mapContainer && !!this.camera;
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

        const gx = Math.round((localX - startX) / map.tileSize);
        const gy = Math.round((startY - localY) / map.tileSize);

        return {
            gx: Math.max(0, Math.min(map.mapWidth - 1, gx)),
            gy: Math.max(0, Math.min(map.mapHeight - 1, gy)),
        };
    }

    private rebuildChunkIndexByScanningChildren(): void {
        const container = this.mapContainer!;
        const newChunkNodes: Map<string, Set<Node>> = new Map();
        const newNodeToChunk: Map<Node, string> = new Map();

        const children = container.children;
        for (let i = 0; i < children.length; i++) {
            const n = children[i];
            if (!n || !n.isValid) continue;

            // 只处理 DisplayTitle tile，避免误伤其他节点
            if (!n.getComponent('DisplayTitle')) continue;

            const p = n.position;
            const { gx, gy } = this.localPosToGrid(p.x, p.y);
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
        const centerGrid = MapModel.getInstance().worldPosToGride(
            new Vec2(visible.width * 0.5, visible.height * 0.5),
            map
        );

        const aspect = visible.width / Math.max(1, visible.height);
        const halfHWorld = cam.orthoHeight;
        const halfWWorld = halfHWorld * aspect;

        const halfTilesX = Math.ceil(halfWWorld / map.tileSize);
        const halfTilesY = Math.ceil(halfHWorld / map.tileSize);

        return {
            minX: Math.max(0, centerGrid.x - halfTilesX),
            maxX: Math.min(map.mapWidth - 1, centerGrid.x + halfTilesX),
            minY: Math.max(0, centerGrid.y - halfTilesY),
            maxY: Math.min(map.mapHeight - 1, centerGrid.y + halfTilesY),
        };
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

        const b = this.getCameraVisibleGridBounds();

        const hotSet = this.buildChunkSetFromGridBounds(
            b.minX, b.maxX, b.minY, b.maxY, this.hotExpandChunks
        );
        const warmSet = this.buildChunkSetFromGridBounds(
            b.minX, b.maxX, b.minY, b.maxY, this.warmExpandChunks
        );

        // 取当前摄像机中心 chunk，用于跨 chunk 时强制刷新（避免慢速拖动漏切）
        const centerGrid = MapModel.getInstance().worldPosToGride(
            new Vec2(view.getVisibleSize().width * 0.5, view.getVisibleSize().height * 0.5),
            this.mapEditor!
        );
        const centerChunk = this.gridToChunk(centerGrid.x, centerGrid.y);
        const crossedChunk =
            centerChunk.cx !== this.lastCameraChunkX || centerChunk.cy !== this.lastCameraChunkY;
        this.lastCameraChunkX = centerChunk.cx;
        this.lastCameraChunkY = centerChunk.cy;

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
    }
}