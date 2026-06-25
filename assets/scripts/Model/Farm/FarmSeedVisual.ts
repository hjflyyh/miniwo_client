import { AppConst } from "../../AppConst";

export function getBasicCropsSprite(cropsId){
    const cfg = AppConst.JSONManager?.getItem?.('basicCrops', cropsId);
    const icon = cfg?.icon != null ? String(cfg.icon).trim() : '';
    if (!icon) {
        return null;
    }
    return `UITexture/${icon}_2/spriteFrame`;    
}

/** basicSeeds 配置 icon 对应成熟阶段贴图：icon + "_2" */
export function getBasicSeedMatureSpriteResourcePath(seedKey: string): string | null {
    const key = String(seedKey ?? '').trim();
    if (!key) {
        return null;
    }
    let seedCfg = AppConst.JSONManager?.getItem?.('basicSeeds', key);
    const cfg = AppConst.JSONManager?.getItem?.('basicCrops', seedCfg["correspondence_relation"]);
    const icon = cfg?.icon != null ? String(cfg.icon).trim() : '';
    if (!icon) {
        return null;
    }
    return `UITexture/${icon}_2/spriteFrame`;
}

export function getBasicSeedSpriteResourcePath(seedKey: string): string | null {
    const key = String(seedKey ?? '').trim();
    if (!key) {
        return null;
    }
    let seedCfg = AppConst.JSONManager?.getItem?.('basicSeeds', key);
    const cfg = AppConst.JSONManager?.getItem?.('basicCrops', seedCfg["correspondence_relation"]);
    const icon = cfg?.icon != null ? String(cfg.icon).trim() : '';
    if (!icon) {
        return null;
    }
    return `UITexture/${icon}_1/spriteFrame`;
}

/** basicSeeds 配置中的背包道具 id */
export function getBasicSeedItemId(seedKey: string): number | null {
    const key = String(seedKey ?? '').trim();
    if (!key) {
        return null;
    }
    const cfg = AppConst.JSONManager?.getItem?.('basicSeeds', key);
    const itemId = Number(cfg?.item_id);
    return Number.isFinite(itemId) && itemId > 0 ? itemId : null;
}
