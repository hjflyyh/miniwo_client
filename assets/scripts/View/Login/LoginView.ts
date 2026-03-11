import { _decorator, Component, EditBox, Node, WebView, sys } from 'cc';
import { GoogleAuthManager } from '../../Manager/GoogleAuthManager';
import { RoleModel } from '../../Model/RoleModel';
import { network } from '../../Model/RequestData';
import { HttpManager } from '../../Manager/HttpManager';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('LoginView')
export class LoginView extends Component {
    private readonly STORAGE_IP_KEY = "LOGIN_HTTP_IP_BASE";
    private readonly STORAGE_URL_KEY = "LOGIN_HTTP_BASE_URL";

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

    start() {
        this.initHttpServerFromStorage();
        this.firstNode.active = true
        this.mailNode.active = false
        GoogleAuthManager.GetInstance().init()
        GoogleAuthManager.GetInstance().bindWebView(this.webview)
        window.addEventListener("message" , onMsg)
        EventSystem.addListent("GOOGLE_LOGIN_CLOSE" , this.onGooleLoginClose  , this)

        EventSystem.addListent("LoginSuccess" , this.onLoginSuccess , this)
    }

    private initHttpServerFromStorage() {
        const defaultIp = "192.168.30.109";
        const defaultUrl = `http://${defaultIp}:8080`;
        const storage = sys.localStorage;
        const savedIp = storage.getItem(this.STORAGE_IP_KEY) || "";
        const savedUrl = storage.getItem(this.STORAGE_URL_KEY) || "";

        HttpManager.ipBase = savedIp.trim() || defaultIp;
        HttpManager.baseUrl = savedUrl.trim() || `http://${HttpManager.ipBase}:8080`;
        if (!savedIp || !savedUrl) {
            HttpManager.ipBase = defaultIp;
            HttpManager.baseUrl = defaultUrl;
            this.persistHttpServer();
        }
    }

    private persistHttpServer() {
        const storage = sys.localStorage;
        storage.setItem(this.STORAGE_IP_KEY, HttpManager.ipBase);
        storage.setItem(this.STORAGE_URL_KEY, HttpManager.baseUrl);
    }

    onGooleLoginClose(){
        this.webview.url = ""
        this.webview.node.active = false
    }

    onClickGoogle(){
        GoogleAuthManager.GetInstance().login();
    }

    onClickMail(){
        this.firstNode.active = false
        this.mailNode.active = true
    }

    onClickApple(){
        this.webview.node.active = true;
        this.webview.url = "http://"+ HttpManager.ipBase +"/apple-login.html";
    }

    onClickMailNext(){
        AppConst.HttpManager.sendPostHttp("loginGame" , JSON.stringify({
            platform : 0,
            loginType : 1,
            token : this.passwordEditBox.string,
            email : this.mailEditBox.string
        }))
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
        HttpManager.ipBase = "192.168.30.109"
        HttpManager.baseUrl = "http://" + HttpManager.ipBase + ":8080"
        this.persistHttpServer();
    }

    onClickServer2(){
        HttpManager.ipBase = "192.168.31.102"
        HttpManager.baseUrl = "http://" + HttpManager.ipBase + ":8080"
        this.persistHttpServer();
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

