import { _decorator, Component, Node, Sprite, Prefab, UITransform, Vec3, Color, Tween, instantiate } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GridPoolManager')
export class GridPoolManager extends Component {
    public _displayPool: Node[] = []; // 草地对象池
    public _displayActiveGrids: Map<string, Node> = new Map(); // 草地 激活的格子：key -> node
    public _displayRecycledGrids: Set<Node> = new Set(); // 草地 已回收的格子（移动到屏幕外）

    @property(Prefab)
    gridPrefab: Prefab = null!; // 格子预制体
    private static _instance: GridPoolManager;
    public static GetInstance(): GridPoolManager {
        return this._instance;
    }

    protected onLoad(): void {
        GridPoolManager._instance = this;
    }

    /**
     * 初始化对象池
     */
    public initPool(count: number): void {
        for (let i = 0; i < count; i++) {
            const grid = instantiate(this.gridPrefab);
            grid.parent = this.node;
            grid.active = true; // 始终保持active！
            
            // 初始位置放到屏幕外
            grid.setPosition(-10000, -10000, 0);
            
            this._displayPool.push(grid);
            this._displayRecycledGrids.add(grid);
        }
    }

    /**
     * 清除所有格子
     */
    clearAllGrids(): void {
        for (const [key, grid] of this._displayActiveGrids) {
            this.moveGridToRecycle(grid);
            this._displayRecycledGrids.add(grid);
        }
        this._displayActiveGrids.clear();
    }

    public getGrid(key){
        if (this._displayActiveGrids.has(key)) {
            return this._displayActiveGrids.get(key)!;
        }

        let grid = this.getAvailableGrid();
        if (!grid) {
            // 对象池不足，动态创建
            grid = instantiate(this.gridPrefab);
            grid.parent = this.node;
            grid.active = true;
            this._displayPool.push(grid);
        }
        return grid
    }

    /**
     * 隐藏格子（实际是移动到屏幕外）
     */
    hideGrid(key): void {
        const grid = this._displayActiveGrids.get(key);
        
        if (!grid) return;
        
        // 移动到屏幕外（回收位置）
        this.moveGridToRecycle(grid);
        
        // 从激活集合移除，加入回收集合
        this._displayActiveGrids.delete(key);
        this._displayRecycledGrids.add(grid);
    }

    /**
     * 移动格子到回收位置（屏幕外）
     */
    private moveGridToRecycle(grid: Node): void {
        // 快速移动到屏幕外，不使用动画避免性能问题
        grid.setPosition(-10000, -10000, 0);
    }

    /**
     * 获取可用格子（优先从回收池获取）
     */
    private getAvailableGrid(): Node | null {
        // 1. 优先使用已回收的格子
        if (this._displayRecycledGrids.size > 0) {
            const grid = this._displayRecycledGrids.values().next().value;
            this._displayRecycledGrids.delete(grid);
            return grid;
        }
        
        // 2. 从对象池获取
        for (let i = 0; i < this._displayPool.length; i++) {
            const grid = this._displayPool[i];
            if (!this.isGridActive(grid)) {
                return grid;
            }
        }
        
        return null;
    }

    private isGridActive(grid: Node): boolean {
        // 检查是否在激活集合中
        for (const [key, activeGrid] of this._displayActiveGrids) {
            if (activeGrid === grid) {
                return true;
            }
        }
        return false;
    }
}