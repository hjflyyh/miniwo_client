import { _decorator, Component, director, Node , Prefab, WebView} from 'cc';
import { AppConst } from '../AppConst';
import { RoleModel } from '../Model/RoleModel';
import { MapAssetsManager } from '../../src/common/MapAssetsManager';
import {PanelManager} from "db://assets/scripts/Manager/PanelManager";
import { SDKManager } from '../Manager/SDKManager';
import { GoogleAuthInitOptions, GoogleAuthManager } from '../Manager/GoogleAuthManager';
import { MapModel } from '../Model/MapModel';
const { ccclass, property } = _decorator;

@ccclass('UIRoot')
export class UIRoot extends Component {
    @property(Node)
    public Root:Node;

    @property(Node)
    public Cover:Node;

    @property(Node)
    public Tips:Node;

    @property(Node)
    public PopUI:Node;

    @property(Node)
    public TopUI:Node;

    @property(Node)
    public StoryUI:Node;

    @property(Node)
    public Top:Node;

    @property(Node)
    public Bottom:Node;

    @property(Prefab)
    npc : Prefab

    public MapEditorWidth = 46;
    public MapEditorHeight = 88;
    public MapTag = 0
    public MapEditormCharacters = 4
    public MapEditormItems = 12

    async start() {
        AppConst.UIRoot = this

        director.addPersistRootNode(this.Root);

        AppConst.SDKManager.isEditMapingWeb = false
        window.parent.postMessage({
            channel: 'miniwo-map-editor',
            source: 'miniwo-cocos',
            type: 'COCOS_INIT_DONE',
            payload: { ok: true, ts: Date.now() }
        }, '*');

        window.addEventListener('message', (e) => {
            const msg = e.data;
            if(msg.type == "WEB_INIT_DATA"){
                MapModel.getInstance().mapEditAdminToken = msg.token
                MapModel.getInstance().mapEditMapId = msg.mapId
                MapModel.getInstance().mapEditData = msg.mapData

                console.log("地图数据：")
                console.log(msg.mapData)
                AppConst.SDKManager.isEditMapingWeb = true
            }
        });

        this.scheduleOnce(function(){
            if(AppConst.SDKManager.isEditMapingWeb){
                this.runWebEdit();
            }else{
                if(AppConst.SDKManager.platform == "webh5"){
                    AppConst.PanelManager.openView("res/View/Login/LoginView")
                }
            }
        } , 0.1)


        AppConst.PanelManager.openView("res/View/TipsView")
    }

    runWebEdit(){
        MapModel.getInstance().EnterMap(1)
    }

    testEdit(){
        MapAssetsManager.GetInstance().loadMapEditorAssets();
    }
}


