import { AppConst } from '../../AppConst';
import { nakamaRpcOrThrow } from '../../Utils/NakamaRpc';
import { network } from '../RequestData';
import {
    WORKSHOP_EVENT_UPDATED,
    WorkshopNpcSlot,
    WorkshopRpcResponse,
    WorkshopState,
} from './WorkshopTypes';

export class WorkshopModel {
    private static _instance: WorkshopModel | null = null;

    private state: WorkshopState | null = null;
    private loading = false;
    private clientNpcSlotsManaged = false;

    public static getInstance(): WorkshopModel {
        if (!this._instance) {
            this._instance = new WorkshopModel();
        }
        return this._instance;
    }

    public static resetInstance(): void {
        WorkshopModel._instance = null;
    }

    public init(): void {
        EventSystem.addListent('WebSocketNotifications', this.onWsNotification, this);
    }

    public getState(): WorkshopState | null {
        return this.state;
    }

    public isLoading(): boolean {
        return this.loading;
    }

    public async fetchInfo(): Promise<WorkshopState | null> {
        const res = await this.callRpc('workshop_info', {});
        return res?.workshop ?? this.state;
    }

    public async build(): Promise<WorkshopState | null> {
        const res = await this.callRpc('workshop_build', {});
        return res?.workshop ?? this.state;
    }

    public async upgrade(): Promise<WorkshopState | null> {
        const res = await this.callRpc('workshop_upgrade', {});
        return res?.workshop ?? this.state;
    }

    public async chooseBranch(branch: number): Promise<WorkshopState | null> {
        const res = await this.callRpc('workshop_choose_branch', { branch });
        return res?.workshop ?? this.state;
    }

    public async changeBranch(branch: number): Promise<WorkshopState | null> {
        const res = await this.callRpc('workshop_change_branch', { branch });
        return res?.workshop ?? this.state;
    }

    public assignNpc(slotIndex: number, npcId: number): WorkshopState | null {
        const safeSlotIndex = Math.floor(Number(slotIndex));
        const safeNpcId = Math.floor(Number(npcId));
        if (!Number.isFinite(safeSlotIndex) || safeSlotIndex < 0 || !Number.isFinite(safeNpcId) || safeNpcId <= 0) {
            EventSystem.send('ShowTips', 'invalid slot index');
            return null;
        }

        const baseState: WorkshopState = { ...(this.state ?? {}) };
        const filledCount = this.getOrderedNpcSlots(baseState.npc_slots ?? []).length;
        if (safeSlotIndex !== filledCount) {
            EventSystem.send('ShowTips', 'Please fill the previous NPC slot first.');
            return null;
        }

        const nextSlots = (baseState.npc_slots ?? []).filter(
            (slot) =>
                Math.floor(Number(slot.slot_index)) !== safeSlotIndex &&
                Math.floor(Number(slot.npc_id)) !== safeNpcId,
        );
        nextSlots.push({
            slot_index: safeSlotIndex,
            npc_id: safeNpcId,
        });
        nextSlots.sort((a, b) => a.slot_index - b.slot_index);

        this.clientNpcSlotsManaged = true;
        this.state = {
            ...baseState,
            npc_slots: nextSlots,
        };
        EventSystem.send(WORKSHOP_EVENT_UPDATED, this.state);
        return this.state;
    }

    public unassignNpc(slotIndex: number): WorkshopState | null {
        const safeSlotIndex = Math.floor(Number(slotIndex));
        if (!Number.isFinite(safeSlotIndex) || safeSlotIndex < 0) {
            EventSystem.send('ShowTips', 'invalid slot index');
            return null;
        }

        const baseState: WorkshopState = { ...(this.state ?? {}) };
        const orderedSlots = this.getOrderedNpcSlots(baseState.npc_slots ?? []);
        if (safeSlotIndex >= orderedSlots.length) {
            return this.state;
        }

        orderedSlots.splice(safeSlotIndex, 1);
        const nextSlots = this.compactNpcSlots(orderedSlots);

        this.clientNpcSlotsManaged = true;
        this.state = {
            ...baseState,
            npc_slots: nextSlots,
        };
        EventSystem.send(WORKSHOP_EVENT_UPDATED, this.state);
        return this.state;
    }

