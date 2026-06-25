import { _decorator, ImageAsset, Node, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { HttpManager } from '../../Manager/HttpManager';
import { UGCModel } from '../../Model/UGCModel';
import { Utils } from '../../Utils/Utils';
import { CreateNpcNewStepBase } from './CreateNpcNewStepBase';
const { ccclass, property } = _decorator;

/** lihui 节点：预览已生成立绘，确认后提交序列帧生成 */
@ccclass('CreateNpcNewLihuiStep')
export class CreateNpcNewLihuiStep extends CreateNpcNewStepBase {
    @property(Sprite)
    lihui: Sprite = null;

    @property(Node)
    waitNode: Node = null;

    @property(Node)
    loadingImgNode : Node

    private submitting = false;

    onStepShow() {
        if (this.waitNode) {
            this.waitNode.active = false;
        }
        this.refreshStandee();
    }

    onStepHide() {
        this.submitting = false;
        if (this.waitNode) {
            this.waitNode.active = false;
        }
    }

    onClickBack() {
        this.getFlow()?.exitToHome();
    }

    onClickConfirm() {
        if (this.submitting) {
            return;
        }
        const npcId = this.getNpcId();
        if (!npcId) {
            EventSystem.send('ShowTips', 'Please select an NPC first.');
            return;
        }
        if (!this.hasStandeePortrait()) {
            EventSystem.send('ShowTips', 'Please generate the NPC standee portrait first.');
            return;
        }

        const ugc = UGCModel.getInstance();
        const npc = ugc.getNpcById(npcId);
        if (!npc) {
            EventSystem.send('ShowTips', 'NPC does not exist');
            return;
        }

        const name = this.getNpcName();
        const referenceImageUrl = ugc.getStandeeReferenceImageUrl(npcId);
        if (!referenceImageUrl) {
            EventSystem.send('ShowTips', 'Invalid standee preview URL');
            return;
        }

        this.submitting = true;
        if (this.waitNode) {
            this.waitNode.active = true;
        }

        ugc.generateNpcSpriteFrames(npcId, name, referenceImageUrl)
            .then((resp: any) => {
                this.submitting = false;
                if (this.waitNode) {
                    this.waitNode.active = false;
                }
                if (!this.isSpriteFramesGenerateSuccess(resp)) {
                    EventSystem.send(
                        'ShowTips',
                        String(resp?.message || resp?.error || 'Sequence frame generation failed'),
                    );
                    return;
                }

                ugc.setNpcSpriteGeneratingStatus(npcId, 1);

                if (resp?.message) {
                    EventSystem.send('ShowTips', String(resp.message));
                }

                ugc.listMyNpcs(false);
                this.getFlow()?.goToTipsForCurrentNpc();
            })
            .catch(() => {
                this.submitting = false;
                if (this.waitNode) {
                    this.waitNode.active = false;
                }
            });
    }

    private getNpcId(): number {
        return Number(this.getFlow()?.getDraft()?.npcId ?? 0);
    }

    private getNpcName(): string {
        const draftName = String(this.getFlow()?.getDraft()?.name ?? '').trim();
        if (draftName) {
            return draftName;
        }
        const npc = UGCModel.getInstance().getNpcById(this.getNpcId());
        return String(npc?.name ?? '');
    }

    private refreshStandee() {
        const npcId = this.getNpcId();
        if (!npcId) {
            return;
        }
        const npc = UGCModel.getInstance().getNpcById(npcId);
        const url = this.extractPortraitUrlFromNpc(npc);
        if (url) {
            this.displayPortraitUrl(url);
        } else if (this.lihui) {
            this.lihui.spriteFrame = null;
        }
    }

    private hasStandeePortrait(): boolean {
        const npcId = this.getNpcId();
        if (!npcId) {
            return false;
        }
        const npc = UGCModel.getInstance().getNpcById(npcId);
        return this.extractPortraitUrlFromNpc(npc).length > 0;
    }

    private extractPortraitUrlFromNpc(npc: any): string {
        if (!npc) {
            return '';
        }
        return String(
            npc.model_url ?? npc.standee_url ?? npc.portrait_url ?? npc.image_url ?? '',
        ).trim();
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
        const fullUrl = this.appendCacheBust(this.resolveRemoteImageUrl(url));
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
            this.loadingImgNode.active = false
        };
        image.onerror = () => {
            Utils.loadCover(fullUrl, this.lihui , null , null , this.loadingImgNode);
        };
        image.src = fullUrl;
    }

    private appendCacheBust(url: string): string {
        const sep = url.includes('?') ? '&' : '?';
        return `${url}${sep}_t=${Date.now()}`;
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
        return !!String(resp?.message ?? '').trim();
    }
}
