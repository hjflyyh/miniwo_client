import { _decorator, Component, Node, Vec3 } from 'cc';
import { SelectionComponent } from '../Utils/Sclect/SelectionComponent';
import { AppConst } from '../../AppConst';
import { MapModel } from '../../Model/MapModel';
const { ccclass, property } = _decorator;

@ccclass('MainBottom')
export class MainBottom extends Component {
    @property(SelectionComponent)
    selectionComponent : SelectionComponent

    @property(Node)
    centerNode : Node //中间鼓起

    start() {
        this.selectionComponent.changeCallBack = this.onClickTab
        this.selectionComponent.changeCallBackTarget = this

        this.onClickTab()

        EventSystem.addListent("OnGotoChat" , this.OnGotoChat , this)
    }

    setCenterNode(){
        let centerWorldPos = new Vec3()
        centerWorldPos.x = this.selectionComponent.GetChooseNode().node.worldPosition.x
        centerWorldPos.y = this.centerNode.worldPosition.y
        this.centerNode.worldPosition = centerWorldPos
    }
    
    onClickTab(){
        EventSystem.send("OnClickMainBottom" , this.selectionComponent.changeIndex)

        this.setCenterNode()
    }

    OnGotoChat(){
        this.selectionComponent.changeIndex = 2
        this.selectionComponent.onChangeIndex()
        this.setCenterNode();
    }

    OnClickEdit(){
        // MapModel.getInstance().EnterMap(1)
        // AppConst.PanelManager.openView("res/View/CreateMap/MyWorldView")
        // AppConst.PanelManager.openView("res/View/Follow/FollowImgChoose")
        AppConst.PanelManager.openView("res/View/Follow/FollowImgSetting" , {
            id : 1,type : "localImg"
        })
    }
}


