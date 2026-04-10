import { _decorator, Component, EditBox, instantiate, Label, math, Node, UITransform, director } from 'cc';
import { AppConst } from '../../AppConst';
import { network } from '../../Model/RequestData';
import { RoleModel } from '../../Model/RoleModel';
import { HttpManager } from '../../Manager/HttpManager';
import { MapChatManager } from '../../Manager/ChatManager';
import { MapModel } from '../../Model/MapModel';
import { YXCollectionView, YXIndexPath } from 'db://assets/plugin/list-3x/yx-collection-view';
import { CustomGridFlowLayout } from 'db://assets/plugin/list-3x/custom-grid-flow-layout';
import { GameViewChatCell } from './GameViewChatCell';
import { GameViewNpcCell } from './GameViewNpcCell';
import { EditBoxFixedWidthAutoHeight } from '../../Utils/EditBoxFixedWidthAutoHeight';
import { YXMasonryFlowLayout } from 'db://assets/plugin/list-3x/yx-masonry-flow-layout';
import { GameMapChatScroll } from './GameMapChatScroll';
const { ccclass, property } = _decorator;

@ccclass('GameView')
export class GameView extends Component {
    @property(EditBox)
    editBox: EditBox = null!;

    @property(EditBoxFixedWidthAutoHeight)
    editBoxFixedWidthAutoHeight: EditBoxFixedWidthAutoHeight = null!;

    @property(Label)
    mapName: Label = null!;

    @property(GameMapChatScroll)
    chatScroll : GameMapChatScroll
    // @property(YXCollectionView)
    // followScroll: YXCollectionView = null

    @property(Node)
    atNpc: Node = null

    @property(Node)
    chatNpc: Node = null

    @property(Node)
    atNpcLayout: Node = null

    @property(Node)
    chatNpcLayout: Node = null

    @property(Node)
    atNpcCell: Node = null

    @property(Node)
    chatNpcCell: Node = null

    private atNpcCells = []
    private chatNpcCells = []

    private atNpcData = null

    /** 与列表 cell 正文同宽，用于测量多行高度 */
    @property
    chatCellContentWidth = 600

    /** 除正文外预留高度（昵称行、边距等），按你 prefab 微调 */
    @property
    chatCellHeaderReserve = 48

    @property
    chatCellMinHeight = 72

    @property
    editBoxLineOffsetY = 10

    private editBoxBaseY = 0

    start() {
        this.atNpc.active = false
        this.chatNpc.active = false

        this.atNpcCell.active = false
        this.chatNpcCell.active = false


        this.editBoxFixedWidthAutoHeight.showText.string = ""
        this.editBoxBaseY = this.editBox.node.position.y

        MapChatManager.instance.initMap();

        this.mapName.string = MapModel.getInstance().showMatchPayLoad["map_name"]

        this.scheduleOnce(()=>{
            this.receivedData()
        } , 0.2)

        EventSystem.addListent("EventRefreshChat", this.receivedData , this)
        EventSystem.addListent("WebSocketMessage" , this.OnWebSocketMessage , this)

        this.onEditEnd()
        
    }

    public OnWebSocketMessage(data){
        if(data["id"] == "leave_map"){
            let request = new network.MatchLeaveEequest();
            AppConst.WebSocketManager.send(request.toJSON(MapModel.getInstance().match_id));
            
            AppConst.PanelManager.CloseView(this)
            director.loadScene("GameScene", (error: Error) => {
                if (error) {
                    console.error('切换到 GameScene 失败:', error);
                } else {
                    console.log('已退出 editor_test，切回 GameScene');
                    AppConst.PanelManager.openView("res/View/TipsView")
                    AppConst.PanelManager.openView("res/View/Main/MainView")
                }
            });
        }
    }

    public onClickChat(){
        if(this.editBox.string != ""){
            MapChatManager.instance.sendMapChat(this.editBox.string)
            this.editBox.string = ""
            if(this.editBoxFixedWidthAutoHeight.showText != null){
                this.editBoxFixedWidthAutoHeight.showText.string = ""
            }
        }
    }

    public onClickNpcAt(){
        this.atNpc.active = true
        if(this.atNpcCells.length <= 0){
            for(let npcId in MapModel.getInstance().mapNpcs){
                let npcData = MapModel.getInstance().mapNpcs[npcId]
                let cell = instantiate(this.atNpcCell)
                let gameNpcCell : GameViewNpcCell = cell.getComponent("GameViewNpcCell") as GameViewNpcCell
                gameNpcCell.refreshData(npcData)
                cell.parent = this.atNpcLayout
                
                cell.active = true
                this.atNpcCells.push({id: npcId, node: cell})
            }
        }
    }

    public onClickChatNpc(){
        this.chatNpc.active = true
        if(this.chatNpcCells.length <= 0){
            for(let npcId in MapModel.getInstance().mapNpcs){
                let npcData = MapModel.getInstance().mapNpcs[npcId]
                let cell = instantiate(this.chatNpcCell)
                let gameNpcCell : GameViewNpcCell = cell.getComponent("GameViewNpcCell") as GameViewNpcCell
                gameNpcCell.refreshData(npcData)
                cell.parent = this.chatNpcLayout
                
                cell.active = true
                this.chatNpcCells.push({id: npcId, node: cell})
            }
        }
    }

    public onClickCloseNpcAt(){
        this.atNpc.active = false
        this.chatNpc.active = false
    }

    public onClickNpc(a , b){
        let npcCell = a.target.getComponent("GameViewNpcCell") as GameViewNpcCell
        
        console.log("点击了NPC", npcCell["npcData"])
        this.atNpcData = npcCell["npcData"]
        this.editBox.string = this.editBox.string + `  @${this.atNpcData.name}  `
        if(this.editBoxFixedWidthAutoHeight.showText != null){
            this.editBoxFixedWidthAutoHeight.showText.string = this.editBox.string
        }
        this.atNpc.active = false
    }

    //右边的聊天头像
    public onClickChatHeadNpc(a){
        this.chatNpc.active = false

        let npcCell = a.target.getComponent("GameViewNpcCell") as GameViewNpcCell

        console.log("点击了NPC", npcCell["npcData"])
        AppConst.PanelManager.openView("res/View/Chat/ChatView", { chatType: 2, npcId: npcCell["npcData"].id })
    }

    public onClickCloseScene(){

        let mapRequest = new network.leaveMapEequest();
        AppConst.WebSocketManager.send(mapRequest.toJSON(MapModel.getInstance().currentMapId));
    }

    public onEditEnd(){
        const showText = this.editBoxFixedWidthAutoHeight?.showText
        if (!showText) return

        const labelUt = showText.node.getComponent(UITransform)
        if (!labelUt) return

        showText.string = this.editBox.string || ''
        showText.updateRenderData(true)

        const lineHeight = Math.max(1, showText.lineHeight || 0)
        const contentH = Math.max(1, labelUt.contentSize.height)
        const lineCount = Math.max(1, Math.ceil(contentH / lineHeight))

        const offsetY = (lineCount - 1) * this.editBoxLineOffsetY
        const pos = this.editBox.node.position
        this.editBox.node.setPosition(pos.x, this.editBoxBaseY + offsetY - 15, pos.z)
    }
    
    receivedData() {
        const n = MapChatManager.instance.msessages.length;
        if(n == 0) return;
        
        this.chatScroll.refreshChat(MapChatManager.instance.msessages)
    }
}

