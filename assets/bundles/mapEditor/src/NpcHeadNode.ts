import { _decorator, Camera, Component, Node, Sprite, UITransform, Vec3, view } from 'cc';
import { MapModel } from '../../../scripts/Model/MapModel';
import { Utils } from '../../../scripts/Utils/Utils';
import { MapManager } from './MapManager';
const { ccclass, property } = _decorator;

@ccclass('NpcHeadNode')
export class NpcHeadNode extends Component {
    public npcId = 0;
    public npcNode: Node | null = null;

    @property(Sprite)
    npcIcon : Sprite = null

    @property(Node)
    public showNode: Node = null!;

    // 头像贴边内缩（像素）
    @property
    public edgePadding = 36;

    // 视野判定边距（世界单位），防止贴边抖动
    @property
    public inViewWorldMargin = 0;

    // 如果有箭头子节点，可拖这里；会自动朝向 NPC 方向
    @property(Node)
    public arrowNode: Node | null = null;

    @property
    public debugLog = false;

    @property
    public debugLogIntervalMs = 300;

    // 点击头像时，相机平移速度（世界单位/秒）
    @property
    public cameraMoveSpeed = 3600;

    /** 头像显示尺寸（像素），为 0 时沿用 npcIcon 节点 UITransform */
    @property
    public iconSize = 60;

    private mapCamera: Camera | null = null;
    private lastIconUrl = '';
    private parentUITransform: UITransform | null = null;
    private tmpWorld = new Vec3();
    private tmpScreen = new Vec3();
    private lastDebugLogMs = 0;

    onLoad() {
        EventSystem.addListent('OnMatchData', this.onMatchData, this);
    }

    start() {
        const editor = MapManager.GetInstance()?.getMapEditor?.();
        this.mapCamera = editor?.mainCamera ?? null;
        this.parentUITransform = this.node.parent?.getComponent(UITransform) ?? null;
        if (this.npcId > 0) {
            this.refreshNpcIconFromMap();
        }
    }

    onDestroy() {
        EventSystem.remove(this);
    }

    public setNpcId(id: number, node: Node) {
        this.npcId = Math.floor(Number(id) || 0);
        this.npcNode = node;
        this.refreshNpcIconFromMap();
    }

    /** 从地图 NPC 数据刷新贴边头像 */
    public refreshNpcIconFromMap() {
        const sprite = this.npcIcon;
        if (!sprite?.isValid || this.npcId <= 0) {
            return;
        }
        const npc = this.resolveMapNpc(this.npcId);
        const url = this.resolveNpcIconUrl(npc);
        console.log(url)
        if (!url) {
            this.lastIconUrl = '';
            // sprite.spriteFrame = null;
            return;
        }
        if (url === this.lastIconUrl) {
            return;
        }
        this.lastIconUrl = url;
        const ui = sprite.getComponent(UITransform) || sprite.node.getComponent(UITransform);
        const w = this.iconSize > 0 ? this.iconSize : ui?.width;
        const h = this.iconSize > 0 ? this.iconSize : ui?.height;
        Utils.loadCover(url, sprite, w ?? null, h ?? null);
    }

    private onMatchData(data: any) {
        if (data?.opCode !== 1 || this.npcId <= 0) {
            return;
        }
        const npcs = data?.payload?.npcs;
        if (!Array.isArray(npcs)) {
            return;
        }
        for (let i = 0; i < npcs.length; i++) {
            const row = npcs[i];
            const id = Math.floor(Number(row?.id ?? row?.npc_id ?? row?.npcId) || 0);
            if (id === this.npcId) {
                this.refreshNpcIconFromMap();
                return;
            }
        }
    }

    /** 按 npcId 从 mapNpcs / mapEditNpc 查找 */
    private resolveMapNpc(npcId: number): Record<string, unknown> | null {
        const id = Math.floor(Number(npcId) || 0);
        if (id <= 0) {
            return null;
        }
        const map = MapModel.getInstance().mapNpcs as Record<string, Record<string, unknown>>;
        const fromMatch = map[String(id)] ?? map[id as unknown as string];
        if (fromMatch) {
            return fromMatch;
        }
        const editList = MapModel.getInstance().mapEditNpc as Array<Record<string, unknown>>;
        if (Array.isArray(editList)) {
            for (let i = 0; i < editList.length; i++) {
                const row = editList[i];
                if (Math.floor(Number(row?.id) || 0) === id) {
                    return row;
                }
            }
        }
        return null;
    }

