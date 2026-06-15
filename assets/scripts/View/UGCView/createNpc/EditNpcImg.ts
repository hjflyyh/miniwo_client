import { _decorator, Component, EditBox, ImageAsset, instantiate, Node, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { AppConst } from '../../../AppConst';
import { UGCModel } from '../../../Model/UGCModel';
import { CreateNpcNameCell } from '../CreateNpcNameCell';
import {
    LoadLocalImage,
    MIN_UPLOAD_IMAGE_HEIGHT,
    MIN_UPLOAD_IMAGE_WIDTH,
} from '../../../Utils/LoadLocalImage';
import { Utils } from '../../../Utils/Utils';
import { HttpManager } from '../../../Manager/HttpManager';
const { ccclass, property } = _decorator;

/** 立绘任务轮询间隔（毫秒） */
const STANDEE_POLL_INTERVAL_MS = 1500;
/** 最长轮询次数（约 3 分钟） */
const STANDEE_POLL_MAX_ATTEMPTS = 120;

@ccclass('EditNpcImg')
export class EditNpcImg extends Component {
    private npcTabs : Node[] = [];
    private standeePollTimer: ReturnType<typeof setTimeout> | null = null;
    private standeePollAttempts = 0;
    private standeePollAborted = false;

    @property(Node)
    public npcTabCell : Node = null;

    @property(EditBox)
    public editBox : EditBox = null;

    @property(Sprite)
    public lihui : Sprite = null;

    @property(LoadLocalImage)
    public localImageLoader: LoadLocalImage = null;

    @property(Node)
    public waitNode : Node = null;

    @property(Node)
    public confirmNode : Node = null

    public chooseNpcId = 0;

    start() {
        if (!this.localImageLoader) {
            this.localImageLoader = this.node.getComponentInChildren(LoadLocalImage);
        }

        if (this.waitNode) {
            this.waitNode.active = false;
        }
        if (this.confirmNode) {
            this.confirmNode.active = false;
        }

        const openParam = this.getOpenParam();
        console.log(openParam);
        this.chooseNpcId = openParam.id;
        this.npcTabCell.active = false;
        this.editBox.string = openParam.appearance || "";
        this.refreshTabNpc();

        const portraitUrl = this.extractPortraitUrlFromNpc(openParam);
        if (portraitUrl) {
            this.displayPortraitUrl(portraitUrl);
        }

        EventSystem.addListent("CreateNpcNameCell", this.onChooseNpcTab, this);
    }

    private getOpenParam(): any {
        return (this.node as any)["_openParam"] || {};
    }

    private isUploadImageSizeValid(): boolean {
        const loader = this.localImageLoader;
        if (!loader?.hasSelectedImage()) {
            return false;
        }
        return loader.meetsMinUploadSize();
    }

    private getNpcName(): string {
        const openParam = this.getOpenParam();
        if (openParam.name) {
            return String(openParam.name);
        }
        const npc = UGCModel.getInstance().getNpcById(this.chooseNpcId);
        return String(npc?.name ?? "");
    }

    refreshTabNpc(){
        if(this.npcTabs.length < UGCModel.getInstance().npcList.length){
            for(let i = this.npcTabs.length ; i < UGCModel.getInstance().npcList.length ; i++){
                let npcTab = instantiate(this.npcTabCell);
                npcTab.parent = this.npcTabCell.parent;
                npcTab.active = true;
                this.npcTabs.push(npcTab);
            }   
        }
        for(let u = 0 ; u < this.npcTabs.length ; u++){
            if(u < UGCModel.getInstance().npcList.length){
                this.npcTabs[u].active = true;
                let npcInfo = UGCModel.getInstance().npcList[u];
                this.npcTabs[u].getComponent(CreateNpcNameCell).refreshNpcInfoEditImg(npcInfo, this);
            } else {
                this.npcTabs[u].active = false;
            }
        }
    }

    /** 模式 B：AI 外貌描述文生图 */
    onClickAIText(){
        if (!this.chooseNpcId) {
            EventSystem.send("ShowTips", "Please select an NPC first");
            return;
        }
        const desc = (this.editBox?.string || this.getOpenParam().appearance || "").trim();
        if (!desc) {
            EventSystem.send("ShowTips", "Please enter a appearance description");
            return;
        }
        const name = this.getNpcName();
        if (!name) {
            EventSystem.send("ShowTips", "Invalid NPC name");
            return;
        }

        this.beginPortraitGeneration();
        UGCModel.getInstance().generateNpcCharacterByText(this.chooseNpcId, name, desc).then((resp: any) => {
            this.handleStandeeSubmitResponse(resp);
        }).catch(() => {
            this.endPortraitGeneration();
        }); 
    }

    onClickNext(){
        if (!this.chooseNpcId) {
            EventSystem.send("ShowTips", "Please select the NPC first.");
            return;
        }
        if (!this.hasNpcStandeePortrait(this.chooseNpcId)) {
            EventSystem.send("ShowTips", "Please generate the NPC standee portrait first.");
            return;
        }
        if (this.confirmNode) {
            this.confirmNode.active = true;
        }
    }

    onClickCloseNext(){
        this.confirmNode.active = false
    }

    onClickConfirm(){
        if (this.confirmNode) {
            this.confirmNode.active = false;
        }
        if (!this.chooseNpcId) {
            EventSystem.send("ShowTips", "Please select an NPC first.");
            return;
        }
        if (!this.hasNpcStandeePortrait(this.chooseNpcId)) {
            EventSystem.send("ShowTips", "Please generate the NPC character art first.");
            return;
        }

        const ugc = UGCModel.getInstance();
        const npc = ugc.getNpcById(this.chooseNpcId);
        if (!npc) {
            EventSystem.send("ShowTips", "NPC does not exist");
            return;
        }

        const name = this.getNpcName();
        const referenceImageUrl = ugc.getStandeeReferenceImageUrl(this.chooseNpcId);
        if (!referenceImageUrl) {
            EventSystem.send("ShowTips", "Invalid standee preview URL");
            return;
        }

        const mapName = ugc.mapData?.map_name || "";

        ugc.generateNpcSpriteFrames(this.chooseNpcId, name, referenceImageUrl).then((resp: any) => {
            if (!this.isSpriteFramesGenerateSuccess(resp)) {
                EventSystem.send("ShowTips", String(resp?.message || resp?.error || "Sequence frame generation failed"));
                return;
            }

            ugc.setNpcSpriteGeneratingStatus(this.chooseNpcId, 1);

            const updatedNpc = ugc.getNpcById(this.chooseNpcId) ?? npc;
            const tipsPayload = Object.assign(
                {},
                updatedNpc,
                this.getOpenParam(),
                { mapName, sprite_generating_status: 1 },
            );

            if (resp?.message) {
                EventSystem.send("ShowTips", String(resp.message));
            }

            ugc.listMyNpcs();

            AppConst.PanelManager.CloseViewByUrl("res/View/CreateMap/EditNpcImg");
            AppConst.PanelManager.CloseViewByUrl("res/View/CreateMap/CreateNpc");
            AppConst.PanelManager.openView("res/View/CreateMap/NPCTips", tipsPayload);
        }).catch(() => undefined);
    }

    private isSpriteFramesGenerateSuccess(resp: any): boolean {
        if (!resp || resp.error) {
            return false;
        }
        if (resp.ok === false || resp.success === false) {
            return false;
        }
        if (resp.ok === true || resp.success === true) {
            return true;
        }
        return !!String(resp?.message ?? "").trim();
    }

    /** 模式 A：本机参考图图生图 */
    onClickAIImg(){
        if (!this.chooseNpcId) {
            EventSystem.send("ShowTips", "Please select the NPC first.");
            return;
        }
        if (!this.localImageLoader?.hasSelectedImage()) {
            EventSystem.send("ShowTips", "Please upload a reference image first.");
            return;
        }
        if (!this.isUploadImageSizeValid()) {
            EventSystem.send(
                "ShowTips",
                `Uploaded image cannot be smaller than ${MIN_UPLOAD_IMAGE_WIDTH}×${MIN_UPLOAD_IMAGE_HEIGHT}`,
            );
            return;
        }
        const dataUrl = this.localImageLoader.getSelectedDataUrl();
        const name = this.getNpcName();
        if (!name) {
            EventSystem.send("ShowTips", "Invalid NPC name");
            return;
        }

        this.beginPortraitGeneration();
        UGCModel.getInstance().generateNpcCharacterByReference(this.chooseNpcId, name, dataUrl).then((resp: any) => {
            this.handleStandeeSubmitResponse(resp);
        }).catch(() => {
            this.endPortraitGeneration();
        });
    }

    /** 重新请求 AI 生成当前 NPC 的人设数据（含 appearance） */
    onClickNewNpc(){
        const npcId = this.chooseNpcId;
        if (!npcId) {
            EventSystem.send("ShowTips", "Please select an NPC first.");
            return;
        }
        const npc = UGCModel.getInstance().getNpcById(npcId);
        if (!npc) {
            EventSystem.send("ShowTips", "NPC does not exist");
            return;
        }

        this.waitNode.active = true;
        UGCModel.getInstance().generateAICharacter(npcId).then((resp: any) => {
            if (!resp?.ok || !resp?.data) {
                EventSystem.send("ShowTips", "AI generation failed");
                this.waitNode.active = false;
                return;
            }
            this.waitNode.active = false;
            const aiData = resp.data;
            UGCModel.getInstance().applyAICharacterToNpc(npcId, aiData);
            this.applyAIDataToView(aiData);
        }).catch(() => {
            this.waitNode.active = false;
        });
    }

    private applyAIDataToView(aiData: Record<string, unknown>) {
        const appearance = String(aiData.appearance ?? "");
        if (this.editBox) {
            this.editBox.string = appearance;
        }
        const openParam = this.getOpenParam();
        Object.assign(openParam, aiData, { appearance });

        const npc = UGCModel.getInstance().getNpcById(this.chooseNpcId);
        if (npc) {
            npc.portrait_url = "";
            npc.model_url = "";
            npc.standee_url = "";
        }
        openParam.portrait_url = "";
        openParam.model_url = "";
        openParam.standee_url = "";
        UGCModel.getInstance().saveNpcListToLocal();
        if (this.lihui) {
            this.lihui.spriteFrame = null;
        }
    }

    onDestroy() {
        this.standeePollAborted = true;
        this.stopStandeePolling();
        EventSystem.remove(this);
    }

    private onChooseNpcTab(npcId: number) {
        const id = Number(npcId);
        if (!Number.isFinite(id) || id <= 0) {
            return;
        }
        this.chooseNpcId = id;
        this.refreshTabNpc();
        const npc = UGCModel.getInstance().getNpcById(id);
        const openParam = this.getOpenParam();
        if (openParam) {
            openParam.id = id;
        }
        if (this.editBox) {
            this.editBox.string = String(npc?.appearance ?? openParam?.appearance ?? "");
        }
        const portraitUrl = this.extractPortraitUrlFromNpc(npc ?? openParam);
        if (portraitUrl) {
            this.displayPortraitUrl(portraitUrl);
        } else if (this.lihui) {
            this.lihui.spriteFrame = null;
        }
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

    /** 文生图 / 图生图提交响应：含 task_id 则轮询，否则走同步结果 */
    private handleStandeeSubmitResponse(resp: any) {
        if (!resp?.ok) {
            this.endPortraitGeneration();
            const msg = resp?.error || resp?.message;
            if (msg) {
                EventSystem.send("ShowTips", String(msg));
            }
            return;
        }

        const status = String(resp?.status ?? "").toLowerCase();
        if (status === "completed" || status === "complete") {
            this.endPortraitGeneration();
            this.onStandeeTaskCompleted(resp);
            return;
        }

        const taskId = String(resp?.task_id ?? "").trim();
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
            EventSystem.send("ShowTips", "Standee generation timed out, please try again later");
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
                EventSystem.send("ShowTips", String(resp?.message || resp?.error || "Standee generation failed"));
                return;
            }

            const status = String(resp?.status ?? "").toLowerCase();
            if (status === "completed" || status === "complete") {
                this.endPortraitGeneration();
                this.onStandeeTaskCompleted(resp);
                return;
            }

            if (status === "failed" || status === "error") {
                this.endPortraitGeneration();
                EventSystem.send("ShowTips", String(resp?.message || resp?.error || "Standee generation failed"));
                return;
            }

            this.scheduleStandeePoll(taskId);
        } catch {
            this.endPortraitGeneration();
        }
    }

    /** 轮询完成：使用 result.standee_url 刷新立绘 */
    private onStandeeTaskCompleted(resp: any) {
        const standeeUrl = this.extractStandeeUrlFromResponse(resp);
        if (standeeUrl) {
            const compositeNpcId = String(resp?.result?.npc_id ?? "").trim();
            UGCModel.getInstance().applyStandeeUrlToNpc(
                this.chooseNpcId,
                standeeUrl,
                compositeNpcId || undefined,
            );
            this.syncOpenParamPortrait(standeeUrl);
            this.displayPortraitUrl(standeeUrl);
            return;
        }
        this.onPortraitGenerated(resp);
    }

    private extractStandeeUrlFromResponse(resp: any): string {
        const result = resp?.result ?? resp?.data?.result ?? resp?.data;
        return String(
            result?.standee_url ??
            result?.preview_url ??
            resp?.standee_url ??
            ""
        ).trim();
    }

    private onPortraitGenerated(resp: any) {
        if (resp?.ok === false || resp?.success === false) {
            const msg = resp?.error || resp?.message;
            if (msg) {
                EventSystem.send("ShowTips", String(msg));
            }
            return;
        }

        const { url, dataUrl } = this.extractPortraitFromResponse(resp);
        if (!url && !dataUrl) {
            EventSystem.send("ShowTips", "Image generation in progress");
            return;
        }

        if (url) {
            UGCModel.getInstance().applyStandeeUrlToNpc(this.chooseNpcId, url);
            this.syncOpenParamPortrait(url);
            this.displayPortraitUrl(url);
        } else if (dataUrl) {
            this.displayPortraitDataUrl(dataUrl);
        }
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
            ""
        ).trim();

        let rawBase64 = String(
            data?.image_base64 ??
            data?.base64 ??
            data?.portrait_base64 ??
            ""
        ).trim();

        if (rawBase64 && !rawBase64.startsWith("data:")) {
            rawBase64 = `data:image/png;base64,${rawBase64}`;
        }

        return {
            url: url || undefined,
            dataUrl: rawBase64 || undefined,
        };
    }

    private extractPortraitUrlFromNpc(npc: any): string {
        if (!npc) return "";
        return String(
            npc.model_url ?? npc.standee_url ?? npc.portrait_url ?? npc.image_url ?? ""
        ).trim();
    }

    /** 是否已生成立绘（以 model_url / standee_url 等为准） */
    private hasNpcStandeePortrait(npcId?: number): boolean {
        const id = npcId ?? this.chooseNpcId;
        if (!id) {
            return false;
        }
        const npc = UGCModel.getInstance().getNpcById(id);
        return this.extractPortraitUrlFromNpc(npc ?? this.getOpenParam()).length > 0;
    }

    private syncOpenParamPortrait(url: string) {
        const openParam = this.getOpenParam();
        if (!openParam) {
            return;
        }
        openParam.model_url = url;
        openParam.standee_url = url;
        openParam.portrait_url = url;
    }

    private appendCacheBust(url: string): string {
        const sep = url.includes("?") ? "&" : "?";
        return `${url}${sep}_t=${Date.now()}`;
    }

    private resolveRemoteImageUrl(url: string): string {
        const raw = String(url || "").trim();
        if (!raw) {
            return "";
        }
        if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
            return raw;
        }
        return HttpManager.baseUrl + (raw.startsWith("/") ? raw : `/${raw}`);
    }

    private displayPortraitUrl(url: string) {
        if (!url || !this.lihui?.isValid) {
            return;
        }
        this.lihui.enabled = true;
        const fullUrl = this.appendCacheBust(this.resolveRemoteImageUrl(url));
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
            if (!this.lihui?.isValid) {
                return;
            }
            const imgAsset = new ImageAsset(image);
            const texture = new Texture2D();
            texture.image = imgAsset;
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;
            this.lihui.spriteFrame = spriteFrame;
            this.lihui.sizeMode = Sprite.SizeMode.TRIMMED;
            const ui = this.lihui.getComponent(UITransform);
            if (ui && imgAsset.width > 0 && imgAsset.height > 0) {
                const maxW = ui.width > 0 ? ui.width : 512;
                const maxH = ui.height > 0 ? ui.height : 512;
                const scale = Math.min(maxW / imgAsset.width, maxH / imgAsset.height, 1);
                ui.setContentSize(imgAsset.width * scale, imgAsset.height * scale);
            }
        };
        image.onerror = () => {
            console.warn("[EditNpcImg] 立绘图 Image 加载失败，尝试 loadCover", fullUrl);
            Utils.loadCover(fullUrl, this.lihui);
        };
        image.src = fullUrl;
    }

    private displayPortraitDataUrl(dataURL: string) {
        if (!dataURL || !this.lihui?.isValid) {
            return;
        }
        const image = new Image();
        image.onload = () => {
            if (!this.lihui?.isValid) {
                return;
            }
            const imgAsset = new ImageAsset(image);
            const texture = new Texture2D();
            texture.image = imgAsset;
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = texture;
            this.lihui.spriteFrame = spriteFrame;
            this.lihui.sizeMode = Sprite.SizeMode.TRIMMED;
        };
        image.onerror = () => {
            console.error("[EditNpcImg] 立绘图加载失败");
        };
        image.src = dataURL;
    }

}
