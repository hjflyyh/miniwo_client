import {
    _decorator,
    Label,
    Node,
} from 'cc';
import { UGCModel } from '../../Model/UGCModel';
import {
    LoadLocalImage,
    MIN_UPLOAD_IMAGE_HEIGHT,
    MIN_UPLOAD_IMAGE_WIDTH,
} from '../../Utils/LoadLocalImage';
import { TypewriterLabel } from '../../Utils/TypewriterLabel';
import { CreateNpcNewStepBase } from './CreateNpcNewStepBase';
const { ccclass, property } = _decorator;

/** 立绘任务轮询间隔（毫秒） */
const STANDEE_POLL_INTERVAL_MS = 1500;
/** 最长轮询次数（约 3 分钟） */
const STANDEE_POLL_MAX_ATTEMPTS = 120;

/**
 * enterInfo 节点：生成立绘，逻辑与 EditNpcImg 基本一致，组件自行绑定。
 */
@ccclass('CreateNpcNewCreateImgStep')
export class CreateNpcNewCreateImgStep extends CreateNpcNewStepBase {
    private standeePollTimer: ReturnType<typeof setTimeout> | null = null;
    private standeePollAttempts = 0;
    private standeePollAborted = false;
    private generatingAIAppearance = false;

    @property(Label)
    editBox: Label = null;

    /** appearance 展示打字机（挂 TypewriterLabel 后拖入；可与 editBox 共用同一 Label） */
    @property(TypewriterLabel)
    appearanceTypewriter: TypewriterLabel = null;

    // @property(Sprite)
    // lihui: Sprite = null;

    @property(LoadLocalImage)
    localImageLoader: LoadLocalImage = null;

    @property(Node)
    waitNode: Node = null;

    @property(Node)
    confirmNode: Node = null;

    /** enterInfo 主内容区（prefab 里为 bottom 节点，默认 inactive） */
    @property(Node)
    mainContentNode: Node = null;

    /** 供 CreateNpcNameCell 选中态比对，等同当前 draft.npcId */
    public get chooseNpcId(): number {
        return this.getNpcId();
    }

    onStepShow() {
        this.standeePollAborted = false;
        this.ensureLocalImageLoader();
        this.ensureMainContentVisible();

        if (this.waitNode) {
            this.waitNode.active = false;
        }
        if (this.confirmNode) {
            this.confirmNode.active = false;
        }

        this.refreshFromNpc();
        this.requestGenerateAICharacterIfNeeded();

        EventSystem.addListent('CreateNpcNameCell', this.onChooseNpcTab, this);
    }

    onStepHide() {
        this.standeePollAborted = true;
        this.stopStandeePolling();
        this.appearanceTypewriter?.cancelPlayback();
        EventSystem.remove(this);
    }

    private getNpcId(): number {
        return Number(this.getFlow()?.getDraft()?.npcId ?? 0);
    }

    private ensureLocalImageLoader() {
        if (!this.localImageLoader) {
            this.localImageLoader = this.node.getComponentInChildren(LoadLocalImage);
        }
    }

    private ensureMainContentVisible() {
        if (this.mainContentNode?.isValid) {
            this.mainContentNode.active = true;
            return;
        }
        const bottom = this.node.getChildByName('bottom');
        if (bottom) {
            bottom.active = true;
        }
    }

    private isUploadImageSizeValid(): boolean {
        const loader = this.localImageLoader;
        if (!loader?.hasSelectedImage()) {
            return false;
        }
        return loader.meetsMinUploadSize();
    }

    private getNpcName(): string {
        const draftName = String(this.getFlow()?.getDraft()?.name ?? '').trim();
        if (draftName) {
            return draftName;
        }
        const npc = UGCModel.getInstance().getNpcById(this.getNpcId());
        return String(npc?.name ?? '');
    }

    private getAppearanceText(): string {
        if (this.appearanceTypewriter) {
            return this.appearanceTypewriter.getFullText().trim();
        }
        return String(this.editBox?.string ?? '').trim();
    }

    private showAppearanceText(text: string, immediate = false) {
        const appearance = String(text ?? '');
        if (this.appearanceTypewriter) {
            this.appearanceTypewriter.play(appearance, immediate);
            return;
        }
        if (this.editBox) {
            this.editBox.string = appearance;
        }
    }