    /** 头像 URL：优先 npc_avatar_url，其次 portrait / sprite */
    private resolveNpcIconUrl(npc: Record<string, unknown> | null): string {
        if (!npc) {
            return '';
        }
        const keys = [
            'npc_avatar_url',
            'npcAvatarUrl',
            'avatar_url',
            'avatarUrl',
            'portrait_url',
            'portraitUrl',
            'npc_sprite_url',
            'npcSpriteUrl',
            'sprite_url',
            'spriteUrl',
        ];
        for (let i = 0; i < keys.length; i++) {
            const v = npc[keys[i]];
            if (v != null && String(v).trim()) {
                return String(v).trim();
            }
        }
        return '';
    }

    update(_deltaTime: number) {
        if (this.npcId <= 0 || this.npcNode == null || !this.npcNode.isValid) {
            if (this.showNode) this.showNode.active = false;
            return;
        }

        if (!this.mapCamera || !this.parentUITransform) {
            const editor = MapManager.GetInstance()?.getMapEditor?.();
            this.mapCamera = editor?.mainCamera ?? null;
            this.parentUITransform = this.node.parent?.getComponent(UITransform) ?? null;
            if (!this.mapCamera || !this.parentUITransform) {
                if (this.showNode) this.showNode.active = false;
                return;
            }
        }

        this.npcNode.getWorldPosition(this.tmpWorld);
        this.mapCamera.worldToScreen(this.tmpWorld, this.tmpScreen);

        const visible = view.getVisibleSize();
        const vp = view.getViewportRect();
        const w = vp.width;
        const h = vp.height;

        // 改为世界空间判定（正交相机），避免 worldToScreen 坐标系差异导致误判
        const inView = this.isInMainCameraViewByWorldRect(this.tmpWorld);

        // 在视野内：隐藏头像
        if (inView) {
            if (this.showNode) this.showNode.active = false;
            this.printDebug({
                stage: 'inView-hide',
                inView,
                vp,
                w,
                h,
                wx: 0,
                wy: 0,
                edgeNx: 0,
                edgeNy: 0,
                edgeX: 0,
                edgeY: 0,
                localX: this.node.position.x,
                localY: this.node.position.y,
                safePad: 0,
            });
            return;
        }

        // 视野外：显示头像并贴到四边
        if (this.showNode) this.showNode.active = true;

        const cx = vp.x + w * 0.5;
        const cy = vp.y + h * 0.5;

        // 用“世界坐标相对相机中心”的方向做贴边，避免屏幕坐标系差异引起乱跳
        const camPos = this.mapCamera.node.worldPosition;
        const halfH = this.mapCamera.orthoHeight;
        const aspect = visible.height > 0 ? (visible.width / visible.height) : 1;
        const halfW = halfH * aspect;
        const wx = this.tmpWorld.x - camPos.x;
        const wy = this.tmpWorld.y - camPos.y;

        // 映射到相机视域归一化空间（中心0，边界±1）
        const nx = halfW > 1e-5 ? wx / halfW : 0;
        const ny = halfH > 1e-5 ? wy / halfH : 0;
        const denom = Math.max(Math.abs(nx), Math.abs(ny), 1e-5);
        const tNorm = 1 / denom; // 与 [-1,1] 边界求交
        const edgeNx = nx * tNorm;
        const edgeNy = ny * tNorm;

        const dirX = edgeNx;
        const dirY = edgeNy;

        // 约束 padding，避免负数或过大导致边界翻转
        const safePad = Math.max(0, Math.min(this.edgePadding, Math.floor(Math.min(w, h) * 0.5) - 1));
        const minX = vp.x + safePad;
        const maxX = vp.x + w - safePad;
        const minY = vp.y + safePad;
        const maxY = vp.y + h - safePad;

        // 屏幕边缘点（仅用于 debug）
        let edgeX = vp.x + (edgeNx * 0.5 + 0.5) * w;
        let edgeY = vp.y + (edgeNy * 0.5 + 0.5) * h;
        edgeX = Math.max(minX, Math.min(maxX, edgeX));
        edgeY = Math.max(minY, Math.min(maxY, edgeY));

        // 关键优化：直接在“父节点本地坐标”贴边，避免不同设备 viewport->UI 映射误差
        const parentSize = this.parentUITransform.contentSize;
        const anchor = this.parentUITransform.anchorPoint;
        const left = -anchor.x * parentSize.width + safePad;
        const right = (1 - anchor.x) * parentSize.width - safePad;
        const bottom = -anchor.y * parentSize.height + safePad;
        const top = (1 - anchor.y) * parentSize.height - safePad;

        const localX = left + (edgeNx * 0.5 + 0.5) * (right - left);
        const localY = bottom + (edgeNy * 0.5 + 0.5) * (top - bottom);
        this.node.setPosition(localX, localY, 0);

        this.printDebug({
            stage: 'outView-show',
            inView,
            vp,
            w,
            h,
            wx,
            wy,
            edgeNx,
            edgeNy,
            edgeX,
            edgeY,
            localX,
            localY,
            safePad,
        });

        // 可选箭头朝向
        if (this.arrowNode) {
            const rad = Math.atan2(wy, wx);
            this.arrowNode.angle = (rad * 180) / Math.PI;
        }
    }

