import {
    _decorator,
    ImageAsset,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';
import { HttpManager } from '../../Manager/HttpManager';
import { RoleModel } from '../../Model/RoleModel';
import { UGCModel } from '../../Model/UGCModel';
import { Utils } from '../../Utils/Utils';
import { CreateNpcNewStepBase } from './CreateNpcNewStepBase';
const { ccclass, property } = _decorator;

/** tips 节点：逻辑仿 NPCTips，组件自行绑定 */
@ccclass('CreateNpcNewTipsStep')
export class CreateNpcNewTipsStep extends CreateNpcNewStepBase {
    @property(Label)
    npcNameLabel: Label = null;

    @property(Label)
    genderLabel: Label = null;

    @property(Label)
    mbtiLabel: Label = null;

    @property(Label)
    worldName: Label = null;

    @property(Label)
    personality: Label = null;

    @property(Label)
    experences: Label = null;

    @property(Sprite)
    lihui: Sprite = null;

    @property([Label])
    habits: Label[] = [];

    @property([Label])
    characteristics: Label[] = [];

    /** 生成中提示文案（可选） */
    @property(Label)
    tipsLabel: Label = null;

    @property(Node)
    generatingNode: Node = null;

    @property(Node)
    loadingImgNode : Node        

    private pollTimer: ReturnType<typeof setTimeout> | null = null;
    private polling = false;

    onStepShow() {
        this.refreshFromServer();
        EventSystem.addListent('OnRefreshMyNpcList', this.onNpcListRefreshed, this);
    }

    onStepHide() {
        this.stopPolling();
        EventSystem.remove(this);
    }

    /** listMyNpcs 回包后仅从本地列表刷新，避免再次请求接口 */
    onNpcListRefreshed() {
        this.tryRefreshFromLocalCache();
    }

    refreshFromServer() {
        const npcId = this.getNpcId();
        if (!npcId) {
            return;
        }

        const ugc = UGCModel.getInstance();
        const cached = ugc.getNpcById(npcId);
        const mapId = Number(
            cached?.map_id ?? ugc.mapData?.id ?? 0,
        );
        const mapName = String(ugc.mapData?.map_name ?? '');

        if (cached && this.isSpriteReady(cached)) {
            this.stopPolling();
            this.refresh(Object.assign({}, cached, { mapName }));
            return;
        }

        if (cached) {
            this.refresh(Object.assign({}, cached, { mapName }));
        }

        this.showGenerating(true);
        ugc.requestGetNpcById(npcId, mapId).then((npc) => {
            if (!this.node?.isValid) {
                return;
            }
            if (!npc) {
                this.startPollingIfNeeded(cached);
                return;
            }
            if (this.isSpriteReady(npc)) {
                this.stopPolling();
                this.showGenerating(false);
                this.refresh(Object.assign({}, npc, { mapName }));
            } else {
                this.refresh(Object.assign({}, npc, { mapName }));
                this.startPollingIfNeeded(npc);
            }
        }).catch(() => {
            this.startPollingIfNeeded(cached);
        });
    }

    private tryRefreshFromLocalCache() {
        const npcId = this.getNpcId();
        if (!npcId) {
            return;
        }
        const ugc = UGCModel.getInstance();
        const npc = ugc.getNpcById(npcId);
        if (!npc) {
            return;
        }
        const mapName = String(ugc.mapData?.map_name ?? '');
        this.refresh(Object.assign({}, npc, { mapName }));
        if (this.isSpriteReady(npc)) {
            this.stopPolling();
            this.showGenerating(false);
        }
    }

    onClickBack() {
        this.getFlow()?.exitToHome();
    }

    onClickFinish() {
        this.getFlow()?.exitToHome();
    }

    private getNpcId(): number {
        return Number(this.getFlow()?.getDraft()?.npcId ?? 0);
    }

    private isSpriteReady(npc: any): boolean {
        if (!npc) {
            return false;
        }
        const status = Number(npc.sprite_generating_status ?? 0);
        if (status === 2) {
            return true;
        }
        return !!String(npc.npc_sprite_url ?? '').trim();
    }

    private showGenerating(visible: boolean) {
        if (this.generatingNode) {
            this.generatingNode.active = visible;
        }
        if (this.tipsLabel && visible) {
            this.tipsLabel.string = 'Generating sprite frames...';
        }
    }

    private startPollingIfNeeded(npc: any) {
        if (this.isSpriteReady(npc)) {
            this.stopPolling();
            this.showGenerating(false);
            return;
        }
        if (this.polling) {
            return;
        }
        this.polling = true;
        this.showGenerating(true);
        this.schedulePoll();
    }

    private schedulePoll() {
        if (!this.polling || !this.node?.isValid) {
            return;
        }
        this.pollTimer = setTimeout(() => {
            this.pollTimer = null;
            if (!this.polling || !this.node?.isValid) {
                return;
            }
            UGCModel.getInstance().listMyNpcs(false);
            this.schedulePoll();
        }, 3000);
    }

    private stopPolling() {
        this.polling = false;
        if (this.pollTimer != null) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
    }

    private refresh(npcInfo: any) {
        if (!npcInfo) {
            return;
        }

        const ready = this.isSpriteReady(npcInfo);
        this.showGenerating(!ready);

        if (this.npcNameLabel) {
            this.npcNameLabel.string = String(npcInfo.name || '');
        }

        const sex = Number(npcInfo.sex);
        const sexText = sex === 0 ? 'Man' : sex === 1 ? 'Woman' : sex === 2 ? 'Other' : '';
        if (this.genderLabel) {
            this.genderLabel.string = sexText;
        }

        if (this.mbtiLabel) {
            this.mbtiLabel.string = this.resolveTagNameById(Number(npcInfo.mbti), 5);
        }

        if (this.worldName) {
            this.worldName.string = String(npcInfo.mapName || npcInfo.map_name || '');
        }

        if (this.personality) {
            this.personality.string = String(npcInfo.info || '');
        }

        if (this.experences) {
            this.experences.string = String(npcInfo.past_experiences || '');
        }

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
        const raw = String(url || '').trim();
        if (!raw) {
            return '';
        }
        if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
            return raw;
        }
        return HttpManager.baseUrl + (raw.startsWith('/') ? raw : `/${raw}`);
    }

    private displayPortraitUrl(url: string) {
        if (!url || !this.lihui?.isValid) {
            return;
        }
        this.lihui.enabled = true;
        const fullUrl = this.resolveRemoteImageUrl(url);
        const image = new Image();
        image.crossOrigin = 'anonymous';
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
            this.loadingImgNode.active = false
            Utils.loadCover(fullUrl, this.lihui , null , null , this.loadingImgNode);
        };
        image.src = fullUrl;
    }

    private resolveTagNameById(id: number, tagType: number): string {
        if (!Number.isFinite(id) || id <= 0) {
            return '';
        }
        const tags = RoleModel.getInstance()?.tags || [];
        for (let i = 0; i < tags.length; i++) {
            const t = tags[i];
            if (!t) {
                continue;
            }
            if (Number(t.tag_type) === tagType && Number(t.id) === id) {
                return String(t.tag_name || '');
            }
        }
        return String(id);
    }

    private parseIdArray(maybe: any): number[] {
        if (maybe == null) {
            return [];
        }
        if (Array.isArray(maybe)) {
            return maybe.map((v) => Number(v)).filter((n) => Number.isFinite(n));
        }
        if (typeof maybe === 'string') {
            const s = maybe.trim();
            if (!s) {
                return [];
            }
            if (s.startsWith('[') && s.endsWith(']')) {
                try {
                    const arr = JSON.parse(s);
                    if (Array.isArray(arr)) {
                        return arr.map((v) => Number(v)).filter((n) => Number.isFinite(n));
                    }
                } catch {
                    // fallthrough
                }
            }
            const nums = s.match(/\d+/g) || [];
            return nums.map((v) => Number(v)).filter((n) => Number.isFinite(n));
        }
        if (typeof maybe === 'number') {
            return Number.isFinite(maybe) ? [maybe] : [];
        }
        return [];
    }

    private resolveHobbiesNames(hobbies: any): string {
        const ids = this.parseIdArray(hobbies);
        if (ids.length <= 0) {
            return '';
        }
        const tags = RoleModel.getInstance()?.tags || [];
        const names: string[] = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            let name = '';
            for (let j = 0; j < tags.length; j++) {
                const t = tags[j];
                if (!t) {
                    continue;
                }
                if (Number(t.tag_type) === 7 && Number(t.id) === id) {
                    name = String(t.tag_name || '');
                    break;
                }
            }
            names.push(name || String(id));
        }
        return names.join('、');
    }

    private resolveCharacteristicsNames(characteristics: any): string {
        const ids = this.parseIdArray(characteristics);
        if (ids.length <= 0) {
            return '';
        }
        const tags = RoleModel.getInstance()?.tags || [];
        const names: string[] = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            let name = '';
            for (let j = 0; j < tags.length; j++) {
                const t = tags[j];
                if (!t) {
                    continue;
                }
                if (Number(t.tag_type) === 2 && Number(t.id) === id) {
                    name = String(t.tag_name || '');
                    break;
                }
            }
            names.push(name || String(id));
        }
        return names.join('、');
    }

    private parseStringList(maybe: any): string[] {
        if (maybe == null) {
            return [];
        }
        if (Array.isArray(maybe)) {
            return maybe.map((v) => String(v || '').trim()).filter(Boolean);
        }
        if (typeof maybe === 'string') {
            const s = maybe.trim();
            if (!s) {
                return [];
            }
            if (s.startsWith('[') && s.endsWith(']')) {
                try {
                    const arr = JSON.parse(s);
                    if (Array.isArray(arr)) {
                        return arr.map((v) => String(v || '').trim()).filter(Boolean);
                    }
                } catch {
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
            if (!lb) {
                continue;
            }
            const v = list[i] || '';
            lb.string = v;
            if (lb.node) {
                lb.node.active = !!v;
            }
        }
    }

    private renderCharacteristics(characteristics: any) {
        const list = this.parseStringList(characteristics);
        for (let i = 0; i < this.characteristics.length; i++) {
            const lb = this.characteristics[i];
            if (!lb) {
                continue;
            }
            const v = list[i] || '';
            lb.string = v;
            if (lb.node) {
                lb.node.active = !!v;
            }
        }
    }
}
