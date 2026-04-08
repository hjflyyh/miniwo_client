import { _decorator, Component, Label } from 'cc';
import { RoleModel } from '../../../Model/RoleModel';
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
    public background : Label = null;  

    @property(Label)
    public personality : Label = null;  

    @property(Label)
    public experences : Label = null;      



    @property([Label])
    public habits : Label[] = [];  
    start() {
        const npcInfo = (this.node as any)["_openParam"];
        this.refresh(npcInfo);
    }

    private refresh(npcInfo: any) {
        if (!npcInfo) return;

        this.npcNameLabel && (this.npcNameLabel.string = String(npcInfo.name || ""));

        const sex = Number(npcInfo.sex);
        const sexText = sex === 0 ? "男" : (sex === 1 ? "女" : (sex === 2 ? "其他" : ""));
        this.genderLabel && (this.genderLabel.string = sexText);

        this.mbtiLabel && (this.mbtiLabel.string = this.resolveTagNameById(Number(npcInfo.mbti), 5));

        // worldName：由 UGCNpcInfoCell 打开时补充的地图名
        this.worldName && (this.worldName.string = String(npcInfo.mapName || npcInfo.map_name || ""));

        this.background && (this.background.string = String(npcInfo.identity || ""));

        // personality 对应：info
        this.personality && (this.personality.string = String(npcInfo.info || ""));

        this.experences && (this.experences.string = String(npcInfo.past_experiences || ""));

        // habits 对应：characteristics（人设/性格特征）可能是 JSON 字符串，如 "[7]"
        const rensheNames = this.resolveCharacteristicsNames(npcInfo.characteristics);
        this.renderHabits(rensheNames);
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
}