    private refreshFromNpc() {
        const npcId = this.getNpcId();
        if (!npcId) {
            return;
        }
        const npc = UGCModel.getInstance().getNpcById(npcId);
        if (!npc) {
            return;
        }
        const appearance = String(npc.appearance ?? '').trim();
        this.showAppearanceText(appearance);
        // const portraitUrl = this.extractPortraitUrlFromNpc(npc);
        // if (portraitUrl) {
        //     this.displayPortraitUrl(portraitUrl);
        // } else if (this.lihui) {
        //     this.lihui.spriteFrame = null;
        // }
    }

    /** 无 appearance 时自动请求 generateAICharacter */
    private requestGenerateAICharacterIfNeeded() {
        const npcId = this.getNpcId();
        if (!npcId || this.generatingAIAppearance) {
            return;
        }
        const npc = UGCModel.getInstance().getNpcById(npcId);
        if (!npc) {
            EventSystem.send('ShowTips', 'NPC does not exist');
            return;
        }
        const appearance = String(npc.appearance ?? '').trim();
        if (appearance) {
            return;
        }
        this.generatingAIAppearance = true;
        if (this.waitNode) {
            this.waitNode.active = true;
        }
        UGCModel.getInstance()
            .generateAICharacter(npcId)
            .then((resp: any) => {
                this.generatingAIAppearance = false;
                if (this.waitNode) {
                    this.waitNode.active = false;
                }
                if (!resp?.ok || !resp?.data) {
                    EventSystem.send('ShowTips', 'AI generation failed');
                    return;
                }
                const aiData = resp.data;
                UGCModel.getInstance().applyAICharacterToNpc(npcId, aiData);
                this.applyAIDataToView(aiData);
            })
            .catch(() => {
                this.generatingAIAppearance = false;
                if (this.waitNode) {
                    this.waitNode.active = false;
                }
            });
    }

    /** 模式 B：AI 外貌描述文生图 */
    onClickAIText() {
        const npcId = this.getNpcId();
        if (!npcId) {
            EventSystem.send('ShowTips', 'Please select an NPC first');
            return;
        }
        const desc = this.getAppearanceText();
        if (!desc) {
            EventSystem.send('ShowTips', 'Please enter a appearance description');
            return;
        }
        const name = this.getNpcName();
        if (!name) {
            EventSystem.send('ShowTips', 'Invalid NPC name');
            return;
        }

        this.beginPortraitGeneration();
        UGCModel.getInstance()
            .generateNpcCharacterByText(npcId, name, desc)
            .then((resp: any) => {
                this.handleStandeeSubmitResponse(resp);
            })
            .catch(() => {
                this.endPortraitGeneration();
            });
    }

    onClickNext() {
        const npcId = this.getNpcId();
        if (!npcId) {
            EventSystem.send('ShowTips', 'Please select the NPC first.');
            return;
        }
        if (!this.hasNpcStandeePortrait(npcId)) {
            EventSystem.send('ShowTips', 'Please generate the NPC standee portrait first.');
            return;
        }
        this.getFlow()?.goToLihuiForCurrentNpc();
    }

    onClickCloseNext() {
        if (this.confirmNode) {
            this.confirmNode.active = false;
        }
    }

    /** @deprecated 确认逻辑已移至 CreateNpcNewLihuiStep.onClickConfirm */
    onClickConfirm() {
        this.getFlow()?.goToLihuiForCurrentNpc();
    }

    /** 模式 A：本机参考图图生图 */
    onClickAIImg() {
        const npcId = this.getNpcId();
        if (!npcId) {
            EventSystem.send('ShowTips', 'Please select the NPC first.');
            return;
        }
        if (!this.localImageLoader?.hasSelectedImage()) {
            EventSystem.send('ShowTips', 'Please upload a reference image first.');
            return;
        }
        if (!this.isUploadImageSizeValid()) {
            EventSystem.send(
                'ShowTips',
                `Uploaded image cannot be smaller than ${MIN_UPLOAD_IMAGE_WIDTH}×${MIN_UPLOAD_IMAGE_HEIGHT}`,
            );
            return;
        }
        const dataUrl = this.localImageLoader.getSelectedDataUrl();
        const name = this.getNpcName();
        if (!name) {
            EventSystem.send('ShowTips', 'Invalid NPC name');
            return;
        }

        this.beginPortraitGeneration();
        UGCModel.getInstance()
            .generateNpcCharacterByReference(npcId, name, dataUrl)
            .then((resp: any) => {
                this.handleStandeeSubmitResponse(resp);
            })
            .catch(() => {
                this.endPortraitGeneration();
            });
    }

