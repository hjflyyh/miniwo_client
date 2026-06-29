import { AppConst } from '../../AppConst';

export const WORKSHOP_EVENT_UPDATED = 'WorkshopStateUpdated';

export type WorkshopMaterial = {
    item_id: number;
    count: number;
};

export type WorkshopRecipe = {
    recipe_id: number;
    recipe_type?: number;
    count: number;
    category: number;
    name_cn?: string;
    name_en?: string;
    output_item_id?: number;
    batch_output_count?: number;
    fail_output_item_id?: number;
    fail_batch_output_count?: number;
    materials?: WorkshopMaterial[];
    craft_time_sec?: number;
    npc_stamina_cost?: number;
    success_rate?: number;
    required_workshop_level?: number;
    required_branch?: number;
    allow_cancel?: boolean;
    locked?: boolean;
    lock_reason?: string;
    source?: string;
    info?: Record<string, unknown>;
    obtained_at?: number;
};

export type WorkshopJob = {
    job_id: number;
    recipe_id: number;
    status?: number;
    remain_sec?: number;
    output_multi?: number;
    final_output_count?: number;
    craft_success?: number;
    reward_item_id?: number;
    reward_count?: number;
    fail_output_item_id?: number;
    fail_output_count?: number;
    npc_ids?: number[];
    started_at?: number;
    finish_at?: number;
};

export type WorkshopNpcSlot = {
    slot_index: number;
    npc_id: number;
};

export type WorkshopCategory = {
    id: number;
    name_cn?: string;
    sort?: number;
    busy?: boolean;
};

export type WorkshopState = {
    player_id?: number;
    level?: number;
    branch?: number;
    map_level?: number;
    npc_slots?: WorkshopNpcSlot[];
    jobs_by_category?: Record<string, WorkshopJob | null>;
    recipes?: WorkshopRecipe[];
    categories?: WorkshopCategory[];
};

export type WorkshopRpcResponse = {
    success?: boolean;
    message?: string;
    workshop?: WorkshopState;
    job_id?: number;
    rewards?: WorkshopMaterial[];
};

export function getWorkshopCategoryId(tabIndex: number): number {
    return tabIndex + 1;
}

export function getWorkshopJob(
    state: WorkshopState | null | undefined,
    categoryId: number,
): WorkshopJob | null {
    const jobs = state?.jobs_by_category;
    if (!jobs) {
        return null;
    }
    const job = jobs[String(categoryId)] ?? jobs[categoryId as unknown as string];
    return job ?? null;
}

export function getWorkshopNpcSlotCount(level: number): number {
    const cfg = AppConst.JSONManager?.getItem?.('workshopLevel', String(level)) as
        | { npc_slot_count?: number }
        | null;
    return Math.max(0, Number(cfg?.npc_slot_count) || 0);
}

export function isSameWorkshopRecipeId(a: unknown, b: unknown): boolean {
    return Number(a) === Number(b) && Number(a) > 0;
}

export function parseWorkshopMaterialString(raw: string | undefined): WorkshopMaterial[] {
    if (!raw) {
        return [];
    }
    return raw
        .split('|')
        .map((part) => {
            const split = part.split('#');
            return {
                item_id: Math.floor(Number(split[0]) || 0),
                count: Math.floor(Number(split[1]) || 0),
            };
        })
        .filter((item) => item.item_id > 0 && item.count > 0);
}

export function getWorkshopRecipeMaterials(recipe: WorkshopRecipe | null | undefined): WorkshopMaterial[] {
    if (!recipe) {
        return [];
    }

    const raw = recipe.materials as unknown;
    if (Array.isArray(raw) && raw.length > 0) {
        return raw
            .map((item) => {
                const entry = item as Record<string, unknown>;
                return {
                    item_id: Math.floor(Number(entry.item_id ?? entry.itemId) || 0),
                    count: Math.floor(Number(entry.count) || 0),
                };
            })
            .filter((item) => item.item_id > 0 && item.count > 0);
    }

    const cfg = AppConst.JSONManager?.getItem?.('workshopRecipe', String(recipe.recipe_id)) as
        | { materials?: string }
        | null;
    return parseWorkshopMaterialString(cfg?.materials);
}
