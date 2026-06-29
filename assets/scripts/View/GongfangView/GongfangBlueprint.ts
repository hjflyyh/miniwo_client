import { _decorator, Color, Component, instantiate, Label, Layout, Node, resources, Sprite, SpriteFrame, UITransform } from 'cc';
import { AppConst } from '../../AppConst';
import { BagModel } from '../../Model/BagModel';
import { WorkshopModel } from '../../Model/Workshop/WorkshopModel';
import {
    getWorkshopRecipeMaterials,
    isSameWorkshopRecipeId,
    WORKSHOP_EVENT_UPDATED,
    WorkshopMaterial,
    WorkshopRecipe,
} from '../../Model/Workshop/WorkshopTypes';
const { ccclass, property } = _decorator;

@ccclass('GongfangBlueprint')
export class GongfangBlueprint extends Component {
    @property(Node)
    tuzhiCell: Node = null;

    @property(Node)
    needItemCell: Node = null;

    private categoryId = 1;
    private previewRecipeId = 0;
    private recipes: WorkshopRecipe[] = [];
    private readonly recipeCells: Node[] = [];
    private readonly materialCells: Node[] = [];
    private onConfirm: ((recipeId: number) => void) | null = null;

    onLoad() {
        this.resolveRefs();
        if (this.tuzhiCell?.isValid) {
            this.tuzhiCell.active = false;
        }
        if (this.needItemCell?.isValid) {
            this.needItemCell.active = false;
        }


        EventSystem.addListent(WORKSHOP_EVENT_UPDATED, this.onWorkshopUpdated, this);
    }

    onEnable() {
        this.scheduleRefresh();
    }

    onDisable() {
        // EventSystem.removeListent(WORKSHOP_EVENT_UPDATED, this.onWorkshopUpdated, this);
        this.unschedule(this.doRefresh);
    }

    public bindOnConfirm(handler: (recipeId: number) => void) {
        this.onConfirm = handler;
    }

    public show(categoryId: number, selectedRecipeId = 0) {
        this.resolveRefs();
        this.categoryId = categoryId;
        this.previewRecipeId = selectedRecipeId;
        if (this.node.active) {
            this.scheduleRefresh();
            return;
        }
        this.node.active = true;
    }

    public hide() {
        this.node.active = false;
    }

    public refresh(categoryId?: number, selectedRecipeId?: number) {
        if (categoryId != null) {
            this.categoryId = categoryId;
        }
        if (selectedRecipeId != null) {
            this.previewRecipeId = selectedRecipeId;
        }
        this.scheduleRefresh();
    }

    private onWorkshopUpdated = () => {
        if (this.node?.active) {
            this.scheduleRefresh();
        }
    };

    private scheduleRefresh() {
        this.unschedule(this.doRefresh);
        this.scheduleOnce(this.doRefresh, 0);
    }

    private doRefresh = () => {
        if (!this.node?.active) {
            return;
        }
        void this.refreshAfterReady();
    };

    private async refreshAfterReady() {
        await this.ensureRecipesLoaded();
        if (!this.node?.active) {
            return;
        }
        this.resolveRefs();
        this.applyRefresh();
        this.updateScrollLayouts();
    }

    private async ensureRecipesLoaded() {
        const state = WorkshopModel.getInstance().getState();
        if (state?.recipes?.length) {
            return;
        }
        const model = WorkshopModel.getInstance();
        if (model.isLoading()) {
            await new Promise<void>((resolve) => {
                const handler = () => {
                    EventSystem.removeListent(WORKSHOP_EVENT_UPDATED, handler, this);
                    resolve();
                };
                EventSystem.addListent(WORKSHOP_EVENT_UPDATED, handler, this);
            });
            return;
        }
        await model.fetchInfo();
    }

    private applyRefresh() {
        const state = WorkshopModel.getInstance().getState();
        this.recipes = (state?.recipes ?? []).filter(
            (recipe) => Number(recipe.category) === this.categoryId,
        );

        if (
            this.previewRecipeId > 0 &&
            !this.recipes.some((recipe) => isSameWorkshopRecipeId(recipe.recipe_id, this.previewRecipeId))
        ) {
            this.previewRecipeId = 0;
        }

        this.refreshRecipeList();
        this.refreshMaterialList();
    }

    private updateScrollLayouts() {
        for (const path of ['ScrollView', 'ScrollView-001']) {
            const content = this.node.getChildByPath(`${path}/view/content`);
            content?.getComponent(Layout)?.updateLayout();
        }
    }

    onClickClose() {
        this.hide();
    }

    onClickConfirm() {
        if (!this.previewRecipeId) {
            EventSystem.send('ShowTips', '请选择图纸');
            return;
        }
        const recipe = this.recipes.find((item) => isSameWorkshopRecipeId(item.recipe_id, this.previewRecipeId));
        if (recipe?.locked) {
            EventSystem.send('ShowTips', recipe.lock_reason || '图纸未解锁');
            return;
        }
        this.onConfirm?.(this.previewRecipeId);
        this.hide();
    }

    /** 兼容 prefab 点击事件 */
    onClickRecipeCell(_event: unknown, recipeIdStr: string) {
        this.onRecipeSelected(Number(recipeIdStr));
    }

    private resolveRefs() {
        if (!this.tuzhiCell?.isValid) {
            this.tuzhiCell = this.node.getChildByPath('ScrollView/view/content/cell');
        }
        if (!this.needItemCell?.isValid) {
            this.needItemCell = this.node.getChildByPath('ScrollView-001/view/content/Node-001');
        }
    }

