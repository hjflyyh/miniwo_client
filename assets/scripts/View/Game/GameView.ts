import { _decorator, Component, EditBox, Label, math, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { network } from '../../Model/RequestData';
import { RoleModel } from '../../Model/RoleModel';
import { HttpManager } from '../../Manager/HttpManager';
import { MapChatManager } from '../../Manager/ChatManager';
import { MapModel } from '../../Model/MapModel';
import { YXCollectionView, YXIndexPath } from 'db://assets/plugin/list-3x/yx-collection-view';
import { CustomGridFlowLayout } from 'db://assets/plugin/list-3x/custom-grid-flow-layout';
import { GameViewChatCell } from './GameViewChatCell';
const { ccclass, property } = _decorator;

@ccclass('GameView')
export class GameView extends Component {
    @property(EditBox)
    editBox: EditBox = null!;

    @property(Label)
    mapName: Label = null!;

    @property(YXCollectionView)
    followScroll: YXCollectionView = null

    private column = 1
    private alignment = 1

    start() {
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
    }

    public onClickChat(){
        if(this.editBox.string != ""){
            MapChatManager.instance.sendMapChat(this.editBox.string)
        }
    }

    updateFlowLayout(column: number = this.column, alignment: number = this.alignment) {
        let layout = new CustomGridFlowLayout()
        layout.horizontalSpacing = 10
        layout.verticalSpacing = 10
        layout.alignment = alignment
        
        layout.itemSize = new math.Size(600, 100)
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

