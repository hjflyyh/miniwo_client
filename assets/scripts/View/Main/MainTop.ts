import { _decorator, Color, Component, Label, log, Node, Size, UITransform, view } from 'cc';
import { GradientLabel } from '../Utils/GradientLabel';
import { AppConst } from '../../AppConst';
const { ccclass, property } = _decorator;

@ccclass('MainTop')
export class MainTop extends Component {
    @property([Label])
    public tabLabel_1:Label[] = []
    
    @property([Label])
    public tabLabel_2:Label[] = []

    @property(Node)
    tab1:Node

    @property(Node)
    tab2:Node

    @property(Node)
    tabNode : Node

    @property(Node)
    tabNode1 : Node
    
    @property(Node)
    tabNode2 : Node

    @property(Node)
    backNode : Node
    backView : string = ""

    //主界面顶部当前选择的按钮index
    tabIndex = 0
    //主界面底部当前选择的按钮index
    bottomIndex = 0

    chooseColorAry : Color[] = []
    unChooseColorAry : Color[] = []

    nowShowView : string = ""

    @property(UITransform)
    topBgTransform : UITransform

    //底部按钮点击对应功能
    funcs = [
        //世界地图列表    角色npc列表
        [{language:109 , view : "res/View/Main/MainMapListView"} , {language:110 , view : "res/View/Main/character/MainCharacterList"}],
        //社交  推荐
        [{language:115 , view : "res/View/Main/Follow/RandomFollowList"} , {language:114 , view : "res/View/Main/Follow/MainFollowList"}],
        //聊天  wechat
        // [{language:112 , view : "res/View/Main/chat/MainChatList"} , {language:113 , view : ""}],
        [{language:112 , view : "res/View/Main/chat/MainChatList"}],
        [{view : "res/View/UserCenter/UserCenter"}]
    ]

    protected onLoad(): void {
        EventSystem.addListent("OnClickMainBottom" , this.OnClickMainBottom , this)
    }

    start() {
        this.ShowTab()
        this.SetBackBtn()
        EventSystem.addListent("OnGotoChat" , this.OnGotoChat , this)
        EventSystem.addListent("OnSetNowShowPanel" , this.SetNowShowView , this)
    }

    SetBackBtn(){
        this.backNode.active = this.backView != ""
    }

    OnClickBack(){

    }

    OnGotoChat(){
        this.tabIndex = 0
        this.bottomIndex = 2

        this.ShowTab()
    }

    OnClickMainBottom(a){
        this.bottomIndex = a
        this.tabIndex = 0
        this.ShowTab()
    }

    OnClickTab(a , b){
        this.tabIndex = parseInt(b)
        this.ShowTab()
    }

    public SetNowShowView(viewUrl){
        this.nowShowView = viewUrl;
    }

    ShowTab(){
        this.tabNode1.active = this.tabIndex == 0
        this.tabNode2.active = this.tabIndex == 1


        this.tabLabel_1[0].node.active = this.tabIndex == 0
        this.tabLabel_1[1].node.active = this.tabIndex == 1

        this.tabLabel_2[0].node.active = this.tabIndex == 1
        this.tabLabel_2[1].node.active = this.tabIndex == 0

        if(this.funcs[this.bottomIndex].length <= 0){
            AppConst.PanelManager.CloseViewByUrl(this.nowShowView)
            this.tabNode.active = false
            return
        }
        else if(this.funcs[this.bottomIndex].length == 1 && !this.funcs[this.bottomIndex][0]["language"]){
            this.tabNode.active = false
        }else{
            this.tabNode.active = true

            this.tabLabel_1[0].string = AppConst.LanguageManager.getTextByConfig(this.funcs[this.bottomIndex][0]["language"])
            this.tabLabel_1[1].string = AppConst.LanguageManager.getTextByConfig(this.funcs[this.bottomIndex][0]["language"])

            if(this.funcs[this.bottomIndex][1] && this.funcs[this.bottomIndex][1]["language"]){
                this.tab2.active = true
                this.tabLabel_2[0].string = AppConst.LanguageManager.getTextByConfig(this.funcs[this.bottomIndex][1]["language"])
                this.tabLabel_2[1].string = AppConst.LanguageManager.getTextByConfig(this.funcs[this.bottomIndex][1]["language"])
            }else{
                this.tab2.active = false
            }
        }

        let newUrl = this.funcs[this.bottomIndex][this.tabIndex].view
        if(newUrl == this.nowShowView){
            return
        }
        //切换场景UI，需要先清理所有的UI页面返回层级
        EventSystem.send("clearUpperPanelAll")
        AppConst.PanelManager.CloseViewByUrl(this.nowShowView)
        AppConst.PanelManager.openView(newUrl)

        this.nowShowView = newUrl

        // if(this.bottomIndex == 0 && this.tabIndex == 0){
        //     this.topBgTransform.node.active = false
        // }else{

        //     this.topBgTransform.node.active = true
        // }
    }
}


