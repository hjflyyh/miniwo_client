import { AppConst } from '../../AppConst';

export type DisplayableSeedRow = {
    seedKey: number;
    itemId: number;
    seed: Record<string, any>;
    item: Record<string, any>;
};

export type DisplayableCropRow = {
    configKey: number;
    itemId: number;
};

function hasNonEmptyConfigIcon(value: unknown): boolean {
    return value != null && String(value).trim() !== '';
}

/** 作物是否满足 Granary / 种子联动展示条件 */
export function isBasicCropDisplayable(
    cropKey: string,
    crop: Record<string, any>,
    rawSeedsCfg: Record<string, any>,
    rawItemCfg: Record<string, any>,
): boolean {
    const configKey = Number(cropKey);
    const itemId = Number(crop?.item_id);
    if (!Number.isFinite(configKey) || !Number.isFinite(itemId) || itemId <= 0) {
        return false;
    }
    const seedKey = String(crop?.correspondence_relation ?? '').trim();
    if (!seedKey || !rawSeedsCfg[seedKey]) {
        return false;
    }
    return rawItemCfg[String(itemId)] != null;
}

/** 种子 → 关联作物；要求 correspondence_relation 双向一致 */
export function findLinkedCropForSeed(
    seedKey: string,
    seed: Record<string, any>,
    rawCropsCfg: Record<string, any> | null,
): { cropKey: string; crop: Record<string, any> } | null {
    const cropKey = String(seed?.correspondence_relation ?? '').trim();
    if (!cropKey || !rawCropsCfg?.[cropKey]) {
        return null;
    }
    const crop = rawCropsCfg[cropKey];
    if (String(crop?.correspondence_relation ?? '').trim() !== String(seedKey)) {
        return null;
    }
    return { cropKey, crop };
}

/** 种子展示用 icon：优先 basicSeeds.icon，否则取关联 basicCrops.icon */
export function resolveSeedDisplayIcon(
    seed: Record<string, any>,
    rawCropsCfg: Record<string, any> | null,
): string {
    if (hasNonEmptyConfigIcon(seed?.icon)) {
        return String(seed.icon).trim();
    }
    const cropKey = String(seed?.correspondence_relation ?? '').trim();
    if (!cropKey || !rawCropsCfg?.[cropKey]) {
        return '';
    }
    const crop = rawCropsCfg[cropKey];
    return crop?.icon != null ? String(crop.icon).trim() : '';
}

/** 可展示的种子列表（Granary 种子页、空田播种列表共用） */
export function buildDisplayableBasicSeedRows(): DisplayableSeedRow[] {
    const rawSeedsCfg = AppConst.JSONManager?.getItemAll?.('basicSeeds') as Record<string, any> | null;
    const rawCropsCfg = AppConst.JSONManager?.getItemAll?.('basicCrops') as Record<string, any> | null;
    const rawItemCfg = AppConst.JSONManager?.getItemAll?.('item') as Record<string, any> | null;
    if (!rawSeedsCfg || !rawCropsCfg || !rawItemCfg) {
        return [];
    }

    return Object.keys(rawSeedsCfg)
        .map((seedKey) => {
            const seed = rawSeedsCfg[seedKey] || {};
            const seedKeyNum = Number(seedKey);
            const itemId = Number(seed.item_id);
            const linkedCrop = findLinkedCropForSeed(seedKey, seed, rawCropsCfg);
            return {
                seedKey: seedKeyNum,
                itemId,
                seed,
                item: rawItemCfg[String(itemId)],
                linkedCrop,
            };
        })
        .filter((row) => Number.isFinite(row.seedKey) && Number.isFinite(row.itemId) && row.itemId > 0)
        .filter((row) => row.item != null)
        .filter((row) => row.seed.base_seed_price != null && row.seed.base_seed_price !== '')
        .filter((row) => row.linkedCrop != null)
        .filter((row) =>
            isBasicCropDisplayable(
                row.linkedCrop.cropKey,
                row.linkedCrop.crop,
                rawSeedsCfg,
                rawItemCfg,
            ),
        )
        .filter((row) => hasNonEmptyConfigIcon(resolveSeedDisplayIcon(row.seed, rawCropsCfg)))
        .sort((a, b) => {
            const categoryDiff = Number(a.seed.category) - Number(b.seed.category);
            if (categoryDiff !== 0) {
                return categoryDiff;
            }
            return a.seedKey - b.seedKey;
        })
        .map((row) => ({
            seedKey: row.seedKey,
            itemId: row.itemId,
            seed: row.seed,
            item: row.item,
        }));
}

/** 可展示的作物列表（Granary 作物 / 储藏页） */
export function buildDisplayableBasicCropRows(): DisplayableCropRow[] {
    const rawCropsCfg = AppConst.JSONManager?.getItemAll?.('basicCrops') as Record<string, any> | null;
    const rawSeedsCfg = AppConst.JSONManager?.getItemAll?.('basicSeeds') as Record<string, any> | null;
    const rawItemCfg = AppConst.JSONManager?.getItemAll?.('item') as Record<string, any> | null;
    if (!rawCropsCfg || !rawSeedsCfg || !rawItemCfg) {
        return [];
    }

    return Object.keys(rawCropsCfg)
        .map((cropKey) => {
            const crop = rawCropsCfg[cropKey] || {};
            return {
                configKey: Number(cropKey),
                itemId: Number(crop.item_id),
                crop,
                cropKey,
            };
        })
        .filter((row) => isBasicCropDisplayable(row.cropKey, row.crop, rawSeedsCfg, rawItemCfg))
        .sort((a, b) => a.configKey - b.configKey)
        .map((row) => ({ configKey: row.configKey, itemId: row.itemId }));
}
