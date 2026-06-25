import { _decorator, Component, instantiate, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { UGCModel } from '../../Model/UGCModel';
import { BaseView } from '../BaseView';
import { CreateNpcTabCell } from './CreateNpcTabCell';
import {
    CREATE_NPC_NEW_NPC_CREATED,
    CREATE_NPC_NEW_OPEN_ENTER_INFO,
    CREATE_NPC_NEW_STEP_CHANGED,
    CreateNpcNewStep,
    createEmptyCreateNpcNewDraft,
    CreateNpcNewDraft,
} from './CreateNpcNewDraft';
import { CreateNpcNewStepBase } from './CreateNpcNewStepBase';
import { CreateNpcNewWelcomeStep } from './CreateNpcNewWelcomeStep';
import { CreateNpcNewMbtiStep } from './CreateNpcNewMbtiStep';
import { CreateNpcNewSexStep } from './CreateNpcNewSexStep';
import { CreateNpcNewPersonalityStep } from './CreateNpcNewPersonalityStep';
import { CreateNpcNewBackgroundStep } from './CreateNpcNewBackgroundStep';
import { CreateNpcNewNameStep } from './CreateNpcNewNameStep';
import { CreateNpcNewCreateImgStep } from './CreateNpcNewCreateImgStep';
import { CreateNpcNewLihuiStep } from './CreateNpcNewLihuiStep';
import { CreateNpcNewTipsStep } from './CreateNpcNewTipsStep';
const { ccclass, property } = _decorator;

/**
 * 新建 NPC 流程（9 步）：
 * Welcome → mbti → sex → personality → hobbies → name → enterInfo → lihui → tips
 *
 * - enterInfo    → CreateNpcNewCreateImgStep
 * - lihui        → CreateNpcNewLihuiStep（预览立绘，确认后生成序列帧）
 * - tips         → CreateNpcNewTipsStep
 */
@ccclass('CreateNpcNew')
export class CreateNpcNew extends Component {
    @property(Node)
    WelcomeNode: Node = null;

    @property(Node)
    MBTINode: Node = null;

    @property(Node)
    SexNode: Node = null;

    /** personality 人设 */
    @property(Node)
    resheNode: Node = null;

    /** hobbies 背景 */
    @property(Node)
    backgroundNode: Node = null;

    @property(Node)
    nameNode: Node = null;

    /** enterInfo 生成立绘 */
    @property(Node)
    createImgNode: Node = null;

    /** lihui 立绘预览 */
    @property(Node)
    lihuiNode: Node = null;

    @property(Node)
    tipsNode: Node = null;

    @property(Node)
    public npcTabCell: Node = null;

    private npcNodes: Node[] = [];
    private readonly draft: CreateNpcNewDraft = createEmptyCreateNpcNewDraft();
    private currentStep: CreateNpcNewStep = CreateNpcNewStep.Welcome;
    private stepNodes: Node[] = [];
    private stepComponents: CreateNpcNewStepBase[] = [];
    private pendingCreateName = '';
    /** NPC Tab 列表 ScrollView；从 Welcome/bottom 提到根节点，避免切步时被隐藏 */
    // private npcTabBarNode: Node | null = null;

    start() {
        this.collectStepNodes();
        this.bindStepFlows();
        this.setupPersistentChrome();
        if (this.npcTabCell) {
            this.npcTabCell.active = false;
        }
        if (this.lihuiNode) {
            this.lihuiNode.active = false;
        }
        this.goToStep(CreateNpcNewStep.Welcome);
        this.refreshTabNpc();
        EventSystem.addListent('OnRefreshUGCMapNpc', this.refreshTabNpc, this);
        EventSystem.addListent(CREATE_NPC_NEW_NPC_CREATED, this.onNpcCreated, this);
        EventSystem.addListent(CREATE_NPC_NEW_OPEN_ENTER_INFO, this.onOpenEnterInfo, this);
        UGCModel.getInstance().listMyNpcs(false);
    }

    onDestroy() {
        EventSystem.remove(this);
    }

    getDraft(): Readonly<CreateNpcNewDraft> {
        return this.draft;
    }

    setDraftNpcId(npcId: number) {
        this.draft.npcId = Math.floor(Number(npcId) || 0);
    }

    getCurrentStep(): CreateNpcNewStep {
        return this.currentStep;
    }

    setMbti(mbtiId: number) {
        this.draft.mbtiId = Math.floor(Number(mbtiId) || 0);
    }

    setSex(sex: number) {
        this.draft.sex = Math.floor(Number(sex) || 0);
    }

    toggleRenshe(rensheId: number): boolean {
        const id = Math.floor(Number(rensheId) || 0);
        if (id <= 0) {
            return false;
        }
        const idx = this.draft.rensheIds.indexOf(id);
        if (idx >= 0) {
            this.draft.rensheIds.splice(idx, 1);
            return true;
        }
        if (this.draft.rensheIds.length >= 3) {
            EventSystem.send('ShowTips', 'At most 3 characters are set.');
            return false;
        }
        this.draft.rensheIds.push(id);
        return true;
    }

    toggleBackground(backgroundId: number) {
        const id = Math.floor(Number(backgroundId) || 0);
        if (id <= 0) {
            return;
        }
        const idx = this.draft.backgroundIds.indexOf(id);
        if (idx >= 0) {
            this.draft.backgroundIds.splice(idx, 1);
        } else {
            this.draft.backgroundIds.push(id);
        }
    }

    canLeaveMbti(): boolean {
        return this.draft.mbtiId > 0;
    }

    canLeavePersonality(): boolean {
        return this.draft.rensheIds.length > 0;
    }

    canLeaveBackground(): boolean {
        return this.draft.backgroundIds.length > 0;
    }

    goNext() {
        const next = this.currentStep + 1;
        if (next <= CreateNpcNewStep.Tips) {
            this.goToStep(next as CreateNpcNewStep);
        }
    }

    goPrev() {
        const prev = this.currentStep - 1;
        if (prev < CreateNpcNewStep.Welcome) {
            return;
        }
        if (this.isNpcCreatedFlow() && prev < CreateNpcNewStep.CreateImg) {
            return;
        }
        this.goToStep(prev as CreateNpcNewStep);
    }

    /** NPC 已在服务端创建：不可回到 MBTI/性别/人设等前置步骤 */
    isNpcCreatedFlow(): boolean {
        return this.draft.npcId > 0;
    }

    openEnterInfoForNpc(npcInfo: any) {
        const npcId = Number(npcInfo?.id ?? npcInfo?.npc_id ?? 0);
        if (!Number.isFinite(npcId) || npcId <= 0) {
            return;
        }
        Object.assign(this.draft, createEmptyCreateNpcNewDraft(), {
            npcId,
            name: String(npcInfo?.name ?? npcInfo?.npc_name ?? ''),
            age: Math.floor(Number(npcInfo?.age ?? 18) || 18),
        });
        this.pendingCreateName = '';
        this.goToStep(CreateNpcNewStep.CreateImg);
    }

    private onOpenEnterInfo(npcInfo: any) {
        this.openEnterInfoForNpc(npcInfo);
    }

    goToStep(step: CreateNpcNewStep) {
        for (let i = 0; i < this.stepComponents.length; i++) {
            if (i !== step) {
                this.stepComponents[i]?.onStepHide();
            }
        }
        for (let i = 0; i < this.stepNodes.length; i++) {
            const node = this.stepNodes[i];
            const active = i === step;
            if (node?.isValid) {
                node.active = active;
            }
            if (active) {
                this.stepComponents[i]?.onStepShow();
            }
        }
        this.hideWelcomeChromeWhenNeeded(step);
        this.currentStep = step;
        this.updatePersistentChrome(step);
        this.syncTabBarSiblingIndex();
        EventSystem.send(CREATE_NPC_NEW_STEP_CHANGED, { step });
    }

    /** enterInfo 及之后：确保 Welcome 内欢迎页 UI 不残留显示 */
    private hideWelcomeChromeWhenNeeded(step: CreateNpcNewStep) {
        if (step < CreateNpcNewStep.CreateImg) {
            return;
        }
        if (this.WelcomeNode?.isValid) {
            this.WelcomeNode.active = false;
        }
    }

    /** 仅提升 Tab ScrollView，不移动 bottom 内欢迎页按钮/背景 */
    private setupPersistentChrome() {
        // if (!this.npcTabCell?.isValid) {
        //     return;
        // }
        // let node: Node | null = this.npcTabCell.parent;
        // while (node && node !== this.node && node.name !== 'ScrollView') {
        //     node = node.parent;
        // }
        // if (!node?.isValid || node.parent === this.node) {
        //     this.npcTabBarNode = node;
        //     return;
        // }
        // node.parent = this.node;
        // this.npcTabBarNode = node;
        // this.syncTabBarSiblingIndex();
    }

    /** Tab 栏层级：低于 lihui，高于其它步骤页 */
    private syncTabBarSiblingIndex() {
        // if (!this.npcTabBarNode?.isValid) {
        //     return;
        // }
        // if (this.lihuiNode?.isValid && this.lihuiNode.parent === this.node) {
        //     this.npcTabBarNode.setSiblingIndex(this.lihuiNode.getSiblingIndex());
        //     return;
        // }
        // this.npcTabBarNode.setSiblingIndex(this.node.children.length - 1);
    }

    private updatePersistentChrome(step: CreateNpcNewStep) {
        // const showNpcTabBar =
        //     step === CreateNpcNewStep.Welcome ||
        //     step === CreateNpcNewStep.CreateImg ||
        //     step === CreateNpcNewStep.Lihui ||
        //     step === CreateNpcNewStep.Tips;

        // if (this.npcTabBarNode?.isValid) {
        //     this.npcTabBarNode.active = showNpcTabBar;
        // }
    }

    submitCreateNpc(name: string, age: number) {
        const trimmed = String(name ?? '').trim();
        if (!trimmed) {
            EventSystem.send('ShowTips', 'Please enter NPC name');
            return;
        }
        if (!Number.isFinite(age) || age <= 0) {
            EventSystem.send('ShowTips', 'Please enter a valid age');
            return;
        }
        if (!this.canLeaveMbti()) {
            EventSystem.send('ShowTips', 'Please select MBTI');
            return;
        }
        if (!this.canLeavePersonality()) {
            EventSystem.send('ShowTips', 'Please select at least one trait');
            return;
        }
        if (!this.canLeaveBackground()) {
            EventSystem.send('ShowTips', 'Please select a background');
            return;
        }

        const ugc = UGCModel.getInstance();
        if ((ugc.npcList || []).length >= 10) {
            EventSystem.send('ShowTips', 'NPC limit reached (10)');
            return;
        }
        const hasSame = (ugc.npcList || []).some((npc: any) => {
            return String(npc?.name || '').trim() === trimmed;
        });
        if (hasSame) {
            EventSystem.send('ShowTips', 'NPC name already exists');
            return;
        }

        const mbti = ugc.getTagNameById(this.draft.mbtiId, 5);
        if (!mbti) {
            EventSystem.send('ShowTips', 'Please select MBTI');
            return;
        }

        this.draft.name = trimmed;
        this.draft.age = Math.floor(age);
        this.pendingCreateName = trimmed;

        ugc.createNpcNew({
            name: trimmed,
            sex: this.draft.sex,
            age: this.draft.age,
            mbti,
            characteristics: [...this.draft.rensheIds],
            hobbies: [...this.draft.backgroundIds],
        }).catch(() => {});
    }

    private onNpcCreated(npc: any) {
        const pending = this.pendingCreateName;
        this.pendingCreateName = '';
        if (!npc || !pending) {
            return;
        }
        const npcName = String(npc.name ?? npc.npc_name ?? '').trim();
        if (npcName !== pending) {
            return;
        }

        const npcId = Number(npc.id ?? npc.npc_id ?? 0);
        if (!Number.isFinite(npcId) || npcId <= 0) {
            return;
        }
        this.draft.npcId = npcId;
        this.goToStep(CreateNpcNewStep.CreateImg);
    }

    goToTipsForCurrentNpc() {
        if (!this.draft.npcId) {
            return;
        }
        this.goToStep(CreateNpcNewStep.Tips);
    }

    goToLihuiForCurrentNpc() {
        if (!this.draft.npcId) {
            return;
        }
        this.goToStep(CreateNpcNewStep.Lihui);
    }

    finishFlow() {
        this.closePanel();
    }

    /** 从 enterInfo 等回到 CreateNpcNew 的 Welcome 页 */
    exitToHome() {
        Object.assign(this.draft, createEmptyCreateNpcNewDraft());
        this.pendingCreateName = '';
        this.goToStep(CreateNpcNewStep.Welcome);
    }

    private closePanel() {
        const baseView = this.node.getComponent(BaseView);
        if (baseView) {
            AppConst.PanelManager.CloseView(baseView);
            return;
        }
        AppConst.PanelManager.CloseViewByUrl('res/View/CreateNpc/CreateNpcNew');
        if (this.node?.isValid) {
            this.node.destroy();
            this.node.removeFromParent();
        }
    }

    isOnEnterInfoPage(): boolean {
        if (this.currentStep === CreateNpcNewStep.CreateImg) {
            return true;
        }
        return !!(this.createImgNode?.isValid && this.createImgNode.active);
    }

    isOnTipsPage(): boolean {
        if (this.currentStep === CreateNpcNewStep.Tips) {
            return true;
        }
        return !!(this.tipsNode?.isValid && this.tipsNode.active);
    }

    isOnLihuiPage(): boolean {
        if (this.currentStep === CreateNpcNewStep.Lihui) {
            return true;
        }
        return !!(this.lihuiNode?.isValid && this.lihuiNode.active);
    }

    onClickBack() {
        if (this.isOnEnterInfoPage() || this.isOnLihuiPage() || this.isOnTipsPage()) {
            this.exitToHome();
            return;
        }
        if (this.currentStep > CreateNpcNewStep.Welcome) {
            this.goPrev();
            return;
        }
        this.closePanel();
    }

    private collectStepNodes() {
        this.stepNodes = [
            this.WelcomeNode,
            this.MBTINode,
            this.SexNode,
            this.resheNode,
            this.backgroundNode,
            this.nameNode,
            this.createImgNode,
            this.lihuiNode,
            this.tipsNode,
        ];
    }

    private bindStepFlows() {
        this.stepComponents = this.stepNodes.map((node) => {
            if (!node?.isValid) {
                return null;
            }
            const comp =
                node.getComponent(CreateNpcNewWelcomeStep) ??
                node.getComponent(CreateNpcNewMbtiStep) ??
                node.getComponent(CreateNpcNewSexStep) ??
                node.getComponent(CreateNpcNewPersonalityStep) ??
                node.getComponent(CreateNpcNewBackgroundStep) ??
                node.getComponent(CreateNpcNewNameStep) ??
                node.getComponent(CreateNpcNewCreateImgStep) ??
                node.getComponent(CreateNpcNewLihuiStep) ??
                node.getComponent(CreateNpcNewTipsStep) ??
                node.getComponent(CreateNpcNewStepBase);
            comp?.bindFlow(this);
            return comp;
        });
    }

    refreshTabNpc() {
        if (!this.npcTabCell) {
            return;
        }
        if (this.npcNodes.length < UGCModel.getInstance().npcList.length) {
            for (let i = this.npcNodes.length; i < UGCModel.getInstance().npcList.length; i++) {
                const npcTab = instantiate(this.npcTabCell);
                npcTab.parent = this.npcTabCell.parent;
                npcTab.active = true;
                this.npcNodes.push(npcTab);
            }
        }
        for (let i = 0; i < this.npcNodes.length; i++) {
            if (i < UGCModel.getInstance().npcList.length) {
                this.npcNodes[i].active = true;
                const npcInfo = UGCModel.getInstance().npcList[i];
                this.npcNodes[i].getComponent(CreateNpcTabCell)?.refreshNpcInfo(npcInfo);
            } else {
                this.npcNodes[i].active = false;
            }
        }
    }
}
