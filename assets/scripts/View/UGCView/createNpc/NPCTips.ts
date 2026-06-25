import { _decorator, Component, ImageAsset, Label, Sprite, SpriteFrame, Texture2D, UITransform , Node} from 'cc';
import { RoleModel } from '../../../Model/RoleModel';
import { HttpManager } from '../../../Manager/HttpManager';
import { UGCModel } from '../../../Model/UGCModel';
import { Utils } from '../../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('NPCTips')
export class NPCTips extends Component {
    @property(Label)
    public npcNameLabel : Label = null;

    @property(Label)
    public genderLabel : Label = null;    

    @property(Label)
    public mbtiLabel : Label = null;  

    @property(Label)
    public worldName : Label = null; 

    @property(Label)
    public personality : Label = null;  

    @property(Label)
    public experences : Label = null;      

    @property(Sprite)
    public lihui: Sprite = null;

    @property([Label])
    public habits : Label[] = [];  

    //Characteristics
    @property(Node)
    loadingImgNode : Node    

    @property([Label])
    public characteristics : Label[] = [];  

    start() {
        const openParam = (this.node as any)["_openParam"] || {};
        const npcId = Number(openParam.id ?? openParam.npc_id);
        const mapId = Number(
            openParam.map_id ?? openParam.mapId ?? UGCModel.getInstance().mapData?.id ?? 0,
        );
        const mapName = String(
            openParam.mapName ?? openParam.map_name ?? UGCModel.getInstance().mapData?.map_name ?? "",
        );

        if (!Number.isFinite(npcId) || npcId <= 0) {
            this.refresh(openParam);
            return;
        }

        UGCModel.getInstance().requestGetNpcById(npcId, mapId).then((npc) => {
            if (!this.isValid) {
                return;
            }
            if (!npc) {
                EventSystem.send("ShowTips", "Failed to load NPC details");
                this.refresh(openParam);
                return;
            }
            this.refresh(Object.assign({}, openParam, npc, { mapName }));
        }).catch(() => {
            if (this.isValid) {
                this.refresh(openParam);
            }
        });
    }

