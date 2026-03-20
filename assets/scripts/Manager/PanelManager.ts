import { _decorator, Component, Node , director , log , view, instantiate , Prefab , resources , sys} from 'cc';
import { UIRoot } from '../View/UIRoot';
import { AppConst } from '../AppConst';
import { BaseView } from '../View/BaseView';

const { ccclass, property } = _decorator;

@ccclass('PanelManager')
export class PanelManager extends Component {
    private UIMap = {}
    //正在加载中的
    private LoadUIMap = {}
    // 记录通过 upperPanel 打开的界面，value 为其上一层 url
    private upperPanelOpenMap = {}

    //所有全屏UI
    private allFullView = []

    @property(Node)
    public loadingNode : Node

    public bundles = {}

    onLoad(){
        AppConst.PanelManager = this
    }

    start() {
        console.log("当前系统语言" + sys.language)

        const viewSize = view.getVisibleSize(); // 返回 Size 对象
        const viewWidth = viewSize.width;
        const viewHeight = viewSize.height;
        console.log(viewHeight)
        console.log(viewWidth)

        log("PanelManager start 常驻节点")
        director.addPersistRootNode(this.node);

        EventSystem.addListent("InitTaskQueueSuccess" , this.OnEventLoadBundleAll , this)
        EventSystem.addListent("clearUpperPanelAll" , this.clearUpperPanelAll , this)
    }

    public GetMapEditBundle(){
        return this.bundles["mapEditor"]
    }

    public OnEventLoadBundleAll(){
        director.loadScene("GameScene", (error) => {
            if (error) {
                console.error(`加载场景 GameScene 失败:`, error);
                return;
            }
            console.log(`场景 GameScene 切换成功`);
            this.loadingNode.destroy()
        });
    }

    public RunScene(){

    }

    //resources打开
    public openView(url , openParam = null , callBack = null , upperPanel = ""  , paramNode = null){
        if(!url || url == ""){
            return
        }
        if(this.UIMap[url] != null){
            this.UIMap[url].active = true
            if(callBack){
                callBack()
            }
            return;
        }
        if(this.LoadUIMap[url]){
            return;
        }
        this.LoadUIMap[url] = true
        let _this = this

        log("打开UI:" + url)
        EventSystem.send("WaitOpenUI")

        resources.load(url , Prefab , function(r , gameObject){
            EventSystem.send("HideJuhua" , "OPEN_UI")
            _this.LoadUIMap[url] = false

            //增加引用计数
            gameObject.addRef()

            //实例化
            var newView = instantiate(gameObject)
            newView["__url"] = url
            newView["_openParam"] = openParam

            if(newView.getComponent("BaseView") == null){
                newView.addComponent("BaseView")
            }
            let baseView = newView.getComponent("BaseView")
            baseView["isUpperPanel"] = upperPanel != ""
            baseView["upperPanelUrl"] = upperPanel || ""
            baseView["suppressUpperReopen"] = false
            if(upperPanel != ""){
                const upperNode = _this.UIMap[upperPanel]
                if(upperNode){
                    upperNode.active = false
                }
                _this.upperPanelOpenMap[url] = upperPanel
            }
            baseView["Prefab"] = gameObject
            if(baseView["FullScreen"]){
                _this.addView(newView)
            }
            if(paramNode != null){
                paramNode.addChild(newView)
            }else{
                _this.addViewChild(baseView , newView);
            }

            _this.UIMap[url] = newView
            if(callBack){
                callBack()
            }

        })
    }

    //AB包打开UI
    public openViewByBundel(url , bundle ,openParam = null , callBack = null){
        if(this.UIMap[url] != null){
            if(callBack){
                callBack()
            }
            return;
        }
        if(this.LoadUIMap[url]){
            return;
        }
        this.LoadUIMap[url] = true
        let _this = this

        EventSystem.send("WaitOpenUI")

        bundle.load(url , Prefab , function(r , gameObject){
            EventSystem.send("HideJuhua" , "OPEN_UI")

            _this.LoadUIMap[url] = false

            gameObject.addRef()

            var newView = instantiate(gameObject)
            newView.__url = url
            newView._openParam = openParam
            if(newView.getComponent("BaseView") == null){
                newView.addComponent("BaseView")
            }
            let baseView = newView.getComponent("BaseView")
            baseView.abBundel = true
            baseView.Prefab = gameObject

            if(baseView.FullScreen){
                _this.addView(newView)
            }
            _this.addViewChild(baseView , newView);

            _this.UIMap[url] = newView
            if(callBack){
                callBack()
            }
        })
    }

