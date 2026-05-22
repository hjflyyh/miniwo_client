import { AppConst } from "../../AppConst";

/** basicSeeds 配置 icon 对应成熟阶段贴图：icon + "_2" */
export function getBasicSeedMatureSpriteResourcePath(seedKey: string): string | null {
    const key = String(seedKey ?? '').trim();
    if (!key) {
        return null;
    }
    const cfg = AppConst.JSONManager?.getItem?.('basicSeeds', key);
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
    const cfg = AppConst.JSONManager?.getItem?.('basicSeeds', key);
    const icon = cfg?.icon != null ? String(cfg.icon).trim() : '';
    if (!icon) {
        return null;
    }
    return `UITexture/${icon}_1/spriteFrame`;
}
