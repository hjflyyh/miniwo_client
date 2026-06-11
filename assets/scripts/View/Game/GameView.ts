import { _decorator, Component, EditBox, instantiate, Label, math, Node, resources, Sprite, SpriteFrame, UITransform, director, Vec3 } from 'cc';
import { AppConst } from '../../AppConst';
import { network } from '../../Model/RequestData';
import { RoleModel } from '../../Model/RoleModel';
import { MapChatManager } from '../../Manager/ChatManager';
import { PrivateChatManager } from '../../Manager/PrivateChatMessage';
import { MapModel } from '../../Model/MapModel';
import { GameViewNpcCell } from './GameViewNpcCell';

import { GameMapChatScroll } from './GameMapChatScroll';

// import { MapManager } from 'db://assets/bundles/mapEditor/src/MapManager';
import { GameSendRewardCell } from './GameSendRewardCell';
import { BagModel } from '../../Model/BagModel';
import { GAME_FARM_PLOT_CLICK_EVENT, GameFarmPlotClickPayload } from './GameFarmNode';
import { FarmModel } from '../../Model/Farm/FarmModel';
import {
    GAME_FARM_SEED_CHOOSE_EVENT,
    GameFarmChooseCell,
    GameFarmSeedChoosePayload,
} from './GameFarmChooseCell';
import { isPlotSeedEmpty, plotNeedsWaterOverlay } from '../../Model/Farm/FarmTypes';
import { Utils } from '../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('GameView')
export class GameView extends Component {
    @property(EditBox)
    editBox: EditBox = null!;

    @property(Label)
    mapName: Label = null!;

    @property(GameMapChatScroll)
    chatScroll : GameMapChatScroll
    // @property(YXCollectionView)
    // followScroll: YXCollectionView = null

    @property(Node)
    atNpc: Node = null

    @property(Node)
    atNpcLayout: Node = null

    @property(Node)
    chatNpcLayout: Node = null

    @property(Node)
    atNpcCell: Node = null

    private atNpcCells = []

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

    @property(Node)
    UI: Node = null

    @property(Node)
    showUI: Node = null

    @property(Node)
    showUIArrow: Node = null

    @property(Node)
    showChatUI: Node = null

    @property(Node)
    showChatArrow: Node = null

    @property(Node)
    buildContent: Node = null

    //奖励道具列表
    @property(Node)
    rewardTarget: Node = null;

    @property(Node)
    rewardContent: Node = null;

    @property(Node)
    farmNode : Node = null;

    @property(Node)
    farmContent : Node = null;

    @property(Node)    
    farmItemCell : Node = null;

    //奖励道具节点
    @property(GameSendRewardCell)
    rewardItemCell : GameSendRewardCell = null;    

    private rewardCells: GameSendRewardCell[] = [];

    private farmCells: Node[] = [];

    private selectedFarmPlot: GameFarmPlotClickPayload | null = null;

    start() {
        if(Utils.handleAdaptation()){
            this.node.scale = new Vec3(0.7, 0.7 , 1);
        }        
        this.atNpc.active = false

        this.atNpcCell.active = false

        if (this.farmNode) {
            this.farmNode.active = false
        }
        if (this.farmItemCell) {
            this.farmItemCell.active = false
        }

        this.editBoxBaseY = this.editBox.node.position.y

        MapChatManager.instance.initMap();

        this.mapName.string = RoleModel.getInstance().nickName

        this.scheduleOnce(()=>{
            this.receivedData()
        } , 0.2)

        EventSystem.addListent("EventRefreshChat", this.receivedData , this)
        EventSystem.addListent("WebSocketMessage" , this.OnWebSocketMessage , this)
        EventSystem.addListent("CloseMapEditor" , this.CloseMapEditor , this)
        EventSystem.addListent("WebSocketNotifications", this.onWebSocketNotification, this)
        EventSystem.addListent("OpenGameShop", this.OpenGameShop, this)
        EventSystem.addListent("OpenGameWarehouse", this.OpenGameWarehouse, this)
        EventSystem.addListent(GAME_FARM_PLOT_CLICK_EVENT, this.onGameFarmPlotClick, this)
        EventSystem.addListent(GAME_FARM_SEED_CHOOSE_EVENT, this.onGameFarmSeedChoose, this)
        EventSystem.addListent('ConfigLoadAll', this.onConfigLoadAll, this)
        EventSystem.addListent("leaveMap" , this.leaveMap , this)

        this.onEditEnd()
        
        this.showUI.active = true
        this.showChatUI.active = true

        this.refreshBuildContentVisibility();

        this.initRewardList();
        this.initFarmList();
        if (MapModel.getInstance().isFarmMapGameType()) {
            void FarmModel.getInstance().enterFarm();
        }
    }