    private refreshRecipeList() {
        if (!this.tuzhiCell?.isValid) {
            return;
        }

        const content = this.tuzhiCell.parent;
        if (!content?.isValid) {
            return;
        }

        this.tuzhiCell.active = false;
        this.clearCells(this.recipeCells);

        for (let i = 0; i < this.recipes.length; i++) {
            const recipe = this.recipes[i];
            const cell = instantiate(this.tuzhiCell);
            cell.active = true;
            cell.setParent(content);
            cell.name = `blueprint_recipe_${recipe.recipe_id}`;
            this.ensureCellTouchable(cell);
            this.bindRecipeCell(cell, recipe);
            this.recipeCells.push(cell);
        }

        const layout = content.getComponent(Layout);
        layout?.updateLayout();
    }

    private refreshMaterialList() {
        if (!this.needItemCell?.isValid) {
            return;
        }

        const content = this.needItemCell.parent;
        if (!content?.isValid) {
            return;
        }

        this.needItemCell.active = false;
        this.clearCells(this.materialCells);

        const recipe = this.recipes.find((item) => isSameWorkshopRecipeId(item.recipe_id, this.previewRecipeId));
        const materials = getWorkshopRecipeMaterials(recipe);
        for (let i = 0; i < materials.length; i++) {
            const cell = instantiate(this.needItemCell);
            cell.active = true;
            cell.setParent(content);
            cell.name = `blueprint_material_${materials[i].item_id}`;
            this.bindNeedItemCell(cell, materials[i]);
            this.materialCells.push(cell);
        }

        const layout = content.getComponent(Layout);
        layout?.updateLayout();
    }

    private bindRecipeCell(cell: Node, recipe: WorkshopRecipe) {
        const iconSprite =
            cell.getChildByName('icon')?.getComponent(Sprite) ??
            cell.getChildByPath('Sprite/icon')?.getComponent(Sprite) ??
            null;
        const numLabel =
            cell.getChildByName('num')?.getComponent(Label) ??
            null;
        const nameLabel = cell.getChildByName('name')?.getComponent(Label) ?? null;

        this.loadItemIcon(iconSprite, Number(recipe.output_item_id));
        if (numLabel) {
            numLabel.string = String(Math.max(0, Number(recipe.count ?? 0)));
        }
        if (nameLabel) {
            nameLabel.string = this.getRecipeDisplayName(recipe);
        }

        const selected = isSameWorkshopRecipeId(recipe.recipe_id, this.previewRecipeId);
        const bgSprite = cell.getChildByName('Sprite')?.getComponent(Sprite);
        if (bgSprite) {
            bgSprite.color = selected
                ? new Color(180, 220, 255, 255)
                : recipe.locked
                    ? new Color(180, 180, 180, 255)
                    : Color.WHITE;
        }
        if (iconSprite) {
            iconSprite.grayscale = !!recipe.locked;
        }

        cell.off(Node.EventType.TOUCH_END);
        cell.on(Node.EventType.TOUCH_END, () => {
            this.onRecipeSelected(recipe.recipe_id);
        }, this);
    }

    private onRecipeSelected(recipeId: number) {
        const recipe = this.recipes.find((item) => isSameWorkshopRecipeId(item.recipe_id, recipeId));
        if (!recipe) {
            return;
        }
        if (recipe.locked) {
            EventSystem.send('ShowTips', recipe.lock_reason || '图纸未解锁');
            return;
        }
        this.previewRecipeId = recipeId;
        this.scheduleRefresh();
    }

    private bindNeedItemCell(cell: Node, material: WorkshopMaterial) {
        const itemId = Number(material.item_id);
        const needCount = Math.max(0, Number(material.count ?? 0));
        const ownedCount = BagModel.getInstance().getItemCount(itemId);

        const iconSprite = cell.getChildByName('icon')?.getComponent(Sprite) ?? null;
        const numLabel = cell.getChildByName('num')?.getComponent(Label) ?? null;

        this.loadItemIcon(iconSprite, itemId);
        if (numLabel) {
            numLabel.string = `${ownedCount}/${needCount}`;
            numLabel.color = ownedCount >= needCount ? Color.BLACK : new Color(255, 80, 80, 255);
        }
    }

    private clearCells(cells: Node[]) {
        for (let i = 0; i < cells.length; i++) {
            cells[i]?.destroy();
        }
        cells.length = 0;
    }

    private ensureCellTouchable(cell: Node) {
        if (!cell.getComponent(UITransform)) {
            cell.addComponent(UITransform);
        }
    }

    private getRecipeDisplayName(recipe: WorkshopRecipe): string {
        if (recipe.name_en) {
            return recipe.name_en;
        }
        if (recipe.name_cn) {
            return recipe.name_cn;
        }
        const cfg = AppConst.JSONManager?.getItem?.('workshopRecipe', String(recipe.recipe_id)) as
            | { name_en?: string; name_cn?: string }
            | null;
        return cfg?.name_en || cfg?.name_cn || '';
    }

    private loadItemIcon(sprite: Sprite | null, itemId: number) {
        if (!sprite?.isValid || !Number.isFinite(itemId) || itemId <= 0) {
            return;
        }
        resources.load(`UITexture/itemIcon/${itemId}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (!err && sf && sprite?.isValid) {
                sprite.spriteFrame = sf;
                return;
            }
            resources.load(`common/image/item_${itemId}/spriteFrame`, SpriteFrame, (err2, sf2) => {
                if (!err2 && sf2 && sprite?.isValid) {
                    sprite.spriteFrame = sf2;
                }
            });
        });
    }
}
