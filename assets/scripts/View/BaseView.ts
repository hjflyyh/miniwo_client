import { _decorator, Component, Node , assetManager, Widget} from 'cc';
import { AppConst } from '../AppConst';
import { Utils } from '../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('BaseView')
export class BaseView extends Component {
    @property
    Hierarchy: String = 'Cover';

    @property
    FullScreen: Boolean = false;

    //常驻
    @property
    Permanent: Boolean = false;

    @property
    closeTime = 0.5

    private isClose = false

    private Prefab = null

    private abBundel = false

    isUpperPanel : Boolean = false;
    upperPanelUrl: string = "";
    suppressUpperReopen: boolean = false;

    start() {
        if(Utils.handleAdaptation()){
            let top = this.node.getChildByName("top")
            if(top){
                top.getComponent(Widget).top -= 60
            }
        }
        this.isClose = false
        this.scheduleOnce(function(){{
            this.isClose = true
        }} , this.closeTime)

        if(this.isUpperPanel){
            EventSystem.send("OnSetNowShowPanel" , this.node["__url"])
        }
    }


    onDestroy(): void {
        if(this.Prefab != null){
            this.Prefab.decRef();
            this.Prefab = null
        }else{
            console.log("未绑定界面prefab")
        }
    }

    onClickClose(){
        if(this.isClose){
            AppConst.PanelManager.CloseView(this)
            return true
        }
        return false
    }
}


