import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('tileIcon')
export class tileIcon extends Component {
    public tileId
    public tileType

    start() {

    }
    
    onClick(){
        if(this.tileType == "Ground"){
            EventSystem.send("OnClickTileGroundIcon" , this.tileId)
        }else if(this.tileType == "Floor"){
            EventSystem.send("OnClickFloorIcon" , {id : this.tileId , tileType : this.tileType})
        }else{
            EventSystem.send("OnClickTileOhterIcon" , {id : this.tileId , tileType : this.tileType})
        }
    }
}


