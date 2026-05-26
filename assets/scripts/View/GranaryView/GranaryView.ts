import { _decorator, Color, Component, instantiate, Label, Layout, Node, ScrollView } from 'cc';
import { AppConst } from '../../AppConst';
import { GranaryItemCell } from './GranaryItemCell';
const { ccclass, property } = _decorator;

type GranaryListRow = {
    configKey: number;
    itemId: number;
};

@ccclass('GranaryView')
export class GranaryView extends Component {
    /** 绑定 ScrollViewItem 根节点（或 content，会自动向上找 ScrollView） */
    @property({ type: Node, tooltip: '种子/作物列表：ScrollViewItem 根节点' })
    public itemNodeContent: Node = null;

    @property({ type: Node, tooltip: '储藏列表：ScrollViewStar 根节点' })
    public starodeContent: Node = null;

    @property([Node])
    public chooseNodes: Node[] = [];

    @property([Label])
    public chooseLabeles: Label[] = [];

    @property(Node)
    public itemCell: Node = null;

    @property(Node)
    public starodeCell: Node = null;

    /** item 列表 content 下的动态格子 */
    public showItems: Node[] = [];

    /** starode 列表 content 下的动态格子 */
    public showStarodes: Node[] = [];

    private showType = 0;
    private itemScrollRoot: Node | null = null;
    private starodeScrollRoot: Node | null = null;
    private itemListContent: Node | null = null;
    private starodeListContent: Node | null = null;

    onLoad() {
        this.resolveScrollListNodes();
        if (this.itemCell?.isValid) {
            this.itemCell.active = false;
        }
        if (this.starodeCell?.isValid) {
            this.starodeCell.active = false;
        }
    }

    start() {
        this.refrehsTab();
    }

    /** itemNodeContent / starodeContent 可绑 ScrollView 根或 content，统一解析 */
    private resolveScrollListNodes() {
        this.itemScrollRoot = this.resolveScrollRoot(this.itemNodeContent);
        this.starodeScrollRoot = this.resolveScrollRoot(this.starodeContent);
        this.itemListContent = this.resolveScrollContent(this.itemScrollRoot ?? this.itemNodeContent);
        this.starodeListContent = this.resolveScrollContent(this.starodeScrollRoot ?? this.starodeContent);
    }

    /** 向上查找带 ScrollView 的节点（ScrollViewItem / ScrollViewStar 整棵） */
    private resolveScrollRoot(bindNode: Node | null): Node | null {
        if (!bindNode?.isValid) {
            return null;
        }
        if (bindNode.getComponent(ScrollView)) {
            return bindNode;
        }
        let cur: Node | null = bindNode.parent;
        while (cur?.isValid) {
            if (cur.getComponent(ScrollView)) {
                return cur;
            }
            cur = cur.parent;
        }
        return bindNode;
    }

    private resolveScrollContent(scrollRoot: Node | null): Node | null {
        if (!scrollRoot?.isValid) {
            return null;
        }
        const scroll = scrollRoot.getComponent(ScrollView);
        if (scroll?.content?.isValid) {
            return scroll.content;
        }
        const content = scrollRoot.getChildByPath('view/content');
        if (content?.isValid) {
            return content;
        }
        if (scrollRoot.name === 'content') {
            return scrollRoot;
        }
        return null;
    }

    /** 隐藏/显示整个 ScrollView（根节点含 view、content、遮罩） */
    private setScrollViewVisible(scrollRoot: Node | null, visible: boolean) {
        if (!scrollRoot?.isValid) {
            return;
        }
        scrollRoot.active = visible;
    }

    refrehsTab() {
        for (let i = 0; i < this.chooseNodes.length; i++) {
            if (i == this.showType) {
                this.chooseNodes[i].active = true;
                this.chooseLabeles[i].color = new Color(15, 15, 19);
            } else {
                this.chooseNodes[i].active = false;
                this.chooseLabeles[i].color = new Color(133, 133, 166);
            }
        }

        this.refreshList();
    }

    refreshList() {
        const useStarode = this.showType === 2;

        // 先整体隐藏两个 ScrollView，避免未切换的列表仍显示或 onEnable 冲突
        this.setScrollViewVisible(this.itemScrollRoot, false);
        this.setScrollViewVisible(this.starodeScrollRoot, false);

        if (useStarode) {
            this.clearListCells(this.itemListContent, this.itemCell, this.showItems);
            const rows = this.buildBasicCropsRows();
            this.syncListCells(this.starodeListContent, this.starodeCell, this.showStarodes, rows, 1);
            this.applyListLayout(this.starodeListContent);
            this.setScrollViewVisible(this.starodeScrollRoot, true);
            this.resetScrollView(this.starodeScrollRoot);
        } else {
            this.clearListCells(this.starodeListContent, this.starodeCell, this.showStarodes);
            const rows = this.showType === 0 ? this.buildBasicSeedsRows() : this.buildBasicCropsRows();
            const cellType = this.showType === 0 ? 0 : 1;
            this.syncListCells(this.itemListContent, this.itemCell, this.showItems, rows, cellType);
            this.applyListLayout(this.itemListContent);
            this.setScrollViewVisible(this.itemScrollRoot, true);
            this.resetScrollView(this.itemScrollRoot);
        }
    }

