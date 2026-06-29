import { _decorator, Component, Label, Node, ProgressBar, resources, Sprite, SpriteFrame } from 'cc';
import { AppConst } from '../../AppConst';
import { BagModel } from '../../Model/BagModel';
import { UGCModel } from '../../Model/UGCModel';
import { WorkshopModel } from '../../Model/Workshop/WorkshopModel';
import {
    getWorkshopCategoryId,
    getWorkshopJob,
    getWorkshopRecipeMaterials,
    WORKSHOP_EVENT_UPDATED,
    WorkshopJob,
    WorkshopRecipe,
} from '../../Model/Workshop/WorkshopTypes';
import { BaseView } from '../BaseView';
import { GongfangNpc } from './GongfangNpc';
import { GongfangTuzhiItem } from './GongfangTuzhiItem';
import { GongfangBlueprint } from './GongfangBlueprint';
import { GongfangNpcView } from './GongfangNpcView';
const { ccclass, property } = _decorator;

@ccclass('GongfangView')
export class GongfangView extends Component {
    @property(Sprite)
    chooseTuzhiSp: Sprite = null;

    @property([Node])
    tabChooseNode: Node[] = [];

    @property(Node)
    workNode: Node = null;

    @property(ProgressBar)
    workProgress: ProgressBar = null;

    @property(Label)
    workTimeLabel: Label = null;

    @property(Label)
    attribute1: Label = null;

    @property(Label)
    attribute2: Label = null;

    @property(Label)
    info: Label = null;

    @property([GongfangTuzhiItem])
    tuzhiItems: GongfangTuzhiItem[] = [];

    @property([GongfangNpc])
    npcs: GongfangNpc[] = [];

    @property(GongfangBlueprint)
    Blueprint : GongfangBlueprint

    @property(GongfangNpcView)
    gongfangNpcView : GongfangNpcView

    chooseTabIndex = 0;

    private selectedRecipeByCategory = new Map<number, number>();
    private jobTotalSecMap = new Map<number, number>();
    private resolvingJobIds = new Set<number>();
    private tickAcc = 0;

    private readonly onNpcDeleteHandler = (slotIndex: number) => {
        this.onNpcDelete(slotIndex);
    };

    private readonly onNpcSelectHandler = (slotIndex: number, _unlocked: boolean) => {
        this.onNpcSelect(slotIndex);
    };

    start() {
        this.bindNpcHandlers();

        if (this.Blueprint?.node) {
            this.Blueprint.node.active = false;
            this.Blueprint.bindOnConfirm(this.onBlueprintConfirm.bind(this));
        }

        if (this.gongfangNpcView?.node) {
            this.gongfangNpcView.node.active = false;
        }

        EventSystem.addListent(WORKSHOP_EVENT_UPDATED, this.refreshView, this);
        EventSystem.addListent('BagUpdate', this.onBagUpdate, this);
        EventSystem.addListent('OnRefreshMyNpcList', this.refreshNpcs, this);

        UGCModel.getInstance().listGeneratedNpcs();
        void this.loadWorkshop();
    }

    onDestroy() {
        EventSystem.remove(this);
    }

    update(dt: number) {
        this.tickAcc += dt;
        if (this.tickAcc < 1) {
            return;
        }
        this.tickAcc = 0;
        this.tickJobs();
    }

    onClickClose() {
        this.getComponent(BaseView)?.onClickClose();
    }

    onClickTab(_event: unknown, tabIndex: string) {
        const next = Number(tabIndex);
        if (!Number.isFinite(next) || next === this.chooseTabIndex) {
            return;
        }
        this.chooseTabIndex = next;
        this.refreshView();
    }

    onClickCanel() {
        const job = this.getCurrentJob();
        if (!job || Number(job.status) !== 0) {
            EventSystem.send('ShowTips', '当前无法取消');
            return;
        }
        void WorkshopModel.getInstance().cancel(job.job_id);
    }

    onClickReward() {
        const job = this.getCurrentJob();
        if (!job) {
            return;
        }
        void this.handleCollect(job);
    }

    onClickTuzhi() {
        if (!this.Blueprint?.node) {
            return;
        }
        const categoryId = this.getCurrentCategoryId();
        const selectedId = this.selectedRecipeByCategory.get(categoryId) ?? 0;
        this.Blueprint.show(categoryId, selectedId);
    }

