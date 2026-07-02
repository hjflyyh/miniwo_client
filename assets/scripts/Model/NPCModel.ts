import { log } from "cc";
import { AppConst } from "../AppConst";
import { network } from "./RequestData";
import { NPCRoomData, RoomData } from "./Dao/RoomData";

export class NPCModel {
    private static _instance: NPCModel = null;

    public roomDataList : NPCRoomData[]

    public static getInstance(): NPCModel {
        if (!this._instance) {
            this._instance = new NPCModel();
        }
        return this._instance;
    }

    public static resetInstance(): void {
        NPCModel._instance = null;
    }

    public init(){
        EventSystem.addListent("WebSocketMessage" , this.OnWebSocketMessage , this)
    }

    //请求所有npc
    public sendNPCList(){
        let json = new network.GetAllNPCRequest();
        AppConst.WebSocketManager.send(json.toJSON());
    }

    //请求房间信息
    public sendRoomData(){
        let json = new network.GetRoomDataRequest();
        AppConst.WebSocketManager.send(json.toJSON());
    }

    private OnWebSocketMessage(data){
        // if(data.command == network.ServerCommandConstants.COMMON_NPC_LIST){
        //     this.roomDataList = []
        //     let roomDataList = data.data.roomDataList
        //     for(let r = 0 ; r < roomDataList.length ; r++){
        //         let roomData = new NPCRoomData();
        //         roomData.bannerUrl = roomDataList[r].bannerUrl
        //         roomData.epList = roomDataList[r].epList
        //         roomData.id = roomDataList[r].id
        //         roomData.order = roomDataList[r].order
        //         roomData.playerCount = roomDataList[r].playerCount
        //         roomData.tweetUrl = roomDataList[r].tweetUrl
        //         roomData.npcList = roomDataList[r].npcList

        //         this.roomDataList.push(roomData);
        //     }
        // }
        // if(data.command == network.ServerCommandConstants.COMMON_ROOM_DATA){
        //     let roomData = new RoomData();
        //     let serverData = data.data
        //     roomData.aiState = serverData.aiState
        //     roomData.furnitureMsgDataMap = serverData.furnitureMsgDataMap
        //     roomData.roomItemDataList = serverData.roomItemDataList
        //     roomData.sceneItemMap = serverData.sceneItemMap
        //     roomData.otherNpc = serverData.otherNpc
        // }
    }
}