    public async startCraft(recipeId: number, npcIds?: number[]): Promise<WorkshopState | null> {
        const safeRecipeId = Math.floor(Number(recipeId));
        if (!Number.isFinite(safeRecipeId) || safeRecipeId <= 0) {
            return null;
        }
        const safeNpcIds = (npcIds ?? this.getAssignedNpcIds())
            .map((id) => Math.floor(Number(id)))
            .filter((id) => id > 0);
        const res = await this.callRpc('workshop_start_craft', {
            recipe_id: safeRecipeId,
            npc_ids: safeNpcIds,
        });
        return res?.workshop ?? this.state;
    }

    public async resolveCraftResult(jobId: number): Promise<WorkshopRpcResponse | null> {
        return this.callRpc('workshop_craft_result', { job_id: jobId });
    }

    public async collect(jobId: number): Promise<WorkshopRpcResponse | null> {
        return this.callRpc('workshop_collect', { job_id: jobId });
    }

    public async cancel(jobId: number): Promise<WorkshopState | null> {
        const res = await this.callRpc('workshop_cancel', { job_id: jobId });
        return res?.workshop ?? this.state;
    }

    public applyWorkshopState(next: WorkshopState | null | undefined, keepRecipes = true): void {
        if (!next) {
            return;
        }
        const merged: WorkshopState = {
            ...(this.state ?? {}),
            ...next,
        };
        if (keepRecipes && (!next.recipes || next.recipes.length === 0) && this.state?.recipes?.length) {
            merged.recipes = this.state.recipes;
        }
        if (this.clientNpcSlotsManaged && this.state?.npc_slots) {
            merged.npc_slots = this.cloneNpcSlots(this.state.npc_slots);
        }
        this.state = merged;
        EventSystem.send(WORKSHOP_EVENT_UPDATED, this.state);
    }

    private getAssignedNpcIds(): number[] {
        return this.getOrderedNpcSlots(this.state?.npc_slots ?? []).map((slot) => slot.npc_id);
    }

    private cloneNpcSlots(slots: WorkshopNpcSlot[]): WorkshopNpcSlot[] {
        return slots.map((slot) => ({
            slot_index: Math.floor(Number(slot.slot_index)),
            npc_id: Math.floor(Number(slot.npc_id)),
        }));
    }

    private getOrderedNpcSlots(slots: WorkshopNpcSlot[]): WorkshopNpcSlot[] {
        return this.cloneNpcSlots(slots)
            .filter((slot) => slot.npc_id > 0)
            .sort((a, b) => a.slot_index - b.slot_index);
    }

    private compactNpcSlots(slots: WorkshopNpcSlot[]): WorkshopNpcSlot[] {
        return slots.map((slot, index) => ({
            slot_index: index,
            npc_id: slot.npc_id,
        }));
    }

    private async callRpc(
        id: string,
        payload: Record<string, unknown>,
    ): Promise<WorkshopRpcResponse | null> {
        if (this.loading) {
            return null;
        }
        this.loading = true;
        try {
            console.log(`[WorkshopModel] request ${id}`, payload);
            const res = await nakamaRpcOrThrow<WorkshopRpcResponse>(id, payload);
            console.log(`[WorkshopModel] response ${id}`, res);
            if (res?.workshop) {
                this.applyWorkshopState(res.workshop);
            } else if (res?.success !== false) {
                EventSystem.send(WORKSHOP_EVENT_UPDATED, this.state);
            }
            return res;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            EventSystem.send('ShowTips', message);
            console.warn(`[WorkshopModel] ${id} failed`, error);
            return null;
        } finally {
            this.loading = false;
        }
    }

    private onWsNotification = (data: { code?: number; content?: string }) => {
        if (data?.code === network.ServerCode.CodeWorkshop) {
            this.handleWorkshopPush(data.content);
        }
    };

    private handleWorkshopPush(content: string | undefined): void {
        if (!content) {
            return;
        }
        try {
            const parsed = JSON.parse(content) as { workshop?: WorkshopState };
            console.log('[WorkshopModel] push CodeWorkshop', parsed);
            if (parsed?.workshop) {
                this.applyWorkshopState(parsed.workshop);
            }
        } catch (error) {
            console.warn('[WorkshopModel] invalid workshop push', error);
        }
    }
}
