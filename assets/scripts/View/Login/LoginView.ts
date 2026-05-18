import { _decorator, Component, EditBox, Node, WebView, sys } from 'cc';
import { GoogleAuthManager } from '../../Manager/GoogleAuthManager';
import { RoleModel } from '../../Model/RoleModel';
import { network } from '../../Model/RequestData';
import { HttpManager } from '../../Manager/HttpManager';
import { AppConst } from '../../AppConst';
import { MapModel } from '../../Model/MapModel';
import { GenericSpritesheetAnimator } from '../../Utils/GenericSpritesheetAnimator';

/** 与 onClickServer3 一致：原生 App（真机/模拟器）默认 HTTP / WS 入口 */
const LOGIN_NATIVE_DEFAULT_IP = '115.190.225.83';

const { ccclass, property } = _decorator;

@ccclass('LoginView')
export class LoginView extends Component {
    private readonly STORAGE_IP_KEY = "LOGIN_HTTP_IP_BASE";
    private readonly STORAGE_WS_IP_KEY = "STORAGE_WS_IP_KEY";
    private readonly STORAGE_URL_KEY = "LOGIN_HTTP_BASE_URL";

    /** 邮箱登录：HTTP loginGame 进行中，需等本次请求结束后再允许下一次点击 */
    private loginMailPending = false;

    @property(WebView)
    public webview: WebView;

    @property(Node)
    public firstNode;

    @property(Node)
    public mailNode;

    @property(EditBox)
    public mailEditBox

    @property(EditBox)
    public passwordEditBox

    @property(Node)
    public serverSelectNode

    @property(GenericSpritesheetAnimator)
    public animator: GenericSpritesheetAnimator;

    start() {
        this.initHttpServerFromStorage();
        if (sys.isNative && this.serverSelectNode) {
            this.serverSelectNode.active = false;
        }
        this.firstNode.active = true
        this.mailNode.active = false
        GoogleAuthManager.GetInstance().init()
        GoogleAuthManager.GetInstance().bindWebView(this.webview)
        window.addEventListener("message" , onMsg)
        EventSystem.addListent("GOOGLE_LOGIN_CLOSE" , this.onGooleLoginClose  , this)

        EventSystem.addListent("LoginSuccess" , this.onLoginSuccess , this)

        if (this.animator) {
            this.animator.loadAndPlay('res/NPCImage/zuozhu/running-left', 'running-left');
        }
    }

    private initHttpServerFromStorage() {
        if (sys.isNative) {
            // this.applyHttpEndpoints(LOGIN_NATIVE_DEFAULT_IP , "c3a28e10a5be4672.natapp.cc");
            // this.applyHttpEndpoints("192.168.30.109");
            this.applyHttpEndpoints(LOGIN_NATIVE_DEFAULT_IP);
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

    onGooleLoginClose(){
        this.webview.url = ""
        this.webview.node.active = false
    }

    onClickGoogle(){
        EventSystem.send("ShowTips", "未开放谷歌登录，请使用邮箱")
        return
        GoogleAuthManager.GetInstance().login();
    }

    onClickMail(){
        this.firstNode.active = false
        this.mailNode.active = true
    }

    onClickApple(){
        EventSystem.send("ShowTips", "未开放苹果登录，请使用邮箱")
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

    onClickMailBack(){
        this.firstNode.active = true
        this.mailNode.active = false
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
    }

    onClickServer2(){
        this.applyHttpEndpoints("192.168.31.102");
    }

    onClickServer3(){
        this.applyHttpEndpoints(LOGIN_NATIVE_DEFAULT_IP);
    }

    onCleanCache(){
        sys.localStorage.clear()
    }

    onClickMapEdit(){
        MapModel.getInstance().EnterMap(1)
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

