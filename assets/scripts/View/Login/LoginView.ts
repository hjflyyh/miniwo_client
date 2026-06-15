import { _decorator, Component, EditBox, Node, WebView, sys, native } from 'cc';
import { GoogleAuthManager } from '../../Manager/GoogleAuthManager';
import { RoleModel } from '../../Model/RoleModel';
import { network } from '../../Model/RequestData';
import { HttpManager, LOGIN_NATIVE_DEFAULT_IP } from '../../Manager/HttpManager';
import { AppConst } from '../../AppConst';
import { MapModel } from '../../Model/MapModel';
import { GenericSpritesheetAnimator } from '../../Utils/GenericSpritesheetAnimator';

const { ccclass, property } = _decorator;

@ccclass('LoginView')
export class LoginView extends Component {
    private readonly STORAGE_IP_KEY = "LOGIN_HTTP_IP_BASE";
    private readonly STORAGE_WS_IP_KEY = "STORAGE_WS_IP_KEY";
    private readonly STORAGE_URL_KEY = "LOGIN_HTTP_BASE_URL";

    /** 邮箱登录：HTTP loginGame 进行中，需等本次请求结束后再允许下一次点击 */
    private loginMailPending = false;
    /** 邮箱注册：HTTP register 进行中 */
    private registerPending = false;

    @property(WebView)
    public webview: WebView;

    @property(Node)
    public firstNode;

    @property(Node)
    public mailNode;

    @property(Node)
    public mailRegisterNode;

    @property(EditBox)
    public mailEditBox

    @property(EditBox)
    public passwordEditBox

    @property(Node)
    public serverSelectNode

    @property(EditBox)
    public registerMail : EditBox

    @property(EditBox)
    public registerPWD : EditBox

    @property(EditBox)
    public registerPWDConfirm : EditBox

    @property(GenericSpritesheetAnimator)
    public animator: GenericSpritesheetAnimator;

    start() {
        this.initHttpServerFromStorage();
        if (sys.isNative && this.serverSelectNode) {
            this.serverSelectNode.active = false;
        }
        this.firstNode.active = true
        this.mailNode.active = false
        this.mailRegisterNode.active = false
        GoogleAuthManager.GetInstance().init()
        GoogleAuthManager.GetInstance().bindWebView(this.webview)
        window.addEventListener("message" , onMsg)
        EventSystem.addListent("GOOGLE_LOGIN_CLOSE" , this.onGooleLoginClose  , this)

        EventSystem.addListent("LoginSuccess" , this.onLoginSuccess , this)

        if (this.animator) {
            this.animator.loadAndPlay('res/NPCImage/ban/decoded/walking-left', 'running-left');
        }
    }

    private initHttpServerFromStorage() {
        if (sys.isNative) {
            HttpManager.initNativeDefaultEndpoints();
            this.persistHttpServer();
            return;
        }
        const defaultIp = "192.168.30.109";
        const defaultUrl = `http://${defaultIp}:8080`;
        const storage = sys.localStorage;
        const savedIp = storage.getItem(this.STORAGE_IP_KEY) || "";
        const savedUrl = storage.getItem(this.STORAGE_URL_KEY) || "";
        const savedWsIp = storage.getItem(this.STORAGE_WS_IP_KEY) || "";

        HttpManager.ipBase = savedIp.trim() || defaultIp;
        HttpManager.baseUrl = savedUrl.trim() || `http://${HttpManager.ipBase}:8080`;
        HttpManager.chatBaseUrl = `http://${HttpManager.ipBase}:7350`;
        HttpManager.wsIpBase = savedWsIp.trim() || `http://${HttpManager.ipBase}:7350`;

        if (!savedIp || !savedUrl) {
            HttpManager.ipBase = defaultIp;
            HttpManager.baseUrl = defaultUrl;
            this.persistHttpServer();
        }
    }

    /** 切换登录/聊天 HTTP 根地址（与三个服按钮共用） */
    private applyHttpEndpoints(ip: string , wsIp: string = null) {
        HttpManager.ipBase = ip;
        HttpManager.baseUrl = `http://${ip}:8080`;
        HttpManager.chatBaseUrl = `http://${ip}:7350`;
        HttpManager.wsIpBase = wsIp || ip + ":7350";
        this.persistHttpServer();
    }

    private persistHttpServer() {
        const storage = sys.localStorage;
        storage.setItem(this.STORAGE_IP_KEY, HttpManager.ipBase);
        storage.setItem(this.STORAGE_URL_KEY, HttpManager.baseUrl);
        storage.setItem(this.STORAGE_WS_IP_KEY, HttpManager.wsIpBase);
    }