    OnClickHead(){
        const editor = MapManager.GetInstance()?.getMapEditor?.();
        if (!editor || !this.npcNode || !this.npcNode.isValid) {
            return;
        }

        this.npcNode.getWorldPosition(this.tmpWorld);
        const curCamPos = editor.mainCamera.node.getPosition();
        const cameraParent = editor.mainCamera.node.parent;
        const target = new Vec3(0, 0, curCamPos.z);
        if (cameraParent) {
            const parentUI = cameraParent.getComponent(UITransform);
            if (parentUI) {
                const local = parentUI.convertToNodeSpaceAR(this.tmpWorld);
                target.set(local.x, local.y, curCamPos.z);
            } else {
                target.set(this.tmpWorld.x, this.tmpWorld.y, curCamPos.z);
            }
        } else {
            target.set(this.tmpWorld.x, this.tmpWorld.y, curCamPos.z);
        }

        // 保证目标在相机边界内
        target.x = Math.max(editor.minXCamera, Math.min(editor.maxXCamera, target.x));
        target.y = Math.max(editor.minYCamera, Math.min(editor.maxYCamera, target.y));

        // 按“速度=距离/时间”换算平滑时间
        const dist = Math.hypot(target.x - curCamPos.x, target.y - curCamPos.y);
        const speed = Math.max(1, this.cameraMoveSpeed);
        const duration = Math.max(0.08, Math.min(1.2, dist / speed));

        editor.smoothTime = duration;
        editor.targetPos = target;
    }

    private isInMainCameraViewByWorldRect(worldPos: Vec3): boolean {
        if (!this.mapCamera) return false;
        // 本项目是 2D 正交相机，主相机未旋转时可用世界轴对齐矩形快速判断
        const camPos = this.mapCamera.node.worldPosition;
        const halfH = this.mapCamera.orthoHeight;
        if (halfH <= 0) return false;
        const visible = view.getVisibleSize();
        const aspect = visible.height > 0 ? (visible.width / visible.height) : 1;
        const halfW = halfH * aspect;
        const m = this.inViewWorldMargin;
        return worldPos.x >= camPos.x - halfW - m &&
            worldPos.x <= camPos.x + halfW + m &&
            worldPos.y >= camPos.y - halfH - m &&
            worldPos.y <= camPos.y + halfH + m;
    }

    private printDebug(payload: {
        stage: string;
        inView: boolean;
        vp: { x: number; y: number; width: number; height: number };
        w: number;
        h: number;
        wx: number;
        wy: number;
        edgeNx: number;
        edgeNy: number;
        edgeX: number;
        edgeY: number;
        localX: number;
        localY: number;
        safePad: number;
    }) {
        if (!this.debugLog) return;
        const now = Date.now();
        if (now - this.lastDebugLogMs < this.debugLogIntervalMs) return;
        this.lastDebugLogMs = now;

        const parentSize = this.parentUITransform?.contentSize;
        const anchor = this.parentUITransform?.anchorPoint;
        const nodePos = this.node.position;
        console.log(
            `[NpcHeadNode][${this.npcId}] ${payload.stage}`,
            {
                inView: payload.inView,
                world: { x: this.tmpWorld.x, y: this.tmpWorld.y, z: this.tmpWorld.z },
                screen: { x: this.tmpScreen.x, y: this.tmpScreen.y, z: this.tmpScreen.z },
                viewport: payload.vp,
                visibleWH: { w: payload.w, h: payload.h },
                worldDeltaToCam: { wx: payload.wx, wy: payload.wy },
                edgeN: { x: payload.edgeNx, y: payload.edgeNy },
                edgeScreen: { x: payload.edgeX, y: payload.edgeY },
                local: { x: payload.localX, y: payload.localY },
                nodePos: { x: nodePos.x, y: nodePos.y, z: nodePos.z },
                safePad: payload.safePad,
                parentSize: parentSize ? { w: parentSize.width, h: parentSize.height } : null,
                parentAnchor: anchor ? { x: anchor.x, y: anchor.y } : null,
            }
        );
    }
}


