import { _decorator, Component, EditBox, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { network } from '../../Model/RequestData';
import { RoleModel } from '../../Model/RoleModel';
import { HttpManager } from '../../Manager/HttpManager';
import { MapChatManager } from '../../Manager/ChatManager';
const { ccclass, property } = _decorator;

@ccclass('GameView')
export class GameView extends Component {
    @property(EditBox)
    editBox: EditBox = null!;

    start() {
        MapChatManager.instance.init();
    }

    public onClickChat(){
        if(this.editBox.string != ""){
            this.sendMapChat(this.editBox.string)
        }
    }

    // mapId: 传 <=0 也可以（服务端会用“当前所在地图”）
    private async sendMapChat(text: string, mapId: number = -1) {
        const t = (text ?? '').trim();
        if (!t) return { success: false, message: '消息不能为空' };
        // 服务端限制：<= 200 字（按 rune 计数更稳）
        if ([...t].length > 200) return { success: false, message: '消息内容过长（最多200字）' };
        const result = await this.rpc('map_chat_send_player', {
        map_id: mapId,
        text: t,
        });
        // 期望：{success:true, message_id:...} 或 {success:false, message:...}
        return result;
    }

    private async rpc(name: string, payload: any) {
        const base = HttpManager.chatBaseUrl.replace(/\/+$/, ''); // 去掉末尾 /
        const url = `${base}/v2/rpc/${name}`;

        const token = RoleModel.getInstance().nakama_token;
        if (!token) {
            throw new Error('nakama_token 为空，无法调用 RPC');
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            },
            body: JSON.stringify(JSON.stringify(payload ?? {})),
        });

        const raw = await res.text();
        if (!res.ok) {
            console.error('RPC failed', name, res.status, raw);
            throw new Error(`RPC ${name} HTTP ${res.status}: ${raw}`);
        }

        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error('RPC JSON parse error', name, raw);
            throw e;
        }
    }
}

