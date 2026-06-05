import { _decorator, Component, log, Node } from 'cc';
import { AppConst } from '../AppConst';
import { RoleModel } from '../Model/RoleModel';
import { HttpManager } from './HttpManager';
const { ccclass, property } = _decorator;

@ccclass('SocialHttpManager')
export class SocialHttpManager extends Component {
    start() {
        AppConst.SocialHttpManager = this
    }

    public getToken() {
        return RoleModel.getInstance().token
    }

    private getBaseUrl() {
        return "http://" + HttpManager.ipBase + ":8084"
    }

    public sendPostHttp(functionName, data) {
        console.log("post 请求参数：", data)
        EventSystem.send("ShowJuhua", "HttpSend")
        const request = fetch(this.getBaseUrl() + "/" + functionName, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${this.getToken()}`, // 核心：Bearer Token 鉴权
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
            .then(async res => {
                EventSystem.send("HideJuhua" ,"HttpSend")
                if (!res.ok) {
                    const raw = await res.text();
                    throw new Error(`Social POST ${functionName} HTTP ${res.status}: ${raw}`);
                }
                return res.json();
            })
            .then(data => {
                EventSystem.send("HideJuhua" ,"HttpSend")
                console.log("post 请求回复：", data)
                if (data.success && data.data) {
                    EventSystem.send("SocialHttpMessage", data.data)
                } else {
                    if (data.error) {
                        EventSystem.send("ShowTips", data.error)
                    }
                }
                return data;
            })
            .catch((err) => {
                EventSystem.send("HideJuhua" ,"HttpSend")
                const error = err instanceof Error ? err : new Error(String(err));
                EventSystem.send("ShowTips", "Network request failed. Please try again later.");
                EventSystem.send("HttpError", error);
                throw error;
            })
        request.catch(() => undefined)
        return request
    }

    public sendGetHttp(functionName, data) {
        let queryMap = []
        for (let key in data) {
            queryMap.push([key, data[key]])
        }
        const queryString = queryMap
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join("&");
        const fullUrl = queryString ? `${functionName}?${queryString}` : functionName;
        EventSystem.send("ShowJuhua", "HttpSend")
        console.log("get 请求url：", fullUrl)
        const request = fetch(this.getBaseUrl() + "/" + fullUrl, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${this.getToken()}`, // 核心：Bearer Token 鉴权
                'Content-Type': 'application/json'
            },
        })
            .then(async res => {
                EventSystem.send("HideJuhua" ,"HttpSend")
                if (!res.ok) {
                    const raw = await res.text();
                    throw new Error(`Social GET ${functionName} HTTP ${res.status}: ${raw}`);
                }
                return res.json();
            })
            .then(data => {
                console.log("get 请求回复：", data)
                EventSystem.send("HideJuhua" ,"HttpSend")
                if (data.success && data.data) {
                    EventSystem.send("SocialHttpMessage", data.data)
                } else {
                    if (data.error) {
                        EventSystem.send("ShowTips", data.error)
                    }
                }
                return data;
            })
            .catch((err) => {
                EventSystem.send("HideJuhua" ,"HttpSend")
                const error = err instanceof Error ? err : new Error(String(err));
                EventSystem.send("ShowTips", "Network request failed. Please try again later.");
                EventSystem.send("HttpError", error);
                throw error;
            })
        request.catch(() => undefined)
        return request
    }

}


