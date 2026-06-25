import { _decorator, Color, Component, Label, Node, Vec3 } from 'cc';
import { SelectionComponent } from '../Utils/Sclect/SelectionComponent';
import { AppConst } from '../../AppConst';
import { MapModel } from '../../Model/MapModel';
const { ccclass, property } = _decorator;

@ccclass('MainBottom')
export class MainBottom extends Component {
    @property(SelectionComponent)
    selectionComponent : SelectionComponent

    @property([Node])
    lines : Node[] = []

    @property([Label])
    labels : Label[] = []
    start() {
        this.selectionComponent.changeCallBack = this.onClickTab
        this.selectionComponent.changeCallBackTarget = this

        this.onClickTab()

        EventSystem.addListent("OnGotoChat" , this.OnGotoChat , this)
    }
    
    onClickTab(){
        for(let i = 0 ; i < 4 ; i++){
            this.lines[i].active = i == this.selectionComponent.changeIndex
        }
        for(let i = 0 ; i < 4 ; i++){
            if(i == this.selectionComponent.changeIndex){
                this.labels[i].color = new Color('#0f0f13');
            }else{
                this.labels[i].color = new Color('#8585a6');
            }
        }
        EventSystem.send("OnClickMainBottom" , this.selectionComponent.changeIndex)
    }

    OnGotoChat(){
        this.selectionComponent.changeIndex = 2
        this.selectionComponent.onChangeIndex()

        this.onClickTab()
    }

    OnClickEdit(){
        // MapModel.getInstance().EnterMap(1)
        // AppConst.PanelManager.openView("res/View/CreateMap/CreateNpcView")
        // AppConst.PanelManager.openView("res/View/Follow/FollowImgChoose")
        // AppConst.PanelManager.openView("res/View/Follow/FollowImgSetting" , {
        //     id : 1,type : "localImg"
        // })
        AppConst.PanelManager.openView("res/View/CreateNpc/CreateNpcNew")
    }
}