    /** 重新请求 AI 生成当前 NPC 的人设数据（含 appearance） */
    onClickNewNpc() {
        const npcId = this.getNpcId();
        if (!npcId) {
            EventSystem.send('ShowTips', 'Please select an NPC first.');
            return;
        }
        const npc = UGCModel.getInstance().getNpcById(npcId);
        if (!npc) {
            EventSystem.send('ShowTips', 'NPC does not exist');
            return;
        }

        if (this.waitNode) {
            this.waitNode.active = true;
        }
        UGCModel.getInstance()
            .generateAICharacter(npcId)
            .then((resp: any) => {
                if (this.waitNode) {
                    this.waitNode.active = false;
                }
                if (!resp?.ok || !resp?.data) {
                    EventSystem.send('ShowTips', 'AI generation failed');
                    return;
                }
                const aiData = resp.data;
                UGCModel.getInstance().applyAICharacterToNpc(npcId, aiData);
                this.applyAIDataToView(aiData);
            })
            .catch(() => {
                if (this.waitNode) {
                    this.waitNode.active = false;
                }
            });
    }

    onClickBack() {
        this.getFlow()?.onClickBack();
    }

    private applyAIDataToView(aiData: Record<string, unknown>) {
        const appearance = String(aiData.appearance ?? '');
        this.showAppearanceText(appearance);

        const npcId = this.getNpcId();
        const npc = UGCModel.getInstance().getNpcById(npcId);
        if (npc) {
            npc.portrait_url = '';
            npc.model_url = '';
            npc.standee_url = '';
        }
        UGCModel.getInstance().saveNpcListToLocal();
        // if (this.lihui) {
        //     this.lihui.spriteFrame = null;
        // }
    }

    private onChooseNpcTab(npcId: number) {
        const id = Number(npcId);
        if (!Number.isFinite(id) || id <= 0) {
            return;
        }
        this.getFlow()?.setDraftNpcId(id);
        this.refreshFromNpc();
    }

    private beginPortraitGeneration() {
        this.standeePollAborted = false;
        this.stopStandeePolling();
        if (this.waitNode) {
            this.waitNode.active = true;
        }
    }

    private endPortraitGeneration() {
        if (this.waitNode) {
            this.waitNode.active = false;
        }
        this.stopStandeePolling();
    }

    private stopStandeePolling() {
        if (this.standeePollTimer != null) {
            clearTimeout(this.standeePollTimer);
            this.standeePollTimer = null;
        }
        this.standeePollAttempts = 0;
    }

    private scheduleStandeePoll(taskId: string) {
        if (this.standeePollAborted || !this.node?.isValid) {
            return;
        }
        this.standeePollTimer = setTimeout(() => {
            this.standeePollTimer = null;
            void this.pollStandeeTask(taskId);
        }, STANDEE_POLL_INTERVAL_MS);
    }

    private handleStandeeSubmitResponse(resp: any) {
        if (!resp?.ok) {
            this.endPortraitGeneration();
            const msg = resp?.error || resp?.message;
            if (msg) {
                EventSystem.send('ShowTips', String(msg));
            }
            return;
        }

        const status = String(resp?.status ?? '').toLowerCase();
        if (status === 'completed' || status === 'complete') {
            this.endPortraitGeneration();
            this.onStandeeTaskCompleted(resp);
            return;
        }

        const taskId = String(resp?.task_id ?? '').trim();
        if (taskId) {
            void this.pollStandeeTask(taskId);
            return;
        }

        this.endPortraitGeneration();
        this.onPortraitGenerated(resp);
    }