    private onBlueprintConfirm(recipeId: number) {
        const categoryId = this.getCurrentCategoryId();
        this.selectedRecipeByCategory.set(categoryId, recipeId);
        this.refreshRecipePanel();
        this.refreshMaterials();
    }

    private onBagUpdate = () => {
        this.refreshMaterials();
        if (this.Blueprint?.node?.active) {
            this.Blueprint.refresh();
        }
        if (this.gongfangNpcView?.node?.active) {
            this.gongfangNpcView.refresh();
        }
    };

    onClickStart() {
        const recipe = this.getSelectedRecipe();
        if (!recipe) {
            EventSystem.send('ShowTips', 'Please select the drawing first.');
            return;
        }
        if (recipe.locked) {
            EventSystem.send('ShowTips', recipe.lock_reason || '图纸未解锁');
            return;
        }
        const state = WorkshopModel.getInstance().getState();
        if (!state?.level || state.level <= 0) {
            EventSystem.send('ShowTips', 'Please build the workshop first.');
            return;
        }
        if (!this.hasEnoughMaterials(recipe)) {
            return;
        }
        void WorkshopModel.getInstance().startCraft(recipe.recipe_id, this.getSelectedNpcIds());
    }

    private hasEnoughMaterials(recipe: WorkshopRecipe): boolean {
        const materials = getWorkshopRecipeMaterials(recipe);
        for (let i = 0; i < materials.length; i++) {
            const material = materials[i];
            const itemId = Number(material.item_id);
            const needCount = Math.max(0, Number(material.count ?? 0));
            const ownedCount = BagModel.getInstance().getItemCount(itemId);
            if (ownedCount < needCount) {
                const itemName = this.getItemDisplayName(itemId);
                EventSystem.send('ShowTips', `${itemName} is insufficient, Needs: ${needCount}`);
                return false;
            }
        }
        return true;
    }

    private getItemDisplayName(itemId: number): string {
        const cfg = AppConst.JSONManager.getItem('item', `${itemId}`);
        return cfg?.name_en || cfg?.name_cn || 'item';
    }

    private getSelectedNpcIds(): number[] {
        const state = WorkshopModel.getInstance().getState();
        return (state?.npc_slots ?? [])
            .map((slot) => ({
                slot_index: Math.floor(Number(slot.slot_index)),
                npc_id: Math.floor(Number(slot.npc_id)),
            }))
            .filter((slot) => slot.npc_id > 0)
            .sort((a, b) => a.slot_index - b.slot_index)
            .map((slot) => slot.npc_id);
    }

    private async loadWorkshop() {
        await WorkshopModel.getInstance().fetchInfo();
        this.refreshView();
    }

    private refreshView = () => {
        this.refreshTabs();
        this.ensureSelectedRecipe();
        this.refreshRecipePanel();
        this.refreshMaterials();
        this.refreshNpcs();
        this.refreshWorkNode();
        if (this.Blueprint?.node?.active) {
            const categoryId = this.getCurrentCategoryId();
            const selectedId = this.selectedRecipeByCategory.get(categoryId) ?? 0;
            this.Blueprint.refresh(categoryId, selectedId);
        }
    };

    private refreshTabs() {
        for (let i = 0; i < this.tabChooseNode.length; i++) {
            if (this.tabChooseNode[i]) {
                this.tabChooseNode[i].active = i === this.chooseTabIndex;
            }
        }
    }

    private getCurrentCategoryId(): number {
        return getWorkshopCategoryId(this.chooseTabIndex);
    }

    private getCategoryRecipes(): WorkshopRecipe[] {
        const state = WorkshopModel.getInstance().getState();
        const categoryId = this.getCurrentCategoryId();
        return (state?.recipes ?? []).filter((recipe) => Number(recipe.category) === categoryId);
    }

    private ensureSelectedRecipe() {
        const categoryId = this.getCurrentCategoryId();
        const currentId = this.selectedRecipeByCategory.get(categoryId) ?? 0;
        if (!currentId) {
            return;
        }
        const stillValid = this.getCategoryRecipes().some((recipe) => recipe.recipe_id === currentId);
        if (!stillValid) {
            this.selectedRecipeByCategory.delete(categoryId);
        }
    }

