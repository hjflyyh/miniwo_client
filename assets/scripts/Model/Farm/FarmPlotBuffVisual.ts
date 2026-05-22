/** 地块 buff 贴图：UITexture/farmBuff/buffType_{type} */
export function getFarmBuffSpriteResourcePath(buffType: number): string | null {
    const type = Math.floor(Number(buffType) || 0);
    if (type < 0 || !Number.isFinite(type)) {
        return null;
    }
    return `UITexture/farmBuff/buffType_${type}/spriteFrame`;
}