    private async pollStandeeTask(taskId: string) {
        if (this.standeePollAborted || !this.node?.isValid) {
            return;
        }

        if (this.standeePollAttempts >= STANDEE_POLL_MAX_ATTEMPTS) {
            this.endPortraitGeneration();
            EventSystem.send('ShowTips', 'Standee generation timed out, please try again later');
            return;
        }
        this.standeePollAttempts += 1;

        try {
            const resp = await UGCModel.getInstance().queryNpcStandeeTask(taskId);
            if (this.standeePollAborted || !this.node?.isValid) {
                return;
            }

            if (!resp?.ok) {
                this.endPortraitGeneration();
                EventSystem.send(
                    'ShowTips',
                    String(resp?.message || resp?.error || 'Standee generation failed'),
                );
                return;
            }

            const status = String(resp?.status ?? '').toLowerCase();
            if (status === 'completed' || status === 'complete') {
                this.endPortraitGeneration();
                this.onStandeeTaskCompleted(resp);
                return;
            }

            if (status === 'failed' || status === 'error') {
                this.endPortraitGeneration();
                EventSystem.send(
                    'ShowTips',
                    String(resp?.message || resp?.error || 'Standee generation failed'),
                );
                return;
            }

            this.scheduleStandeePoll(taskId);
        } catch {
            this.endPortraitGeneration();
        }
    }

    private onStandeeTaskCompleted(resp: any) {
        const standeeUrl = this.extractStandeeUrlFromResponse(resp);
        if (standeeUrl) {
            const compositeNpcId = String(resp?.result?.npc_id ?? '').trim();
            this.finishStandeeAndGoLihui(standeeUrl, compositeNpcId || undefined);
            return;
        }
        this.onPortraitGenerated(resp);
    }

    private extractStandeeUrlFromResponse(resp: any): string {
        const result = resp?.result ?? resp?.data?.result ?? resp?.data;
        return String(
            result?.standee_url ?? result?.preview_url ?? resp?.standee_url ?? '',
        ).trim();
    }

    private onPortraitGenerated(resp: any) {
        if (resp?.ok === false || resp?.success === false) {
            const msg = resp?.error || resp?.message;
            if (msg) {
                EventSystem.send('ShowTips', String(msg));
            }
            return;
        }

        const { url, dataUrl } = this.extractPortraitFromResponse(resp);
        if (!url && !dataUrl) {
            EventSystem.send('ShowTips', 'Image generation in progress');
            return;
        }

        this.finishStandeeAndGoLihui(url ?? dataUrl ?? '');
    }

    /** 立绘生成完成：写入 NPC 并进入 lihui 预览页 */
    private finishStandeeAndGoLihui(standeeUrl: string, compositeNpcId?: string) {
        const url = String(standeeUrl ?? '').trim();
        const npcId = this.getNpcId();
        if (!npcId) {
            return;
        }
        if (url) {
            UGCModel.getInstance().applyStandeeUrlToNpc(npcId, url, compositeNpcId);
        }
        if (!this.hasNpcStandeePortrait(npcId)) {
            EventSystem.send('ShowTips', 'Standee generation failed');
            return;
        }
        this.getFlow()?.goToLihuiForCurrentNpc();
    }

    private extractPortraitFromResponse(resp: any): { url?: string; dataUrl?: string } {
        const data = resp?.data ?? resp;
        const url = String(
            data?.standee_url ??
                data?.result?.standee_url ??
                data?.portrait_url ??
                data?.image_url ??
                data?.model_url ??
                data?.url ??
                resp?.result?.standee_url ??
                resp?.portrait_url ??
                '',
        ).trim();

        let rawBase64 = String(
            data?.image_base64 ?? data?.base64 ?? data?.portrait_base64 ?? '',
        ).trim();

        if (rawBase64 && !rawBase64.startsWith('data:')) {
            rawBase64 = `data:image/png;base64,${rawBase64}`;
        }

        return {
            url: url || undefined,
            dataUrl: rawBase64 || undefined,
        };
    }

    private extractPortraitUrlFromNpc(npc: any): string {
        if (!npc) {
            return '';
        }
        return String(
            npc.model_url ?? npc.standee_url ?? npc.portrait_url ?? npc.image_url ?? '',
        ).trim();
    }

    private hasNpcStandeePortrait(npcId?: number): boolean {
        const id = npcId ?? this.getNpcId();
        if (!id) {
            return false;
        }
        const npc = UGCModel.getInstance().getNpcById(id);
        return this.extractPortraitUrlFromNpc(npc).length > 0;
    }
}
