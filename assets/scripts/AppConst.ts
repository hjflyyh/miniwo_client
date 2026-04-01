import { HttpManager } from "./Manager/HttpManager";
import { JournalManager } from "./Manager/JournalManager";
import { JSONManager } from "./Manager/JSONManager";
import { LanguageManager } from "./Manager/LanguageManager";
import { PanelManager } from "./Manager/PanelManager";
import { SDKManager } from "./Manager/SDKManager";
import { SocialHttpManager } from "./Manager/SocialHttpManager";
import { UtilsManager } from "./Manager/UtilsManager";
import { WebSocketManager } from "./Manager/WebSocketManager";
import { UIRoot } from "./View/UIRoot";

export class AppConst{
    public static UIRoot : UIRoot;
    public static PanelManager : PanelManager;
    public static WebSocketManager : WebSocketManager;
    public static JSONManager : JSONManager;
    public static UtilsManager : UtilsManager;
    public static LanguageManager : LanguageManager;
    public static SDKManager : SDKManager;
    public static HttpManager : HttpManager;
    public static SocialHttpManager : SocialHttpManager;
    public static JournalManager : JournalManager;
}