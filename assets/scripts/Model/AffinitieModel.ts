import { network } from "./RequestData";

export type NpcAffinityRow = {
    npc_id: number;
    affinity: number;
    consecutive_day_streak?: number;
    daily_gain_remaining?: number;
    daily_gain_today?: number;
    last_interaction_at?: number;
    last_interaction_type?: string;
    updated_at?: string;
};

export class AffinitieModel {
    private static _instance: AffinitieModel = null;

    private static AffintiteLv = {
        0 : [-100 , -1],
        1 : [0 , 199],
        2 : [200 , 399],
        3 : [400 , 599],
        4 : [600 , 799],
        5 : [800 , 1000],
    }

    public static getInstance(): AffinitieModel {
        if (!this._instance) {
            this._instance = new AffinitieModel();
        }
        return this._instance;
    }

    public init() {
        EventSystem.addListent("WebSocketNotifications", this.OnWSNotification, this)
    }
    
    /** npcId -> affinity row */
    private affinityByNpcId: Map<number, NpcAffinityRow> = new Map();
    /** 最近一次完整列表（按后端原样） */
    public lastAffinities: NpcAffinityRow[] = [];

    public getAffinityRow(npcId: number): NpcAffinityRow | null {
        const id = Number(npcId);
        if (!Number.isFinite(id)) return null;
        return this.affinityByNpcId.get(id) ?? null;
    }

    public getAffinityValue(npcId: number, fallback: number = 0): number {
        const row = this.getAffinityRow(npcId);
        const v = Number(row?.affinity);
        return Number.isFinite(v) ? v : fallback;
    }

    /** 根据 affinity 数值计算好感度等级（按 AffintiteLv 配置） */
    public getAffinityLevel(npcId: number): number {
        const v = this.getAffinityValue(npcId, 0);
        const cfg = (AffinitieModel as any).AffintiteLv as Record<number, [number, number]>;
        for (const k in cfg) {
            const lv = Number(k);
            const [min, max] = cfg[lv];
            if (v >= min && v <= max) return lv;
        }
        // 超出范围：向上兜底
        return v < 0 ? 0 : 5;
    }

    private OnWSNotification(data) {
        if (data.code == network.ServerCode.CodePlayerNpcAffinity) {
            console.log("更新用户->npc好感度")
            let content: any = data?.content;
            if (typeof content === "string") {
                try { content = JSON.parse(content); } catch { content = null; }
            }
            const affinities = Array.isArray(content?.affinities) ? content.affinities : [];
            if (affinities.length <= 0) {
                return;
            }
            this.lastAffinities = affinities as NpcAffinityRow[];
            for (let i = 0; i < affinities.length; i++) {
                const row = affinities[i] as any;
                const id = Number(row?.npc_id);
                if (!Number.isFinite(id)) continue;
                this.affinityByNpcId.set(id, {
                    npc_id: id,
                    affinity: Number(row?.affinity ?? 0),
                    consecutive_day_streak: row?.consecutive_day_streak,
                    daily_gain_remaining: row?.daily_gain_remaining,
                    daily_gain_today: row?.daily_gain_today,
                    last_interaction_at: row?.last_interaction_at,
                    last_interaction_type: row?.last_interaction_type,
                    updated_at: row?.updated_at,
                });
            }
            EventSystem.send("NpcAffinityUpdated", this.lastAffinities);
        }
    }    
}


