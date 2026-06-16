import { _decorator, Component, instantiate, Node, Sprite, UITransform } from 'cc';
import { AppConst } from '../../AppConst';
import { RoleModel } from '../../Model/RoleModel';
import { CGModel } from '../../Model/CGModel';
import { CGViewCell } from './CGViewCell';
import { Utils } from '../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('CGView')
export class CGView extends Component {
    @property(Node)
    cgCell : Node

    @property(Node)
    maxNode : Node

    @property(Sprite)
    showSp : Sprite

    public showAry : Node[] = []

    public cgType = 0 //派遣

    start() {
        this.cgCell.active = false
        this.maxNode.active = false
        this.sendToServer();

        EventSystem.addListent("cgGalleryListRefresh" , this.cgGalleryListRefresh , this)
    }

    cgGalleryListRefresh(){
        if(CGModel.getInstance().cgAry.length > this.showAry.length){
            for(let l = 0 ; l < CGModel.getInstance().cgAry.length - this.showAry.length ; l++){
                let newCell = instantiate(this.cgCell)
                newCell.parent = this.cgCell.parent
                newCell.active = true

                this.showAry.push(newCell)
            }
        }

        for(let s = 0 ; s < this.showAry.length ; s++){
            if(s >= CGModel.getInstance().cgAry.length){
                this.showAry[s].active = false
            }else{
                this.showAry[s].active = true
                let cell : CGViewCell = this.showAry[s].getComponent("CGViewCell") as CGViewCell
                cell.refreshNode(CGModel.getInstance().cgAry[s] , s , this);
            }
        }
    }

    sendToServer(){
        let cgTypeStr = ""
        let cgRarity = "R"
        if(this.cgType == 0){
            cgTypeStr = "explore"
        }
        let json = {
            token: RoleModel.getInstance().token,
            cg_type : cgTypeStr,
            rarity: cgRarity,
            sort_by: "created_at",
            sort_order: "desc"
        }
        AppConst.HttpManager.sendPostHttp(
            "npc/cgGallery/list",
            JSON.stringify(json),
        );
    }

    onClickBack(){
        if(this.maxNode.active){
            this.maxNode.active = false
        }else{
            AppConst.PanelManager.CloseView(this)
        }
    }

    private getMaxPreviewBounds(): { width: number; height: number } {
        const scrollView = this.maxNode?.getChildByName('ScrollView');
        const viewUi = scrollView?.getChildByName('view')?.getComponent(UITransform);
        if (viewUi && viewUi.width > 0 && viewUi.height > 0) {
            return { width: viewUi.width, height: viewUi.height };
        }
        const maxUi = this.maxNode?.getComponent(UITransform);
        return {
            width: maxUi?.width > 0 ? maxUi.width : 750,
            height: maxUi?.height > 0 ? maxUi.height : 1374,
        };
    }

    showMax(url){
        this.maxNode.active = true
        this.showSp.spriteFrame = null
        this.showSp.sizeMode = Sprite.SizeMode.CUSTOM
        const bounds = this.getMaxPreviewBounds()
        Utils.loadCoverFitInsideParent(url, this.showSp, bounds.width, bounds.height)
    }
}

