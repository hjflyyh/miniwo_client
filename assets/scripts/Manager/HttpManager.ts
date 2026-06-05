import { _decorator, Component, log, sys } from 'cc';
import { AppConst } from '../AppConst';
const { ccclass } = _decorator;

/** 原生 App（真机/模拟器）默认 HTTP / WS 入口，与 LoginView 选服一致 */
export const LOGIN_NATIVE_DEFAULT_IP = '100.24.65.122';

@ccclass('HttpManager')
export class HttpManager extends Component {
    public static ipBase = "192.168.30.109"
    public static wsIpBase = "c3a28e10a5be4672.natapp.cc"
    public static baseUrl = "http://" + HttpManager.ipBase + ":8080"
    public static chatBaseUrl = "http://" + HttpManager.ipBase + ":7350"

    /** 原生端写入默认服地址（LoginView 与启动探测共用） */
    public static initNativeDefaultEndpoints() {
        HttpManager.ipBase = LOGIN_NATIVE_DEFAULT_IP;
        HttpManager.baseUrl = `http://${LOGIN_NATIVE_DEFAULT_IP}:8080`;
        HttpManager.chatBaseUrl = `http://${LOGIN_NATIVE_DEFAULT_IP}:7350`;
        HttpManager.wsIpBase = `${LOGIN_NATIVE_DEFAULT_IP}:7350`;
    }

    /**
     * iOS 首次联网会弹出系统「无线局域网与蜂窝数据」选项。
     * 启动时主动探测，避免等到点击登录才出现。
     */
    public probeNetworkAccessOnLaunch() {
        const url = HttpManager.baseUrl;
        if (!url) {
            return;
        }
        fetch(url, { method: "GET" }).catch(() => undefined);
    }

    start() {
        AppConst.HttpManager = this;
        if (sys.isNative && sys.platform === sys.Platform.IOS) {
            HttpManager.initNativeDefaultEndpoints();
            this.probeNetworkAccessOnLaunch();
        }
    }

    /**
     * 从 fetch 抛出的 Error 中解析服务端错误文案。
     * 例：POST register HTTP 400: {"error":"密码不能为空且至少6位"}
     */
    public static resolveErrorTip(err: unknown, fallback = "Network request failed. Please try again later."): string {
        const raw = err instanceof Error ? err.message : String(err ?? "");
        const fromBody = HttpManager.parseErrorBodyFromHttpMessage(raw);
        if (fromBody) {
            return fromBody;
        }
        if (/HTTP\s+\d+:/i.test(raw)) {
            return fallback;
        }
        const trimmed = raw.trim();
        return trimmed || fallback;
    }

    private static parseErrorBodyFromHttpMessage(message: string): string {
        const text = String(message || "");
        const httpBodyMatch = text.match(/HTTP\s+\d+:\s*([\s\S]+)$/i);
        const candidates = httpBodyMatch ? [httpBodyMatch[1].trim()] : [text.trim()];
        for (const candidate of candidates) {
            const parsed = HttpManager.extractErrorFieldFromJson(candidate);
            if (parsed) {
                return parsed;
            }
        }
        return "";
    }

    private static extractErrorFieldFromJson(jsonText: string): string {
        if (!jsonText) {
            return "";
        }
        try {
            const body = JSON.parse(jsonText);
            if (body == null || typeof body !== "object") {
                return "";
            }
            const fields = ["error", "message", "messager"];
            for (const key of fields) {
                const val = body[key];
                if (val != null && String(val).trim()) {
                    return String(val).trim();
                }
            }
        } catch {
            // 非 JSON 响应体
        }
        return "";
    }

    private handleRequestError(err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        EventSystem.send("ShowTips", HttpManager.resolveErrorTip(error));
        EventSystem.send("HttpError", error);
        throw error;
    }

    public sendPostHttp(functionName , data){
        log(functionName)
        EventSystem.send("ShowJuhua" ,"HttpSend")
        const request = fetch(HttpManager.baseUrl + "/" + functionName , {
            method :'POST',
            headers: {'Content-Type': 'application/json'},
            body: data
        })
        .then(async res => {
            if (!res.ok) {
                const raw = await res.text();
                throw new Error(`POST ${functionName} HTTP ${res.status}: ${raw}`);
            }
            return res.json();
        })
        .then(data => {
            console.log("请求回复：",data)
            if(data.success){
                if(data.data == null){
                    data.data = {}
                }
                if(data.data["functionName"] == null){
                    data.data["functionName"] = functionName
                }
                
                EventSystem.send("HttpMessage" , data.data)
            }else{
                if(data.error){
                    EventSystem.send("ShowTips" , data.error)
                }
            }
            return data;
        })
        .catch((err) => this.handleRequestError(err))
        request.catch(() => undefined)
        return request
    }

    /**
     * 兼容 AI 透传 JSON：不要求 {success:true,data} 包装，直接把原始响应派发出去。
     * 仍会优先提示 error/message 字段。
     */
    public sendPostHttpAny(functionName: string, data: any, options?: { silent?: boolean }) {
        log(functionName);
        if (!options?.silent) {
            EventSystem.send("ShowJuhua", "HttpSend");
        }
        const request = fetch(HttpManager.baseUrl + "/" + functionName, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data
        })
            .then(async res => {
                if (!res.ok) {
                    const raw = await res.text();
                    throw new Error(`POST ${functionName} HTTP ${res.status}: ${raw}`);
                }
                return res.json();
            })
            .then(resp => {
                console.log("请求回复：", resp);
                if (resp?.error) {
                    EventSystem.send("ShowTips", resp.error);
                    return resp;
                }
                if (resp?.message && resp?.success === false) {
                    EventSystem.send("ShowTips", resp.message);
                    return resp;
                }
                // 统一派发：业务侧可按 functionName 区分解析
                EventSystem.send("HttpMessage", { functionName, raw: resp });
                return resp;
            })
            .catch((err) => {
                this.handleRequestError(err)
            });
        request.catch(() => undefined)
        return request
    }

    /** GET 透传 JSON（用于立绘任务轮询等） */
    public sendGetHttpAny(path: string, options?: { silent?: boolean }) {
        const normalized = String(path || "").replace(/^\//, "");
        log("GET " + normalized);
        if (!options?.silent) {
            EventSystem.send("ShowJuhua", "HttpSend");
        }
        const request = fetch(HttpManager.baseUrl + "/" + normalized, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        })
            .then(async (res) => {
                if (!res.ok) {
                    const raw = await res.text();
                    throw new Error(`GET ${normalized} HTTP ${res.status}: ${raw}`);
                }
                return res.json();
            })
            .then((resp) => {
                console.log("GET 请求回复：", resp);
                if (resp?.error) {
                    EventSystem.send("ShowTips", resp.error);
                    return resp;
                }
                if (resp?.message && resp?.success === false) {
                    EventSystem.send("ShowTips", resp.message);
                    return resp;
                }
                EventSystem.send("HttpMessage", { functionName: normalized, raw: resp });
                return resp;
            })
            .catch((err) => this.handleRequestError(err));
        request.catch(() => undefined);
        return request;
    }

}


