import { resources, sys, TextAsset, WebView } from 'cc';

export type GoogleIdTokenPayload = {
    iss?: string;
    aud?: string;
    azp?: string;
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    locale?: string;
    iat?: number;
    exp?: number;
    [k: string]: any;
};

export type GoogleLoginResult = {
    /** Google 返回的 ID Token（JWT） */
    idToken: string;
    /** JWT payload（解析后的用户信息） */
    payload: GoogleIdTokenPayload;
    /** 触发方式（Google 返回该字段时才有值） */
    selectBy?: string;
};

export type GoogleAuthInitOptions = {
    /**
     * resources 里的登录页模板路径（TextAsset，不带扩展名）
     * 默认：'web/google-login'（对应 assets/resources/web/google-login.txt）
     */
    templatePath?: string;
    /**
     * 用于兜底轮询的 localStorage key（需要和 google-login.txt 里一致）
     * 默认：'miniwo_google_login:last'
     */
    storageKey?: string;
    /** 远程登录页 URL（例如 https://auth.example.com/google-login.html） */
    loginUrl?: string;
    /** 允许接收 postMessage 的来源（用于安全校验，可选） */
    allowedMessageOrigins?: string[];
};

export type GoogleLoginOptions = {
    /** 超时（ms），默认 15000 */
    timeoutMs?: number;
};

/**
 * GoogleAuthManager（纯 TS 单例）
 *
 * 方案说明（标准 Web 登录按钮 + 独立页面）：
 * - 游戏页（Cocos Web）只负责打开 `google-login.html` popup 并轮询 localStorage。
 * - WebView 内页（TextAsset 模板）使用 Google 官方 Web 登录按钮完成登录，拿到 `credential(id_token)` 后回传给游戏。
 *
 * 优点：
 * - 游戏侧 TS 基本不需要直接操作 DOM（仅 window.open / localStorage）。
 * - 不依赖 One Tap 的 prompt moment status methods（避免 FedCM 迁移警告）。
 */
export class GoogleAuthManager {
    private static _instance: GoogleAuthManager | null = null;
    public static GetInstance(): GoogleAuthManager {
        if (!this._instance) this._instance = new GoogleAuthManager();
        return this._instance;
    }

    private _inited = false;
    private _templatePath = 'web/google-login';
    private _templateHtml: string | null = null;
    private _storageKey = 'miniwo_google_login:last';
    private _loginUrl: string  = "https://dramai.world/google-login.html";
    private _allowedMessageOrigins: string[] | null = null;
    private _activeObjectUrl: string | null = null;

    private _webView: WebView | null = null;

    private _pending: Promise<GoogleLoginResult> | null = null;
    private _current: GoogleLoginResult | null = null;

    private constructor() {}

    private _ensureBrowser() {
        if (!sys.isBrowser) throw new Error('[GoogleAuthManager] 仅支持 Web（浏览器）环境。');
    }

    /** 绑定用于登录的 WebView（建议放在 UI 上，默认 inactive） */
    public bindWebView(webView: WebView) {
        this._webView = webView;
    }

    public init(){
        this._inited = true;
    }

    // public init(opts: GoogleAuthInitOptions) {
    //     this._templatePath = opts?.templatePath ?? this._templatePath;
    //     this._storageKey = opts?.storageKey ?? this._storageKey;
    //     this._loginUrl = opts?.loginUrl ?? null;
    //     this._allowedMessageOrigins = opts?.allowedMessageOrigins ?? null;

    //     this._inited = true;
    // }

    public isLoggedIn(): boolean {
        return !!this._current?.idToken;
    }

    public getCurrent(): GoogleLoginResult | null {
        return this._current;
    }

    public logout() {
        // 这里只清理本地缓存；是否 revoke 由你服务端/业务决定
        this._current = null;
    }