    private getSelectedRecipe(): WorkshopRecipe | null {
        const categoryId = this.getCurrentCategoryId();
        const recipeId = this.selectedRecipeByCategory.get(categoryId);
        if (!recipeId) {
            return null;
        }
        return this.getCategoryRecipes().find((recipe) => recipe.recipe_id === recipeId) ?? null;
    }

    private refreshRecipePanel() {
        const recipe = this.getSelectedRecipe();
        if (!recipe) {
            if (this.chooseTuzhiSp?.node) {
                this.chooseTuzhiSp.node.active = false;
            }
            if (this.attribute1) {
                this.attribute1.string = '';
            }
            if (this.attribute2) {
                this.attribute2.string = '';
            }
            if (this.info) {
                this.info.string = '请选择图纸';
            }
            for (let i = 0; i < this.tuzhiItems.length; i++) {
                this.tuzhiItems[i]?.refreshEmpty();
            }
            return;
        }

        if (this.chooseTuzhiSp?.node) {
            this.chooseTuzhiSp.node.active = true;
        }
        this.loadItemIcon(this.chooseTuzhiSp, Number(recipe.output_item_id));

        const successRate = Number(recipe.success_rate ?? 0);
        const successText = successRate > 0 ? `${(successRate / 100).toFixed(1)}%` : '--';
        if (this.attribute1) {
            this.attribute1.string = `成功率 ${successText}`;
        }
        if (this.attribute2) {
            this.attribute2.string = `耗时 ${Math.max(0, Number(recipe.craft_time_sec ?? 0))}秒`;
        }
        if (this.info) {
            const blueprintCount = Math.max(0, Number(recipe.count ?? 0));
            const lockText = recipe.locked ? ` (${recipe.lock_reason || '未解锁'})` : '';
            this.info.string = `${recipe.name_cn || recipe.recipe_id}  图纸x${blueprintCount}${lockText}`;
        }
    }

    private refreshMaterials = () => {
        const recipe = this.getSelectedRecipe();
        const materials = getWorkshopRecipeMaterials(recipe);
        for (let i = 0; i < this.tuzhiItems.length; i++) {
            const cell = this.tuzhiItems[i];
            if (!cell) {
                continue;
            }
            const material = materials[i];
            if (!material) {
                cell.refreshEmpty();
                continue;
            }
            const itemId = Number(material.item_id);
            const needCount = Math.max(0, Number(material.count ?? 0));
            const ownedCount = BagModel.getInstance().getItemCount(itemId);
            cell.refreshMaterial(itemId, needCount, ownedCount);
        }
    };

    private refreshNpcs = () => {
        const state = WorkshopModel.getInstance().getState();
        const orderedSlots = (state?.npc_slots ?? [])
            .map((slot) => ({
                slot_index: Math.floor(Number(slot.slot_index)),
                npc_id: Math.floor(Number(slot.npc_id)),
            }))
            .filter((slot) => slot.npc_id > 0)
            .sort((a, b) => a.slot_index - b.slot_index);

        for (let i = 0; i < this.npcs.length; i++) {
            const cell = this.npcs[i];
            if (!cell) {
                continue;
            }
            cell.bindHandlers(i, this.onNpcDeleteHandler, this.onNpcSelectHandler);
            cell.node.active = true;
            const npcId = Math.floor(Number(orderedSlots[i]?.npc_id ?? 0));
            if (npcId > 0) {
                cell.refreshNpc(this.findNpcData(npcId));
                continue;
            }
            cell.refreshEmptySlot(i === orderedSlots.length);
        }
    };

    private getFilledNpcSlotCount(): number {
        const state = WorkshopModel.getInstance().getState();
        return (state?.npc_slots ?? []).filter(
            (slot) => Math.floor(Number(slot.npc_id)) > 0,
        ).length;
    }

    private canSelectNpcSlot(slotIndex: number): boolean {
        const safeIndex = Math.floor(Number(slotIndex));
        return Number.isFinite(safeIndex) && safeIndex >= 0 && safeIndex === this.getFilledNpcSlotCount();
    }

    private bindNpcHandlers() {
        for (let i = 0; i < this.npcs.length; i++) {
            this.npcs[i]?.bindHandlers(i, this.onNpcDeleteHandler, this.onNpcSelectHandler);
        }
    }

