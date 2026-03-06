export class NPCRoomData {
    public bannerUrl : string
    public epList : string[]
    public id : number
    public npcList : []
    public order : number
    public playerCount : number
    public tweetUrl : string
}

export class RoomData{
    public otherNpc : [];
    public furnitureMsgDataMap;
    public roomItemDataList;
    public sceneItemMap = {1:"url"};
    public aiState;
}

//RoomData npc定义
export class OtherNpc{
    public id
    public name
    public type
    public model
    public career
    public keyword
    public hair
    public top
    public bottoms
    public speed
    public x
    public y
    public endTime
    public items
    public dressId
    public dressEndTime
    public requestData = {
        "npcId": 0,
        "actionId": 0,
        "bid": 0,
        "params": {path : [{x:0 , y:0}] , direction:""},
        "startTime": 0,
        "endTime": 0,
        "focus": 0
    }
}