    /** 通过 Cocos WebView 打开登录页并等待结果 */
    public login(opts?: GoogleLoginOptions): Promise<GoogleLoginResult> {
        if (this._pending) return this._pending;
        if (!this._webView) throw new Error('[GoogleAuthManager] 请先 bindWebView(webView)。');

        const timeoutMs = Math.max(1000, opts?.timeoutMs ?? 15000);

        const storageKey = this._storageKey;
        // 清理遗留（上一轮登录结果）
        try {
            (globalThis as any).localStorage?.removeItem(storageKey);
        } catch (_) {}

        const webView = this._webView;
        webView.node.active = true;

        const startTs = Date.now();
        const pollInterval = 150;

        console.log(this._loginUrl)
        this._loginUrl = "https://dramai.world/google-login.html";
        (webView as any).url = this._loginUrl;
        return null
        // const p = new Promise<GoogleLoginResult>(async (resolve, reject) => {
        //     let done = false;

        //     const finish = (err: any, parsed?: any) => {
        //         if (done) return;
        //         done = true;
        //         try { webView.node.active = false; } catch (_) {}
        //         if (this._activeObjectUrl) {
        //             try {
        //                 (globalThis as any).URL?.revokeObjectURL?.(this._activeObjectUrl);
        //             } catch (_) {}
        //             this._activeObjectUrl = null;
        //         }
        //         if (err) {
        //             reject(err);
        //             return;
        //         }
        //         const idToken = parsed?.id_token as string;
        //         if (!idToken) {
        //             reject(new Error('[GoogleAuthManager] 登录返回数据缺少 id_token。'));
        //             return;
        //         }
        //         const payload = this._decodeJwtPayload(idToken);
        //         const result: GoogleLoginResult = { idToken, payload, selectBy: parsed?.select_by };
        //         this._current = result;
        //         resolve(result);
        //     };

        //     // 1) Web：postMessage（google-login.txt 里会发）
        //     const onMessage = (ev: any) => {
        //         const data = ev?.data;
        //         if (!data || data.type !== 'GOOGLE_LOGIN') return;
        //         // 可选安全校验：只接受指定 origin
        //         if (this._allowedMessageOrigins && this._allowedMessageOrigins.length > 0) {
        //             const origin = ev?.origin;
        //             if (!origin || this._allowedMessageOrigins.indexOf(origin) === -1) return;
        //         }
        //         finish(null, data.payload);
        //     };
        //     if (sys.isBrowser) {
        //         try {
        //             (globalThis as any).addEventListener?.('message', onMessage);
        //         } catch (_) {}
        //     }

        //     // 2) Native：如果你需要 Native 回调，可在 google-login.txt 中用 miniwo://... 并在这里接
        //     // （Web 项目可忽略）

        //     // 3) Web 兜底：localStorage 轮询
        //     const timer = setInterval(() => {
        //         try {
        //             if (Date.now() - startTs > timeoutMs) {
        //                 // clearInterval(timer);
        //                 // if (sys.isBrowser) {
        //                 //     try { (globalThis as any).removeEventListener?.('message', onMessage); } catch (_) {}
        //                 // }
        //                 // finish(new Error('[GoogleAuthManager] 登录超时。'));
        //                 // return;
        //             }
        //             if (!sys.isBrowser) return;
        //             const raw = (globalThis as any).localStorage?.getItem?.(storageKey);
        //             if (!raw) return;
        //             clearInterval(timer);
        //             try { (globalThis as any).removeEventListener?.('message', onMessage); } catch (_) {}
        //             try { (globalThis as any).localStorage?.removeItem?.(storageKey); } catch (_) {}
        //             finish(null, JSON.parse(raw));
        //         } catch (_) {}
        //     }, pollInterval);

        //     // 显示登录页：优先远程 URL，其次本地模板
            
        //     console.log(this._loginUrl)
        //     this._loginUrl = "http://117.50.198.104/google-login.html";
        //     try {
        //         if (this._loginUrl) {
        //             (webView as any).url = this._loginUrl;
        //         } else {
        //             const html = await this._getTemplateHtml();
        //             // Web 平台优先使用 blob: URL（继承站点 origin，更容易通过第三方 SDK 的 origin 校验）
        //             if (sys.isBrowser && (globalThis as any).Blob && (globalThis as any).URL?.createObjectURL) {
        //                 const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        //                 const objUrl = (globalThis as any).URL.createObjectURL(blob);
        //                 this._activeObjectUrl = objUrl;
        //                 (webView as any).url = objUrl;
        //             } else {
        //                 // 兜底：data URL
        //                 const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        //                 (webView as any).url = dataUrl;
        //             }
        //         }
        //     } catch (e) {
        //         clearInterval(timer);
        //         try { (globalThis as any).removeEventListener?.('message', onMessage); } catch (_) {}
        //         finish(e);
        //     }
        // });

        // 兼容低 TS lib：不使用 Promise.finally
        // this._pending = p.then(
        //     (v) => {
        //         this._pending = null;
        //         return v;
        //     },
        //     (e) => {
        //         this._pending = null;
        //         throw e;
        //     }
        // );

        // return this._pending;
    }

    private _getTemplateHtml(): Promise<string> {
        if (this._templateHtml) return Promise.resolve(this._templateHtml);
        return new Promise<string>((resolve, reject) => {
            resources.load(this._templatePath, TextAsset, (err, asset) => {
                if (err || !asset) {
                    reject(new Error(`[GoogleAuthManager] 加载登录页模板失败：${this._templatePath}`));
                    return;
                }
                this._templateHtml = asset.text;
                resolve(this._templateHtml);
            });
        });
    }

    // 不再需要模板替换与 requestId（client_id 固定写在 HTML 中）

    private _decodeJwtPayload(jwt: string): GoogleIdTokenPayload {
        const parts = jwt.split('.');
        if (parts.length < 2) throw new Error('[GoogleAuthManager] 非法 JWT。');
        const payloadB64Url = parts[1];
        const json = this._base64UrlDecodeToString(payloadB64Url);
        return JSON.parse(json);
    }

    private _base64UrlDecodeToString(b64Url: string): string {
        // base64url -> base64
        let b64 = b64Url.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4 !== 0) b64 += '=';

        const atobFn = (globalThis as any).atob as ((s: string) => string) | undefined;
        if (!atobFn) throw new Error('[GoogleAuthManager] atob 不可用。');

        const bin = atobFn(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

        const dec = (globalThis as any).TextDecoder ? new TextDecoder('utf-8') : null;
        if (dec) return dec.decode(bytes);

        // 兜底：按 ASCII
        let out = '';
        for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
        return out;
    }
}