    private refreshWorkNode() {
        const job = this.getCurrentJob();
        const active = !!job;
        if (this.workNode) {
            this.workNode.active = active;
        }
        if (!job) {
            return;
        }

        if (!this.jobTotalSecMap.has(job.job_id)) {
            const recipe = this.findRecipe(Number(job.recipe_id));
            const total = Math.max(
                Number(job.remain_sec ?? 0),
                Number(recipe?.craft_time_sec ?? 1),
                1,
            );
            this.jobTotalSecMap.set(job.job_id, total);
        }

        const totalSec = this.jobTotalSecMap.get(job.job_id) ?? 1;
        const remainSec = Math.max(0, Number(job.remain_sec ?? 0));
        if (this.workProgress) {
            this.workProgress.progress = totalSec > 0 ? 1 - remainSec / totalSec : 1;
        }
        if (this.workTimeLabel) {
            if (job.craft_success != null && remainSec <= 0) {
                this.workTimeLabel.string = Number(job.craft_success) === 1 ? '制作成功' : '制作失败';
            } else {
                this.workTimeLabel.string = this.formatRemainTime(remainSec);
            }
        }
    }

    private tickJobs() {
        const state = WorkshopModel.getInstance().getState();
        if (!state?.jobs_by_category) {
            return;
        }

        let changed = false;
        const jobs = state.jobs_by_category;
        for (const key of Object.keys(jobs)) {
            const job = jobs[key];
            if (!job || Number(job.remain_sec ?? 0) <= 0) {
                continue;
            }
            job.remain_sec = Math.max(0, Number(job.remain_sec) - 1);
            changed = true;
            if (job.remain_sec === 0) {
                void this.autoResolveCraftResult(job);
            }
        }

        if (changed) {
            this.refreshWorkNode();
        }
    }

    private async autoResolveCraftResult(job: WorkshopJob) {
        if (this.resolvingJobIds.has(job.job_id) || job.craft_success != null) {
            return;
        }
        this.resolvingJobIds.add(job.job_id);
        try {
            await WorkshopModel.getInstance().resolveCraftResult(job.job_id);
        } finally {
            this.resolvingJobIds.delete(job.job_id);
        }
    }

    private async handleCollect(job: WorkshopJob) {
        if (job.craft_success == null && Number(job.remain_sec ?? 0) <= 0) {
            await WorkshopModel.getInstance().resolveCraftResult(job.job_id);
        }
        const latest = this.getCurrentJob();
        if (!latest || latest.craft_success == null) {
            EventSystem.send('ShowTips', '制作结果尚未判定');
            return;
        }
        await WorkshopModel.getInstance().collect(job.job_id);
        this.jobTotalSecMap.delete(job.job_id);
    }

    private getCurrentJob(): WorkshopJob | null {
        return getWorkshopJob(WorkshopModel.getInstance().getState(), this.getCurrentCategoryId());
    }

    private findRecipe(recipeId: number): WorkshopRecipe | null {
        const recipes = WorkshopModel.getInstance().getState()?.recipes ?? [];
        return recipes.find((recipe) => Number(recipe.recipe_id) === recipeId) ?? null;
    }

    private findNpcData(npcId: number): Record<string, unknown> | null {
        const list = UGCModel.getInstance().myNpcList ?? [];
        for (let i = 0; i < list.length; i++) {
            const npc = list[i];
            const id = Number(npc?.id ?? npc?.npc_id ?? 0);
            if (id === npcId) {
                return npc as Record<string, unknown>;
            }
        }
        return { npc_id: npcId, id: npcId };
    }

    private onNpcDelete(slotIndex: number) {
        WorkshopModel.getInstance().unassignNpc(slotIndex);
    }

    private onNpcSelect(slotIndex: number) {
        const safeIndex = Math.floor(Number(slotIndex));
        if (!Number.isFinite(safeIndex) || safeIndex < 0) {
            return;
        }
        if (!this.canSelectNpcSlot(safeIndex)) {
            EventSystem.send('ShowTips', 'Please fill the previous NPC slot first.');
            return;
        }
        this.gongfangNpcView?.show(safeIndex);
    }

    private formatRemainTime(sec: number): string {
        const remain = Math.max(0, Math.ceil(sec));
        const minute = Math.floor(remain / 60);
        const second = remain % 60;
        return `${minute}:${String(second).padStart(2, '0')}`;
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