    private refresh(npcInfo: any) {
        if (!npcInfo) return;

        this.npcNameLabel && (this.npcNameLabel.string = String(npcInfo.name || ""));

        const sex = Number(npcInfo.sex);
        const sexText = sex === 0 ? "Man" : (sex === 1 ? "Woman" : (sex === 2 ? "Other" : ""));
        this.genderLabel && (this.genderLabel.string = sexText);

        this.mbtiLabel && (this.mbtiLabel.string = this.resolveTagNameById(Number(npcInfo.mbti), 5));

        // worldName：由 UGCNpcInfoCell 打开时补充的地图名
        this.worldName && (this.worldName.string = String(npcInfo.mapName || npcInfo.map_name || ""));

        // personality 对应：info
        this.personality && (this.personality.string = String(npcInfo.info || ""));

        this.experences && (this.experences.string = String(npcInfo.past_experiences || ""));

        const rensheNames = this.resolveHobbiesNames(npcInfo.hobbies);
        this.renderHabits(rensheNames);

        const characteristics = this.resolveCharacteristicsNames(npcInfo.characteristics);
        this.renderCharacteristics(characteristics);

        const portraitUrl = npcInfo.model_url
        if (portraitUrl) {
            this.displayPortraitUrl(portraitUrl);
        } else if (this.lihui) {
            this.lihui.spriteFrame = null;
        }
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
        const fullUrl = this.resolveRemoteImageUrl(url);
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
            this.loadingImgNode.active = false
        };
        image.onerror = () => {
            Utils.loadCover(fullUrl, this.lihui , null , null , this.loadingImgNode);
        };
        image.src = fullUrl;
    }

    private resolveTagNameById(id: number, tagType: number): string {
        if (!Number.isFinite(id) || id <= 0) return "";
        const tags = RoleModel.getInstance()?.tags || [];
        for (let i = 0; i < tags.length; i++) {
            const t = tags[i];
            if (!t) continue;
            if (Number(t.tag_type) === tagType && Number(t.id) === id) {
                return String(t.tag_name || "");
            }
        }
        // 找不到就退回显示 id
        return String(id);
    }

    private parseIdArray(maybe: any): number[] {
        if (maybe == null) return [];
        if (Array.isArray(maybe)) {
            return maybe.map((v) => Number(v)).filter((n) => Number.isFinite(n));
        }
        if (typeof maybe === "string") {
            const s = maybe.trim();
            if (!s) return [];
            // JSON 数组："[1,2]"
            if (s.startsWith("[") && s.endsWith("]")) {
                try {
                    const arr = JSON.parse(s);
                    if (Array.isArray(arr)) {
                        return arr.map((v) => Number(v)).filter((n) => Number.isFinite(n));
                    }
                } catch (e) {
                    // fallthrough
                }
            }
            // 兜底：用非数字分隔提取数字
            const nums = s.match(/\d+/g) || [];
            return nums.map((v) => Number(v)).filter((n) => Number.isFinite(n));
        }
        if (typeof maybe === "number") {
            return Number.isFinite(maybe) ? [maybe] : [];
        }
        return [];
    }

    private resolveHobbiesNames(hobbies){
        const ids = this.parseIdArray(hobbies);
        if (ids.length <= 0) return "";
        const tags = RoleModel.getInstance()?.tags || [];
        const names: string[] = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            let name = "";
            for (let j = 0; j < tags.length; j++) {
                const t = tags[j];
                if (!t) continue;
                if (Number(t.tag_type) === 7 && Number(t.id) === id) {
                    name = String(t.tag_name || "");
                    break;
                }
            }
            names.push(name || String(id));
        }
        return names.join("、");
    }

    private resolveCharacteristicsNames(characteristics: any): string {
        const ids = this.parseIdArray(characteristics);
        if (ids.length <= 0) return "";
        const tags = RoleModel.getInstance()?.tags || [];
        const names: string[] = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            let name = "";
            for (let j = 0; j < tags.length; j++) {
                const t = tags[j];
                if (!t) continue;
                if (Number(t.tag_type) === 2 && Number(t.id) === id) {
                    name = String(t.tag_name || "");
                    break;
                }
            }
            names.push(name || String(id));
        }
        return names.join("、");
    }

    private parseStringList(maybe: any): string[] {
        if (maybe == null) return [];
        if (Array.isArray(maybe)) {
            return maybe.map((v) => String(v || "").trim()).filter(Boolean);
        }
        if (typeof maybe === "string") {
            const s = maybe.trim();
            if (!s) return [];
            if (s.startsWith("[") && s.endsWith("]")) {
                try {
                    const arr = JSON.parse(s);
                    if (Array.isArray(arr)) {
                        return arr.map((v) => String(v || "").trim()).filter(Boolean);
                    }
                } catch (e) {
                    // fallthrough
                }
            }
            return s.split(/[,，|｜、\n\r\t]+/g).map((v) => v.trim()).filter(Boolean);
        }
        return [String(maybe)].map((v) => v.trim()).filter(Boolean);
    }

    private renderHabits(hobbies: any) {
        const list = this.parseStringList(hobbies);
        for (let i = 0; i < this.habits.length; i++) {
            const lb = this.habits[i];
            if (!lb) continue;
            const v = list[i] || "";
            lb.string = v;
            if (lb.node) lb.node.active = !!v;
        }
    }

    private renderCharacteristics(characteristics: any) {
        const list = this.parseStringList(characteristics);
        for (let i = 0; i < this.characteristics.length; i++) {
            const lb = this.characteristics[i];
            if (!lb) continue;
            const v = list[i] || "";
            lb.string = v;
            if (lb.node) lb.node.active = !!v;
        }
    }
}