    private onConfigLoadAll() {
        this.initRewardList();
        this.initFarmList();
    }

     private initRewardList() {
         const data = AppConst.JSONManager?.getItemAll?.('item');
         if (data) {
             this.renderRewardList(data);
             return;
         }
     }

    private renderRewardList(rawItemCfg: Record<string, any>) {
        if (!this.rewardContent || !this.rewardItemCell?.node || !rawItemCfg) return;
        const templateNode = this.rewardItemCell.node;
        const children = [...this.rewardContent.children];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child !== templateNode) {
                child.destroy();
            }
        }

        this.rewardCells = [];

        const bagSlots = BagModel.getInstance().slots || [];
        const bagCountByItemId = new Map<number, number>();
        for (let i = 0; i < bagSlots.length; i++) {
            const slot = bagSlots[i] as any;
            const id = Number(slot?.item_id);
            const count = Number(slot?.count ?? 0);
            if (!Number.isFinite(id) || id <= 0) continue;
            bagCountByItemId.set(id, Math.max(0, Number.isFinite(count) ? count : 0));
        }

        const rows = Object.keys(rawItemCfg)
            .map((id) => {
                const row = rawItemCfg[id] || {};
                return {
                    id: Number(id),
                    ...row,
                };
            })
            .filter((row) => Number.isFinite(row.id))
            .filter((row) => {
                const favorability = Number(row?.favorability);
                return Number.isFinite(favorability) && favorability > 0;
            })
            .sort((a, b) => Number(a.favorability) - Number(b.favorability));

        for (let i = 0; i < rows.length; i++) {
            const node = instantiate(templateNode);
            node.active = true;
            node.setParent(this.rewardContent);
            const cell = node.getComponent(GameSendRewardCell);
            cell?.setData(rows[i]);
            cell?.setItemNum(bagCountByItemId.get(Number(rows[i].id)) ?? 0);
            // cell?.setSelected(false);
            if (cell) {
                this.rewardCells.push(cell);
                const itemId = Number(rows[i].id);
                (node as any)._rewardItemId = itemId;
                node.name = `reward_item_${itemId}`;

                node.on(Node.EventType.TOUCH_END, () => {
                    this.onRewardItemClick(itemId);
                }, this);
            }
        }
        this.rewardItemCell.node.active = false;
        this.rewardTarget.active = false;
    }

    private initFarmList() {
        const seedsCfg = AppConst.JSONManager?.getItemAll?.('basicSeeds');
        const itemCfg = AppConst.JSONManager?.getItemAll?.('item');
        if (seedsCfg && itemCfg) {
            this.renderFarmList(seedsCfg, itemCfg);
        }
    }

    private renderFarmList(rawSeedsCfg: Record<string, any>, rawItemCfg: Record<string, any>) {
        if (!this.farmContent || !this.farmItemCell || !rawSeedsCfg || !rawItemCfg) {
            return;
        }
        const templateNode = this.farmItemCell;
        const children = [...this.farmContent.children];
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child !== templateNode) {
                child.destroy();
            }
        }

        this.farmCells = [];

        const bagSlots = BagModel.getInstance().slots || [];
        const bagCountByItemId = new Map<number, number>();
        for (let i = 0; i < bagSlots.length; i++) {
            const slot = bagSlots[i] as any;
            const id = Number(slot?.item_id);
            const count = Number(slot?.count ?? 0);
            if (!Number.isFinite(id) || id <= 0) continue;
            bagCountByItemId.set(id, Math.max(0, Number.isFinite(count) ? count : 0));
        }

        const rows = Object.keys(rawSeedsCfg)
            .map((seedKey) => {
                const seed = rawSeedsCfg[seedKey] || {};
                const itemId = Number(seed.item_id);
                const item = rawItemCfg[String(itemId)] || null;
                return {
                    seedKey: Number(seedKey),
                    itemId,
                    seed,
                    item,
                };
            })
            .filter((row) => Number.isFinite(row.itemId) && row.itemId > 0)
            .filter((row) => row.item != null)
            .filter((row) => row.seed.base_seed_price != null && row.seed.base_seed_price !== '')
            .sort((a, b) => {
                const categoryDiff = Number(a.seed.category) - Number(b.seed.category);
                if (categoryDiff !== 0) {
                    return categoryDiff;
                }
                return a.seedKey - b.seedKey;
            });

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const node = instantiate(templateNode);
            node.active = true;
            node.setParent(this.farmContent);
            const itemId = row.itemId;
            const count = bagCountByItemId.get(itemId) ?? 0;
            const displayName = String(
                row.item?.name_cn || row.seed.crop_name || row.item?.name_en || itemId
            );
            this.refreshFarmCell(node, itemId, count, row.seedKey, displayName);
            (node as any)._farmItemId = itemId;
            (node as any)._farmSeedKey = row.seedKey;
            node.name = `farm_item_${itemId}`;
            this.farmCells.push(node);
        }

        templateNode.active = false;
    }

    private async onGameFarmPlotClick(payload: GameFarmPlotClickPayload) {
        if (!this.isCurrentMapOwnedBySelf()) {
            EventSystem.send('ShowTips', '只能在自己的农场种植哦~');
            return;
        }
        const plotIndex = Number(payload?.plotIndex);
        if (!Number.isFinite(plotIndex) || plotIndex < 0) {
            return;
        }
        const farmId = payload?.farmId != null ? Number(payload.farmId) : null;
        if (farmId == null || !Number.isFinite(farmId) || farmId <= 0) {
            return;
        }

        await FarmModel.getInstance().refreshFarms();
        const plot = FarmModel.getInstance().getPlot(farmId);

        if (this.farmNode) {
            this.farmNode.active = false;
        }
        this.selectedFarmPlot = null;
        this.syncFarmChooseCellsFarmId(null);

        if (plotNeedsWaterOverlay(plot)) {
            const result = await FarmModel.getInstance().water(farmId);
            if (result.ok) {
                EventSystem.send('ShowTips', 'The watering was successful.');
            } else {
                EventSystem.send('ShowTips', result.message ?? 'The watering failed.');
            }
            return;
        }

        if (!isPlotSeedEmpty(plot)) {
            return;
        }

        this.selectedFarmPlot = {
            farmIndex: Number.isFinite(Number(payload?.farmIndex)) ? Number(payload.farmIndex) : 0,
            plotIndex,
            farmId,
            plotNodeName: payload?.plotNodeName,
        };
        if (this.rewardTarget) {
            this.rewardTarget.active = false;
        }
        if (this.atNpc) {
            this.atNpc.active = false;
        }
        this.refreshAllFarmChooseCells(farmId);
        if (this.farmNode) {
            this.farmNode.active = true;
        }
    }

    /** 打开种子面板前：重设 farmId 并重新 load 图标（避免 Sprite 空 spriteFrame onEnable） */
    private refreshAllFarmChooseCells(farmId: number | null) {
        for (let i = 0; i < this.farmCells.length; i++) {
            const node = this.farmCells[i];
            if (!node?.isValid) {
                continue;
            }
            const cell = node.getComponent(GameFarmChooseCell);
            if (!cell) {
                continue;
            }
            cell.setFarmId(farmId);
            const itemId = Number((node as any)._farmItemId);
            const seedKey = Number((node as any)._farmSeedKey);
            if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(seedKey)) {
                continue;
            }
            const count = BagModel.getInstance().getItemCount(itemId);
            cell.refreshNode(itemId, count, seedKey);
        }
    }

    private syncFarmChooseCellsFarmId(farmId: number | null) {
        for (let i = 0; i < this.farmCells.length; i++) {
            const node = this.farmCells[i];
            node?.getComponent(GameFarmChooseCell)?.setFarmId(farmId);
        }
    }

    private refreshFarmCell(
        node: Node,
        itemId: number,
        count: number,
        seedKey: number,
        _displayName?: string
    ) {
        const chooseCell = node.getComponent(GameFarmChooseCell);
        chooseCell?.setFarmId(this.selectedFarmPlot?.farmId ?? null);
        chooseCell?.refreshNode(itemId, count, seedKey, _displayName);
    }

    /** 背包变更时仅刷新种子数量，不重建列表 */
    private refreshFarmItemCounts() {
        if (!this.farmCells.length) {
            return;
        }
        for (let i = 0; i < this.farmCells.length; i++) {
            const node = this.farmCells[i];
            if (!node?.isValid) {
                continue;
            }
            const itemId = Number((node as any)._farmItemId);
            if (!Number.isFinite(itemId) || itemId <= 0) {
                continue;
            }
            const count = BagModel.getInstance().getItemCount(itemId);
            node.getComponent(GameFarmChooseCell)?.setCount(count);
        }
    }

    private async onGameFarmSeedChoose(payload: GameFarmSeedChoosePayload) {
        if (!this.isCurrentMapOwnedBySelf()) {
            EventSystem.send('ShowTips', 'You can only grow it on your own farm.~');
            return;
        }
        const farmId = this.selectedFarmPlot?.farmId;
        if (farmId == null || !Number.isFinite(farmId) || farmId <= 0) {
            EventSystem.send('ShowTips', 'Please select a piece of farmland first.');
            return;
        }

        const itemId = Number(payload?.itemId);
        const seedKey = Number(payload?.seedKey);
        if (!Number.isFinite(itemId) || itemId <= 0 || !Number.isFinite(seedKey) || seedKey <= 0) {
            return;
        }

        if (BagModel.getInstance().getItemCount(itemId) <= 0) {
            EventSystem.send('ShowTips', 'Insufficient seeds');
            return;
        }

        const plot = FarmModel.getInstance().getPlot(farmId);
        if (!isPlotSeedEmpty(plot)) {
            EventSystem.send('ShowTips', 'The plot already has a crop');
            return;
        }

        const result = await FarmModel.getInstance().grow(farmId, String(seedKey));
        if (!result.ok) {
            EventSystem.send('ShowTips', result.message ?? 'Planting failure');
            return;
        }

        if (this.farmNode) {
            this.farmNode.active = false;
        }
        this.selectedFarmPlot = null;
        EventSystem.send('ShowTips', 'Successful sowing');
    }

    private refreshBuildContentVisibility() {
        if (!this.buildContent) {
            return;
        }
        this.buildContent.active = this.isCurrentMapOwnedBySelf();
    }

    private isCurrentMapOwnedBySelf(): boolean {
        const detail = MapModel.getInstance().map_detail;
        const payload = MapModel.getInstance().showMatchPayLoad;

        // 优先 map_detail，其次 join_map 顶层 payload（若后端放在这里）
        const ownerId =
            detail?.player_id ??
            detail?.playerId ??
            payload?.player_id;

        if (ownerId == null || ownerId === '') {
            return false;
        }

        return String(ownerId) === String(RoleModel.getInstance().playerId);
    }    

    public onClickReward() {
        const text = this.editBox?.string ?? '';
        const mentions = MapChatManager.instance.buildMentionsFromText(text);
        if (mentions.length === 0) {
            EventSystem.send('ShowTips', 'Please mention an NPC first');
            return;
        }
        this.rewardTarget.active = true;
    }

    private onRewardItemClick(itemId: number) {
        const id = Number(itemId);
        if (!Number.isFinite(id) || id <= 0) {
            return;
        }
        const text = this.editBox?.string ?? '';
        const mentions = MapChatManager.instance.buildMentionsFromText(text);
        if (mentions.length === 0) {
            EventSystem.send('ShowTips', 'Please mention an NPC first');
            return;
        }
        const count = BagModel.getInstance().getItemCount(id);
        if (count <= 0) {
            EventSystem.send('ShowTips', 'Insufficient items');
            return;
        }
        void this.sendGiftItemToMentionedNpc(id, mentions[0]);
    }

    private async sendGiftItemToMentionedNpc(itemId: number, mentionKey: string) {
        const npcId = this.resolveNpcIdFromMention(mentionKey);
        if (npcId <= 0) {
            EventSystem.send('ShowTips', 'Unable to identify NPC, please @ again');
            return;
        }
        const giftText = JSON.stringify({
            event_type: 'gift_item',
            npc_id: npcId,
            item_id: itemId,
            quantity: 1,
        });
        try {
            const pm = PrivateChatManager.getInstance();
            const session = await pm.openNpcSession(npcId);
            await pm.sendText(session.peerUid, giftText);
            if (this.rewardTarget) {
                this.rewardTarget.active = false;
            }
            EventSystem.send('ShowTips', "Gift delivery successful");
            this.editBox.string = '';
        } catch (e: any) {
            EventSystem.send('ShowTips', String(e?.message || e || 'Gift delivery failed'));
        }
    }

    private resolveNpcIdFromMention(mentionKey: string): number {
        const map = MapModel.getInstance().mapNpcs as Record<string, any>;
        const npc = map[mentionKey];
        if (npc) {
            const candidates = [npc.npc_id, npc.npcId, npc.id, mentionKey];
            for (let i = 0; i < candidates.length; i++) {
                const parsed = this.parseNpcId(candidates[i]);
                if (parsed > 0) {
                    return parsed;
                }
            }
        }
        return this.parseNpcId(mentionKey);
    }

    private parseNpcId(raw: unknown): number {
        if (raw == null) {
            return 0;
        }
        const direct = Number(raw);
        if (Number.isFinite(direct) && direct > 0) {
            return direct;
        }
        const s = String(raw).trim();
        if (!s) {
            return 0;
        }
        const head = Number(s.split('_')[0]);
        if (Number.isFinite(head) && head > 0) {
            return head;
        }
        const fromPrefix = Number(s.replace(/^npc_/i, ''));
        if (Number.isFinite(fromPrefix) && fromPrefix > 0) {
            return fromPrefix;
        }
        return 0;
    }

    private onWebSocketNotification(data: any) {
        if (data?.code !== network.ServerCode.CodeBagUpdate) {
            return;
        }
        this.initRewardList();
        this.refreshFarmItemCounts();
    }

    public CloseMapEditor() {
        this.node.active = true
    }

    public onClickBuild(){
        if(!this.isCurrentMapOwnedBySelf()){
            EventSystem.send("ShowTips" , "You can only edit your own map~")
            return
        }
        this.node.active = false
        EventSystem.send("OpenMapEditor")
        EventSystem.send("focusCameraForBuildEntry")
        // MapManager.GetInstance()?.getMapEditor()?.focusCameraForBuildEntry()
    }

    public onClickShowUI(){ 
        this.showUI.active = !this.showUI.active
        this.showUIArrow.setScale(1 , this.showUI.active ? 1 : -1 , 1)
    }

    public onClickShowChatUI(){ 
        this.showChatUI.active = !this.showChatUI.active
        this.showChatArrow.setScale(1 , this.showChatUI.active ? 1 : -1 , 1)
    }

    public leaveMap(){
            FarmModel.getInstance().leaveFarm();
            
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

    public OnWebSocketMessage(data){
        if(data["id"] == "leave_map"){
            this.leaveMap()

            let request = new network.MatchLeaveEequest();
            AppConst.WebSocketManager.send(request.toJSON(MapModel.getInstance().match_id));
        }
    }

    public onClickWork(){
        AppConst.PanelManager.openView("res/View/NpcWork/NpcWorkView" , null , null , null , this.UI)
    }

    public onClickChat(){
        if(this.editBox.string != ""){
            MapChatManager.instance.sendMapChat(this.editBox.string)
            this.editBox.string = ""
        }
    }

    public OpenGameWarehouse(){
        AppConst.PanelManager.openView("res/View/Granary/GranaryView" , null , null , null , this.UI)
    }

    public OpenGameShop(){
        AppConst.PanelManager.openView("res/View/Shop/ShopList" , null , null , null , this.UI)
    }

    public onClickBag(){
        AppConst.PanelManager.openView("res/View/Bag/BagList" , null , null , null , this.UI)
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

    public onClickCloseNpcAt(){
        this.atNpc.active = false
        this.rewardTarget.active = false
        this.farmNode.active = false
        this.selectedFarmPlot = null
    }

    onDestroy() {
        EventSystem.remove(this);
    }

    public onClickNpc(a , b){
        let npcCell = a.target.getComponent("GameViewNpcCell") as GameViewNpcCell
        
        console.log("点击了NPC", npcCell["npcData"])
        this.atNpcData = npcCell["npcData"]
        this.atNpc.active = false

        this.editBox.string = `  @${this.atNpcData.name}  `
    }

    public onClickCloseScene(){

        let mapRequest = new network.leaveMapEequest();
        AppConst.WebSocketManager.send(mapRequest.toJSON(MapModel.getInstance().currentMapId));
    }

    public onEditEnd(){

        // const labelUt = showText.node.getComponent(UITransform)
        // if (!labelUt) return

        // showText.string = this.editBox.string || ''
        // showText.updateRenderData(true)

        // const lineHeight = Math.max(1, showText.lineHeight || 0)
        // const contentH = Math.max(1, labelUt.contentSize.height)
        // const lineCount = Math.max(1, Math.ceil(contentH / lineHeight))

        // const offsetY = (lineCount - 1) * this.editBoxLineOffsetY
        // const pos = this.editBox.node.position
        // this.editBox.node.setPosition(pos.x, this.editBoxBaseY + offsetY - 15, pos.z)
    }
    
    receivedData() {
        const n = MapChatManager.instance.msessages.length;
        if(n == 0) return;
        
        this.chatScroll.refreshChat(MapChatManager.instance.msessages)
    }
}