    public CloseAll(){
        for(let v in this.UIMap){
            let baseView = this.UIMap[v].getComponent("BaseView") as BaseView
            if(baseView != null && !baseView.Permanent){
                this.CloseView(baseView)
            }
        }
        this.upperPanelOpenMap = {}
    }

    public CloseView(view){
        const baseView = view?.getComponent ? (view.getComponent("BaseView") as BaseView) : null
        const upperPanelUrl = baseView?.upperPanelUrl || ""
        const suppressUpperReopen = !!baseView?.suppressUpperReopen

        if(view.node && view.node.__url && this.UIMap[view.node.__url]){
            if(this.upperPanelOpenMap[view.node.__url]){
                delete this.upperPanelOpenMap[view.node.__url]
            }
            delete this.UIMap[view.node.__url]
        }
        if(baseView.FullScreen){
            this.spliceView()
        }
        view.node.destroy()
        view.node.removeFromParent(!0)

        // 关闭 upperPanel 子页面后，恢复上一层页面
        if(upperPanelUrl != "" && !suppressUpperReopen){
            if(this.UIMap[upperPanelUrl]){
                this.UIMap[upperPanelUrl].active = true
                EventSystem.send("OnSetNowShowPanel" , upperPanelUrl)
            }else{
                this.openView(upperPanelUrl)
            }
        }
    }

    public CloseViewByUrl(url){
        if(this.UIMap[url] != null){
            let baseView = this.UIMap[url].getComponent("BaseView")
            if(baseView != null){
                this.CloseView(baseView)
            }
        }
    }

    public viewIsOpen(url){
        if(this.UIMap[url] != null || this.LoadUIMap[url] != null){
            return true
        }
        return false
    }

    private addViewChild(baseView , newView){
        if(baseView.Hierarchy == "Cover"){
            AppConst.UIRoot.Cover.addChild(newView)
        }
        if(baseView.Hierarchy == "Tips"){
            AppConst.UIRoot.Tips.addChild(newView)
        }
        if(baseView.Hierarchy == "PopUI"){
            AppConst.UIRoot.PopUI.addChild(newView)
        }
        if(baseView.Hierarchy == "TopUI"){
            AppConst.UIRoot.TopUI.addChild(newView)
        }
        if(baseView.Hierarchy == "StoryUI"){
            AppConst.UIRoot.StoryUI.addChild(newView)
        }
        if(baseView.Hierarchy == "Bottom"){
            AppConst.UIRoot.Bottom.addChild(newView)
        }
        if(baseView.Hierarchy == "Top"){
            AppConst.UIRoot.Top.addChild(newView)
        }
    }

    private addView(view){
        for(var i= 0 ; i < this.allFullView.length ; i++){
            this.allFullView[i].active = false
        }
        this.allFullView.push(view)
    }

    public spliceView(){
        this.allFullView.splice(this.allFullView.length - 1 , 1)
        if(this.allFullView.length > 0){
            this.allFullView[this.allFullView.length - 1].active = true
        }
    }

    // 一键清理 upperPanel 链路界面，不触发回弹
    public clearUpperPanelAll(){
        const urls = Object.keys(this.upperPanelOpenMap);
        // 先关最上层，避免中途回显
        for(let i = urls.length - 1; i >= 0; i--){
            const url = urls[i];
            const viewNode = this.UIMap[url];
            if(viewNode){
                const baseView = viewNode.getComponent("BaseView") as BaseView;
                if(baseView){
                    baseView.suppressUpperReopen = true;
                    this.CloseView(baseView);
                }else{
                    this.CloseViewByUrl(url);
                }
            }
        }
        this.upperPanelOpenMap = {}
    }
}


