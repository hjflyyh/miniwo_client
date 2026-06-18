import { AppConst } from '../../AppConst';

/** systemConfig id:48 单条等级配置 */
export type FarmUnlockLevelConfig = {
    level: number;
    /** 该等级可拥有的土地块数上限 */
    maxFarmCount: number;
    /** 升到该等级所需经验 */
    upgradeExp: number;
    /** 开田所需道具数量 */
    openItemCount: number;
    /** 开田所需道具 id */
    openItemId: number;
};

const FARM_UNLOCK_SYSTEM_CONFIG_ID = '48';

/** 解析 systemConfig id:48 configuration */
export function parseFarmUnlockConfigs(): FarmUnlockLevelConfig[] {
    const raw =
        AppConst.JSONManager.getItemAll('systemConfig')?.[FARM_UNLOCK_SYSTEM_CONFIG_ID]
            ?.configuration ?? '';
    if (!raw) {
        return [];
    }

    const list: FarmUnlockLevelConfig[] = [];
    const segments = String(raw).split('_').filter((s) => s.length > 0);
    for (let i = 0; i < segments.length; i++) {
        const parts = segments[i].split('#');
        if (parts.length < 3) {
            continue;
        }
        const level = Math.floor(Number(parts[0]) || 0);
        const maxFarmCount = Math.floor(Number(parts[1]) || 0);
        const upgradeExp = Math.floor(Number(parts[2]) || 0);
        let openItemCount = 0;
        let openItemId = 0;
        const costRaw = parts[3] ?? '';
        if (costRaw) {
            const costParts = costRaw.split('&');
            if (costParts.length >= 2) {
                // 配置格式：道具id&数量（如 104&100 = 金币 100）
                openItemId = Math.floor(Number(costParts[0]) || 0);
                openItemCount = Math.floor(Number(costParts[1]) || 0);
            } else {
                openItemCount = Math.floor(Number(costParts[0]) || 0);
            }
        }
        if (level <= 0) {
            continue;
        }
        list.push({ level, maxFarmCount, upgradeExp, openItemCount, openItemId });
    }
    list.sort((a, b) => a.level - b.level);
    return list;
}

/** 开启 farm_id 所需最低地图等级（该等级 maxFarmCount 能覆盖目标块） */
export function getRequiredMapLevelForFarmId(
    farmId: number,
    configs = parseFarmUnlockConfigs(),
): number | null {
    const id = Math.floor(Number(farmId) || 0);
    if (id <= 0 || !configs.length) {
        return null;
    }
    for (let i = 0; i < configs.length; i++) {
        if (configs[i].maxFarmCount >= id) {
            return configs[i].level;
        }
    }
    return configs[configs.length - 1]?.level ?? null;
}

export function getFarmUnlockConfigByLevel(
    level: number,
    configs = parseFarmUnlockConfigs(),
): FarmUnlockLevelConfig | null {
    const lv = Math.floor(Number(level) || 0);
    if (lv <= 0) {
        return null;
    }
    let matched: FarmUnlockLevelConfig | null = null;
    for (let i = 0; i < configs.length; i++) {
        if (configs[i].level <= lv) {
            matched = configs[i];
        } else {
            break;
        }
    }
    return matched ?? configs[0] ?? null;
}

/** 开启指定 farm_id 时使用的等级配置与消耗 */
export function getOpenFarmRequirement(farmId: number): {
    requiredLevel: number;
    config: FarmUnlockLevelConfig;
} | null {
    const configs = parseFarmUnlockConfigs();
    const requiredLevel = getRequiredMapLevelForFarmId(farmId, configs);
    if (requiredLevel == null) {
        return null;
    }
    const config = configs.find((c) => c.level === requiredLevel);
    if (!config) {
        return null;
    }
    return { requiredLevel, config };
}