    private bindNativeCallback() {
        console.log("Binding native callback for Apple login result");
        (globalThis as typeof globalThis & { onAppleLoginResult?: (isSuccess: boolean, jsonStr: string) => void }).onAppleLoginResult =
            (isSuccess: boolean, jsonStr: string) => {
                console.log("Received Apple login result from native:", isSuccess, jsonStr);
                let jsonData = JSON.parse(jsonStr || "{}");
                if (isSuccess) {
                    let userID = jsonData.userID;
                    this.loginMailPending = true;
                    const req = AppConst.HttpManager.sendPostHttp("loginGame" , JSON.stringify({
                        platform : 0,
                        loginType : 3,
                        token : userID,
                        email : userID
                    }));
                    Promise.resolve(req).then(
                        () => {},
                        () => {}
                    ).then(() => {
                        if (this.isValid) {
                            this.loginMailPending = false;
                        }
                    });
                } else {
                    EventSystem.send("ShowTips", "Apple login failed");
                }
            };
    }    

    onGooleLoginClose(){
        this.webview.url = ""
        this.webview.node.active = false
    }

    onClickGoogle(){
        EventSystem.send("ShowTips", "Google login is not available. Please use your email.")
        return
        GoogleAuthManager.GetInstance().login();
    }

    onClickMail(){
        this.firstNode.active = false
        this.mailNode.active = true
    }

    onClickApple(){
        if (sys.isNative && sys.platform === sys.Platform.IOS) {
            // 调用原生登录方法
            const reflection = native.reflection;
            this.bindNativeCallback()
            reflection.callStaticMethod('AppleLoginBridge', 'login');
            return;
        }
        EventSystem.send("ShowTips", "Apple login is not available. Please use your email.")
        return
        this.webview.node.active = true;
        this.webview.url = "http://"+ HttpManager.ipBase +"/apple-login.html";
    }

    onClickMailNext(){
        if (this.loginMailPending) {
            return;
        }
        this.loginMailPending = true;
        const req = AppConst.HttpManager.sendPostHttp("loginGame" , JSON.stringify({
            platform : 0,
            loginType : 1,
            token : this.passwordEditBox.string,
            email : this.mailEditBox.string
        }));
        Promise.resolve(req).then(
            () => {},
            () => {}
        ).then(() => {
            if (this.isValid) {
                this.loginMailPending = false;
            }
        });
    }

    onClickRegister(){
        if (this.registerPending) {
            return;
        }

        const email = (this.registerMail?.string || "").trim();
        const password = this.registerPWD?.string || "";
        const passwordConfirm = this.registerPWDConfirm?.string || "";

        if (!email) {
            EventSystem.send("ShowTips", "Please enter email");
            return;
        }
        if (!password) {
            EventSystem.send("ShowTips", "Please enter password");
            return;
        }
        if (!passwordConfirm) {
            EventSystem.send("ShowTips", "Please confirm password");
            return;
        }
        if (password !== passwordConfirm) {
            EventSystem.send("ShowTips", "Passwords do not match");
            return;
        }

        this.registerPending = true;
        const req = AppConst.HttpManager.sendPostHttp("register", JSON.stringify({
            email,
            loginType: 1,
            token: password,
            plantform: 0,
        }));
        Promise.resolve(req).then(
            () => {},
            () => {},
        ).then(() => {
            if (this.isValid) {
                this.registerPending = false;
            }
        });
    }

    onOpenRegister(){
        this.mailNode.active = false
        this.mailRegisterNode.active = true        
    }

    onCloseMailRegister(){
        this.mailNode.active = true
        this.mailRegisterNode.active = false     
    }

    onClickMailBack(){
        this.firstNode.active = true
        this.mailNode.active = false
        this.mailRegisterNode.active = false
    }

    onLoginSuccess(){
        AppConst.PanelManager.CloseView(this)
        AppConst.PanelManager.openView("res/View/Main/MainView")
    }

    protected onDestroy(): void {
        window.removeEventListener("message" , onMsg)
    }

    onClickServer1(){
        this.applyHttpEndpoints("127.0.0.1");
        // this.applyHttpEndpoints("192.168.30.53")
    }

    onClickServer2(){
        this.applyHttpEndpoints("192.168.30.63");
    }

    onClickServer3(){
        this.applyHttpEndpoints(LOGIN_NATIVE_DEFAULT_IP);
    }

    onCleanCache(){
        sys.localStorage.clear()
    }

    onClickMapEdit(){
        const mapModel = MapModel.getInstance();
        mapModel.pendingMapGameType = 0;
        mapModel.EnterMap(1);
    }
}


function onMsg(this: Window, ev: MessageEvent<any>) {
    if(!ev.origin.includes("http://localhost")){
        console.log("WEB VIEW Message")
        console.log(ev)
        if(ev.data && ev.data.type && ev.data.type == "GOOGLE_LOGIN_CLOSE"){
            EventSystem.send("GOOGLE_LOGIN_CLOSE")
        }

        if(ev.data && ev.data.type && ev.data.type == "GOOGLE_LOGIN"){
            let id_token = ev.data.payload.id_token
            // RoleModel.getInstance().sendLogin("" , "" ,id_token , network.ServerCommandLoginType.google)
            // EventSystem.send("GOOGLE_LOGIN_CLOSE")
        }
    }
}

