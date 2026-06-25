/** CreateNpcNew 流程中暂存的 NPC 选项（选完名字后再提交服务器） */
export type CreateNpcNewDraft = {
    mbtiId: number;
    sex: number;
    /** 人设 tag id 列表 */
    rensheIds: number[];
    /** 背景 tag id 列表（接口字段 hobbies / identity 由步骤脚本写入） */
    backgroundIds: number[];
    name: string;
    age: number;
    npcId: number;
};

export function createEmptyCreateNpcNewDraft(): CreateNpcNewDraft {
    return {
        mbtiId: 0,
        sex: 0,
        rensheIds: [],
        backgroundIds: [],
        name: '',
        age: 18,
        npcId: 0,
    };
}

export enum CreateNpcNewStep {
    Welcome = 0,
    Mbti = 1,
    Sex = 2,
    Personality = 3,
    Background = 4,
    Name = 5,
    CreateImg = 6,
    Lihui = 7,
    Tips = 8,
}

export const CREATE_NPC_NEW_STEP_CHANGED = 'CreateNpcNewStepChanged';
export const CREATE_NPC_NEW_NPC_CREATED = 'CreateNpcNewNpcCreated';
export const CREATE_NPC_NEW_OPEN_ENTER_INFO = 'CreateNpcNewOpenEnterInfo';

/** NPC 是否已有立绘预览 URL */
export function npcHasStandeePortrait(npc: any): boolean {
    if (!npc) {
        return false;
    }
    return String(
        npc.model_url ?? npc.standee_url ?? npc.portrait_url ?? npc.image_url ?? '',
    ).trim().length > 0;
}

/** 外貌描述是否缺失 */
export function npcMissingAppearance(npc: any): boolean {
    if (!npc) {
        return false;
    }
    return !String(npc.appearance ?? '').trim();
}

/** 序列帧是否正在生成中 */
export function npcIsSpriteGenerating(npc: any): boolean {
    return Number(npc?.sprite_generating_status ?? 0) === 1;
}

/** 序列帧头像未生成完成时需继续创建流程（生成中除外，走 NPCTips） */
export function npcNeedsEnterInfo(npc: any): boolean {
    if (!npc) {
        return false;
    }
    if (npcIsSpriteGenerating(npc)) {
        return false;
    }
    return !String(npc.npc_sprite_url ?? '').trim();
}

/** Tab 点击后应进入的步骤（序列帧头像未完成时） */
export function resolveNpcContinueStep(npc: any): CreateNpcNewStep {
    if (npcMissingAppearance(npc) || !npcHasStandeePortrait(npc)) {
        return CreateNpcNewStep.CreateImg;
    }
    const status = Number(npc.sprite_generating_status ?? 0);
    if (status >= 1) {
        return CreateNpcNewStep.Tips;
    }
    return CreateNpcNewStep.Lihui;
}
