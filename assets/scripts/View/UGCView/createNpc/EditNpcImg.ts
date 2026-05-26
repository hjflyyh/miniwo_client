import { _decorator, Component, EditBox, ImageAsset, instantiate, Node, Sprite, SpriteFrame, Texture2D } from 'cc';
import { UGCModel } from '../../../Model/UGCModel';
import { CreateNpcNameCell } from '../CreateNpcNameCell';
import { LoadLocalImage } from '../../../Utils/LoadLocalImage';
import { Utils } from '../../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('EditNpcImg')
export class EditNpcImg extends Component {
    private npcTabs : Node[] = [];

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

    public chooseNpcId = 0;

    start() {
        if (!this.localImageLoader) {
            this.localImageLoader = this.node.getComponentInChildren(LoadLocalImage);
        }

        this.waitNode.active = false;

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
    }

    private getOpenParam(): any {
        return (this.node as any)["_openParam"] || {};
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
        const desc = (this.editBox?.string || this.getOpenParam().appearance || "").trim();
        if (!desc) {
            EventSystem.send("ShowTips", "请输入外貌描述");
            return;
        }
        const name = this.getNpcName();
        if (!name) {
            EventSystem.send("ShowTips", "NPC 名称无效");
            return;
        }

        UGCModel.getInstance().generateNpcCharacterByText(name, desc).then((resp: any) => {
            this.onPortraitGenerated(resp);
        }).catch(() => undefined);
    }

    /** 模式 A：本机参考图图生图 */
    onClickAIImg(){
        const dataUrl = this.localImageLoader?.getSelectedDataUrl() || "";
        if (!dataUrl) {
            EventSystem.send("ShowTips", "请先上传参考图");
            return;
        }
        const name = this.getNpcName();
        if (!name) {
            EventSystem.send("ShowTips", "NPC 名称无效");
            return;
        }

        UGCModel.getInstance().generateNpcCharacterByReference(name, dataUrl).then((resp: any) => {
            this.onPortraitGenerated(resp);
        }).catch(() => undefined);
    }

    /** 重新请求 AI 生成当前 NPC 的人设数据（含 appearance） */
    onClickNewNpc(){
        const npcId = this.chooseNpcId;
        if (!npcId) {
            EventSystem.send("ShowTips", "请先选择NPC");
            return;
        }
        const npc = UGCModel.getInstance().getNpcById(npcId);
        if (!npc) {
            EventSystem.send("ShowTips", "NPC不存在");
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
        }
        openParam.portrait_url = "";
        openParam.model_url = "";
        if (this.lihui) {
            this.lihui.spriteFrame = null;
        }
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
            EventSystem.send("ShowTips", "生图失败，未返回图片");
            return;
        }

        if (url) {
            this.displayPortraitUrl(url);
            this.savePortraitToNpc(url);
        } else if (dataUrl) {
            this.displayPortraitDataUrl(dataUrl);
        }
    }

    private extractPortraitFromResponse(resp: any): { url?: string; dataUrl?: string } {
        const data = resp?.data ?? resp;
        const url = String(
            data?.portrait_url ??
            data?.image_url ??
            data?.model_url ??
            data?.url ??
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
            npc.portrait_url ?? npc.model_url ?? npc.image_url ?? ""
        ).trim();
    }

    private displayPortraitUrl(url: string) {
        if (!url || !this.lihui) return;
        Utils.loadCover(url, this.lihui);
    }

    private displayPortraitDataUrl(dataURL: string) {
        if (!dataURL || !this.lihui?.isValid) return;
        const image = new Image();
        image.onload = () => {
            if (!this.lihui?.isValid) return;
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

    private savePortraitToNpc(url: string) {
        const npc = UGCModel.getInstance().getNpcById(this.chooseNpcId);
        if (!npc) return;
        npc.model_url = url;
        npc.portrait_url = url;
        const openParam = this.getOpenParam();
        if (openParam) {
            openParam.model_url = url;
            openParam.portrait_url = url;
        }
    }
}