    onClickTab(_a: unknown, b: string) {
        const next = Number(b);
        if (!Number.isFinite(next) || this.showType === next) {
            return;
        }
        this.showType = next;
        this.refrehsTab();
    }

    private buildBasicSeedsRows(): GranaryListRow[] {
        const rawSeedsCfg = AppConst.JSONManager?.getItemAll?.('basicSeeds') as Record<string, any> | null;
        const rawItemCfg = AppConst.JSONManager?.getItemAll?.('item') as Record<string, any> | null;
        if (!rawSeedsCfg || !rawItemCfg) {
            return [];
        }
        return Object.keys(rawSeedsCfg)
            .map((seedKey) => {
                const seed = rawSeedsCfg[seedKey] || {};
                const configKey = Number(seedKey);
                const itemId = Number(seed.item_id);
                return { configKey, itemId, seed, item: rawItemCfg[String(itemId)] };
            })
            .filter((row) => Number.isFinite(row.configKey) && Number.isFinite(row.itemId) && row.itemId > 0)
            .filter((row) => row.item != null)
            .filter((row) => row.seed.base_seed_price != null && row.seed.base_seed_price !== '')
            .sort((a, b) => {
                const categoryDiff = Number(a.seed.category) - Number(b.seed.category);
                if (categoryDiff !== 0) {
                    return categoryDiff;
                }
                return a.configKey - b.configKey;
            })
            .map((row) => ({ configKey: row.configKey, itemId: row.itemId }));
    }

    private buildBasicCropsRows(): GranaryListRow[] {
        const rawCropsCfg = AppConst.JSONManager?.getItemAll?.('basicCrops') as Record<string, any> | null;
        if (!rawCropsCfg) {
            return [];
        }
        return Object.keys(rawCropsCfg)
            .map((cropKey) => {
                const crop = rawCropsCfg[cropKey] || {};
                return {
                    configKey: Number(cropKey),
                    itemId: Number(crop.item_id),
                };
            })
            .filter((row) => Number.isFinite(row.configKey) && Number.isFinite(row.itemId) && row.itemId > 0)
            .sort((a, b) => a.configKey - b.configKey);
    }

    private syncListCells(
        content: Node | null,
        template: Node | null,
        pool: Node[],
        rows: GranaryListRow[],
        cellType: number
    ) {
        if (!content?.isValid || !template?.isValid) {
            return;
        }
        template.active = false;
        const targetCount = rows.length;

        while (pool.length > targetCount) {
            const node = pool.pop();
            node?.destroy();
        }

        while (pool.length < targetCount) {
            const node = instantiate(template);
            node.active = true;
            node.setParent(content);
            pool.push(node);
        }

        for (let i = 0; i < pool.length; i++) {
            const node = pool[i];
            const row = rows[i];
            if (!node?.isValid) {
                continue;
            }
            if (!row) {
                node.active = false;
                continue;
            }
            node.active = true;
            node.name = `granary_${cellType}_${row.configKey}`;
            const cell = node.getComponent(GranaryItemCell);
            cell?.refreshNode(cellType, row.configKey);
        }
    }

    private clearListCells(content: Node | null, template: Node | null, pool: Node[]) {
        for (let i = 0; i < pool.length; i++) {
            pool[i]?.destroy();
        }
        pool.length = 0;

        if (!content?.isValid || !template?.isValid) {
            return;
        }
        const children = [...content.children];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child !== template && child.isValid) {
                child.destroy();
            }
        }
        template.active = false;
    }

    private applyListLayout(content: Node | null) {
        if (!content?.isValid) {
            return;
        }
        const layout = content.getComponent(Layout);
        if (layout) {
            layout.updateLayout();
        }
    }

    private resetScrollView(scrollRoot: Node | null) {
        if (!scrollRoot?.isValid) {
            return;
        }
        const scroll = scrollRoot.getComponent(ScrollView);
        if (!scroll?.isValid || !scroll.content?.isValid) {
            return;
        }
        scroll.stopAutoScroll();
        scroll.scrollToOffset({ x: 0, y: 0 }, 0);
    }
}
