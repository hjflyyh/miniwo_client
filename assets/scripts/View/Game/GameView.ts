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
const { ccclass, property } = _decorator;

@ccclass('GameView')
export class GameView extends Component {
    @property(EditBox)
    editBox: EditBox = null!;

    @property(EditBoxFixedWidthAutoHeight)
    editBoxFixedWidthAutoHeight: EditBoxFixedWidthAutoHeight = null!;

    @property(Label)
    mapName: Label = null!;

    @property(YXCollectionView)
    followScroll: YXCollectionView = null

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

    private column = 1
    private alignment = 1

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

    /**
     * 用输入框旁的 showText（Label）按固定宽度排版，测量正文实际高度，再加预留得到整格高度。
     */
    private measureChatCellHeight(displayText: string): number {
        const showText = this.editBoxFixedWidthAutoHeight?.showText;
        if (!showText) {
            return this.chatCellMinHeight;
        }
        const label = showText;
        const ut = label.node.getComponent(UITransform);
        if (!ut) {
            return this.chatCellMinHeight;
        }

        const savedString = label.string;
        const savedOverflow = label.overflow;
        const savedW = ut.width;
        const savedH = ut.height;

        label.string = displayText || '';
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        ut.width = this.chatCellContentWidth;
        label.updateRenderData(true);

        const textH = ut.contentSize.height;

        label.string = savedString;
        label.overflow = savedOverflow;
        ut.setContentSize(savedW, savedH);
        label.updateRenderData(true);

        const h = Math.ceil(this.chatCellHeaderReserve + textH);
        return Math.max(this.chatCellMinHeight, h);
    }

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
            this.followScroll.numberOfItems = () => {
                console.log("消息数量", MapChatManager.instance.msessages.length)
                return MapChatManager.instance.msessages.length
            };

            this.followScroll.cellForItemAt = (indexPath, collectionView) => {
                // 通过下标可以获取到对应的数据
                const data = MapChatManager.instance.msessages[indexPath.item]

                // 通过标识符获取重用池内的节点
                const cell = collectionView.dequeueReusableCell(`cell`)

                // 更新数据显示
                const comp : GameViewChatCell = cell.getComponent("GameViewChatCell") as GameViewChatCell;
                comp.refreshData(data)

                return cell // 返回这个节点给列表显示
            }

            this.updateFlowLayout()

            this.receivedData()
        } , 0.1)

        EventSystem.addListent("EventRefreshChat", function(){this.receivedData()} , this)
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

    updateFlowLayout(column: number = this.column, alignment: number = this.alignment) {
        let layout = new YXMasonryFlowLayout()
        layout.extraVisibleCount = 10
        layout.horizontalSpacing = 10
        layout.verticalSpacing = 15
        layout.divide = column
        layout.itemSize = (indexPath) => {
            const data = MapChatManager.instance.msessages[indexPath.item]
            const text = data["text"]
            const displayText = MapChatManager.instance.getDisplayText(text)
            const h = this.measureChatCellHeight(displayText) + 30
            return new math.Size(this.chatCellContentWidth, h)
        }
        this.followScroll.layout = layout
    }   
    
    receivedData() {
        const n = MapChatManager.instance.msessages.length;
        if(n == 0) return;
        this.followScroll.reloadData()
        this.scheduleOnce(() => {
            this.followScroll.scrollTo(new YXIndexPath(0, n - 1), 0, false);
        }, 0);
    }
}

