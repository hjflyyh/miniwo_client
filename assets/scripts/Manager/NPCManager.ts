import { _decorator, Camera, Component, director, dragonBones, KeyCode, Label, Node, resources, RichText, Sprite, SpriteFrame, TiledLayer, tween, Tween, UIOpacity, UITransform, v2, v3, Vec2, Vec3, view } from 'cc';
// import WebUtils from '../utils/WebUtils';
// import { observer } from '../game/App';
// import { EventType } from '../EventType';
// import { FeelingImgUrl, NpcName } from '../StaticUtils/NPCConfig';
// import { GameScene } from '../game/scene/GameScene';
//import { zhongbencongLayer } from '../town/zhongbencongLayer';
// import { JietuComponent } from '../manager/JietuComponent';
// import { PlayerManager } from './PlayerManager';
// import { GlobalConfig } from '../game/config/GlobalConfig';
const { ccclass, property } = _decorator;

@ccclass('NpcManager')
export class NpcManager extends Component {
    @property(SpriteFrame)
    npcFrame:SpriteFrame = null;

    @property
    NpcID:number = 10006;

    @property(Node)
    bubble:Node = null;

    @property(Node)
    npcNode:Node = null;

    @property(Node)
    sendItemNode:Node = null;

    @property(Node)
    imgFeeling:Node = null;

    @property(SpriteFrame)
    skinFrameArr:SpriteFrame []= [];

    @property(SpriteFrame)
    npcBigFrame:SpriteFrame = null;


    _sleepNode: Node = null;
    _fishNode: Node = null;
    _status = null;
    _frameIndex = 0;
    _curTile:Vec2 = null;
    _tileMapLayer:Node = null;
    _isMoving = false;
    npcIndex = 0;
    _contentIndex = 0;
    _contentExIndex = 0;
    _replyContentIndex = 0;
    speakNode:Node = null;
    replyNode:Node = null;
    speakNodeEx:Node = null;
    replyContent:Label = null;
    replyName:RichText = null;
    _sleepNameLayout:Node = null;
    _actionID:number = null;
    _captureTime = 0;
    _feelingStatus = null;
    _initData = null;
    _skinId = 0;
    _skinEndTime = 0;
    _skinRecordTime = 0;
    private _isValid: boolean = true;
    protected onLoad(): void {
        this.initData()
        // observer.on(EventType.CHANGESKIN,this.changeSkinData,this);
    }
    start() {

    }

    protected onDestroy(): void {
        this._isValid = false;
        // observer.off(EventType.CHANGESKIN,this.changeSkinData,this);
    }

    initNpcData(npcData){
        this._initData = npcData;
        console.log("npcID====")
        console.log("npcID"+this.NpcID+" skinID====" + JSON.stringify(this._initData.dressId))
        this.setNpcSkin(this._initData.dressId)
        this._skinEndTime = this._initData.dressEndTime || 0;
        this._skinRecordTime = new Date().getTime();
    }

    //初始化功能节点
    initData(){
        this.checkSpeakObj();
        if(this.npcNode.children.length > 0){
            this.npcNode.children[0].active = false;
        }
        this._tileMapLayer = this.node.parent.parent;
        this._sleepNode = this.node.getChildByName("sleepNode");
        if(this._sleepNode){
            this._sleepNode.active = false;
            this._sleepNameLayout = this._sleepNode.getChildByName("nameLayout");
        }
        this._fishNode = this.node.getChildByName("fishNode");
        if(this._fishNode){
            this._fishNode.active = false;
        }
        this.setNpcSkin(0);
        this.setIdleStatus(KeyCode.KEY_S);

        if(this.sendItemNode){
            const armatureDisplay = this.sendItemNode.getComponent(dragonBones.ArmatureDisplay);
            // 监听动画播放完成事件
            armatureDisplay.addEventListener(dragonBones.EventObject.LOOP_COMPLETE, this.onAnimationComplete, this);
            this.sendItemNode.active = false;
        }
    }

    update(deltaTime: number) {
        //根据npc角色当前位置通过渲染帧时时更新对话框位置
        // this.checkSpeakObj();
        // let mapScript = director.getScene().getComponentInChildren(GameScene).getMapScript();
        // let npcWorldPos =  this.node.getComponent(UITransform).convertToWorldSpaceAR(v3(0,0,0));
        // let speakLayer  = mapScript.speakLayer
        // let targetPos = speakLayer.getComponent(UITransform).convertToNodeSpaceAR(npcWorldPos);
        // if(this.speakNode){
        //     this.speakNode.setPosition(targetPos)
        // }
        // if(this.replyNode){
        //     this.replyNode.setPosition(targetPos);
        // }
        // if(this.speakNodeEx){
        //     this.speakNodeEx.setPosition(targetPos);
        // }
        // //NPC相遇打招呼功能
        // if(this._isMoving){
        //     // this.node.parent.children.forEach(node=>{
        //     //     if(node.getComponent(NpcManager).NpcID != this.NpcID){
        //     //         let otherTile = this._getTilePos(v2(node.position.x,node.position.y));
        //     //         let myTile = this._getTilePos(v2(this.node.position.x,this.node.position.y));
        //     //         if(otherTile.x == myTile.x){
        //     //             if(Math.abs(otherTile.y - myTile.y) < 3){
        //     //                 this.showHelloBubble();
        //     //                 node.getComponent(NpcManager).showHelloBubble();
        //     //             }
        //     //         }
        //     //     }
        //     // })
        // }
        // else{
        //     //中本聪地图特定格子上NPC朝向设定
        //     // let zhongbencongSrc = director.getScene().getComponentInChildren(zhongbencongLayer);
        //     // if(this._curTile && this._curTile.x == 18 && this._curTile.y == 104 && zhongbencongSrc){
        //     //     if(this.npcNode.getComponent(dragonBones.ArmatureDisplay).armatureName != "up"){
        //     //         this.npcNode.getComponent(dragonBones.ArmatureDisplay).armatureName = "up"
        //     //         this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("standby",0);
        //     //     }
        //     // }
        // }
    }

    //设置静止状态朝向
    setIdleStatus(dir:number){
        this._status = "idle"
        Tween.stopAllByTarget(this.npcNode);
        if(dir == KeyCode.KEY_S){
            if(Number(this.NpcID) == 10010){
                this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("right_standby",0);
            }
            else{
                this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("down_standby",0);
            }
        }
        else if(dir == KeyCode.KEY_W){
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("up_standby",0);
        }
        else if(dir == KeyCode.KEY_A){
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("left_standby",0);
        }
        else if(dir == KeyCode.KEY_D){
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("right_standby",0);
        }

        let curtile = this._getTilePos(v2(this.node.position.x,this.node.position.y));
        if(curtile.x == 22 && curtile.y == 13){
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("right_standby",0);
        }

        if(curtile.x == 24 && curtile.y == 13){
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("left_standby",0);
        }
    }

    //向上运动动画播放
    setUpAnimation(){
        if(this._status != "up"){
            this._status = "up";
            Tween.stopAllByTarget(this.npcNode);
            this._frameIndex = 0;
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("up_walk",0);
        }
    }

    //向下运动动画播放
    setDownAnimation(){
        if(this._status != "down"){
            this._status = "down";
            Tween.stopAllByTarget(this.npcNode);
            this._frameIndex = 0;
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("down_walk",0);
        }
    }

    //向左运动动画播放
    setLeftAnimation(){
        if(this._status != "left"){
            this._status = "left";
            Tween.stopAllByTarget(this.npcNode);
            this._frameIndex = 0;
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("left_walk",0);
        }
    }

    //向右运动动画播放
    setRightAnimation(){
        if(this._status != "right"){
            this._status = "right";
            Tween.stopAllByTarget(this.npcNode);
            this._frameIndex = 0;
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("right_walk",0);
        }
    }

    //展示气泡
    showBubble(bubbleType:string){
        Tween.stopAllByTarget(this.bubble);
        this.bubble.setScale(v3(0,0,1));
        this.bubble.active = true;
        // WebUtils.getResouceImg(
        //     bubbleType,
        //     this.bubble
        //   );
        Tween.stopAllByTarget(this.bubble)
        tween(this.bubble).to(0.2,{scale:v3(1,1,1)}).call(()=>{
            tween(this.bubble).repeatForever(tween(this.bubble).to(0.4,{scale:v3(1.12,1.12,1)}).to(0.4,{scale:v3(1,1,1)}).start()).start()
        }).start();
    }

    showHelloBubble(){
        // let bubbleFrameName = this.bubble.getComponent(Sprite).spriteFrame.name;
        // if(bubbleFrameName.includes("bubble_chat") && this.bubble.active){
        //     return;
        // }
        // Tween.stopAllByTarget(this.bubble);
        // this.bubble.setScale(v3(1,1,1));
        // this.bubble.active = true;
        // let bubbleType = "action/bubble/bubble_chat_" + Math.floor(Math.random() * 3);
        // WebUtils.getResouceImg(
        //     bubbleType,
        //     this.bubble
        //   );
        // Tween.stopAllByTarget(this.bubble)
        // tween(this.bubble).delay(2).call(()=>{
        //     this.bubble.active = false;
        // }).start();
    }

    //隐藏气泡
    hideBubble(){
        Tween.stopAllByTarget(this.bubble);
        tween(this.bubble).to(0.2,{scale:v3(0,0,1)}).call(()=>{
            this.bubble.active = false;
        }).start();
    }

    //根据路径移动
    serverPathMove(path:any,direction = "down"){
        console.log("serverpath========" + JSON.stringify(path));
        Tween.stopAllByTarget(this.node);
        let sequence = [];
        let prePos = this.node.getPosition()
        let height = this._tileMapLayer.getComponent(UITransform).contentSize.height;
        for (let i = 1; i < path.length; i++) {
            let npcTile =  this._getTilePos(v2(path[i].x * 32, height - (path[i].y*32)));
            let actionPosition = this._tileMapLayer.getChildByName("building").getComponent(TiledLayer).getPositionAt(npcTile);
            // actionPosition.x += tileSize.width / 2;
            // actionPosition.y += tileSize.width / 2;
            sequence.push(tween(this.node)
            .to(0.18, {position: new Vec3(actionPosition.x, actionPosition.y)}).call(()=>{
                let steepKey: KeyCode
                if(prePos.x < actionPosition.x){
                    steepKey = KeyCode.KEY_D
                    this.setRightAnimation();
                }if(prePos.x > actionPosition.x){
                    steepKey = KeyCode.KEY_A
                    this.setLeftAnimation();
                }if(prePos.y < actionPosition.y){
                    this.setUpAnimation();
                }if(prePos.y > actionPosition.y){
                    steepKey = KeyCode.KEY_S
                    this.setDownAnimation();
                }
                this._curTile = this._getTilePos(this.node.getPosition())
                prePos.x = actionPosition.x
                prePos.y = actionPosition.y
            }))
        }
        if(sequence.length > 0){
            this._isMoving = true;
        }
        let idleKey = KeyCode.KEY_S;
        switch(direction){
            case "down":
                idleKey = KeyCode.KEY_S;
                break;
            case "up":
                idleKey = KeyCode.KEY_W;
                break;
            case "left":
                idleKey = KeyCode.KEY_A;
                break;
            case "right":
                idleKey = KeyCode.KEY_D;
                break;
        }
        tween(this.node).sequence(...sequence).call(()=>{
            this.setIdleStatus(idleKey);
            this._isMoving = false;
        }).start()
    }

    //根据坐标划算NPC所在格子(输入坐标参考系锚点为地图左上角)
    _getTilePos (posInPixel:{x:number, y:number}) {
        const mapSize = this._tileMapLayer.getComponent(UITransform).contentSize;       
        const x = Math.floor(posInPixel.x / 32);
        const y = Math.floor((mapSize.height - posInPixel.y) / 32);
        return new Vec2(x, y - 1);
    }

    //说话行为
    speak(str:string){
        if(!str){
            return;
        }
        this.checkSpeakObj();
        const content = str;
        this.replyNode.active = false;
        this.speakNodeEx.active = false;
        Tween.stopAllByTarget(this.speakNode);
        this.bubble.getComponent(UIOpacity).opacity = 0;

        this.speakNode.getComponentInChildren(Label).string = "";
        this.speakNode.active = true;
        this._contentIndex = 0;
        this.checkMorpheusCapture(content);
        this.checkNewCapture(content)
        tween(this.speakNode).repeat(content.length,tween(this.speakNode).delay(0.1).call(()=>{
            if(!this.speakNode){
                return;
            }
            if(content[this._contentIndex]){
                if(this.speakNode.getComponentInChildren(Label).string.length < 260){
                    this.speakNode.getComponentInChildren(Label).string = this.speakNode.getComponentInChildren(Label).string + content[this._contentIndex];
                }
                else{
                    this.speakNode.getComponentInChildren(Label).string = "" + content[this._contentIndex];
                }
                this._contentIndex++
            }
        }).start()).start()

        let endTime = 3 + content.length * 0.1
        tween(this.speakNode).delay(endTime).call(()=>{
            if(!this.speakNode){
                return;
            }
            this.speakNode.active = false;
            this.bubble.getComponent(UIOpacity).opacity = 255;
            this.checkStopRecording();
            this.checkStopNewRecording();
        }).delay(2).call(()=>{
            this.speakNode.active = false;
        }).start()
    }

    getNPCID(){
        return this.NpcID;
    }

    //回复行为
    replyMsg(name,str,userNo){
        this.checkSpeakObj();
        const content = str;
        this.speakNode.active = false;
        this.speakNodeEx.active = false;
        Tween.stopAllByTarget(this.replyNode);
        this.bubble.getComponent(UIOpacity).opacity = 0;
        this.replyContent.string = "";
        this.replyName.string = "<color=#000000>Reply to</color>" + "<color=#FFC544>" + name + "</color>" + "<color=#000000>:</color>";
        //let isHavePlayer = false;
        // director.getScene().getComponentsInChildren(PlayerManager).forEach(playerScript=>{
        //     if(playerScript._playerData.userNo == userNo){
        //         let playerName = playerScript.playerNode.getComponentInChildren(Label).string;
        //         this.replyName.string = "<color=#000000>Hi </color>" + "<color=#FFC544>" + playerName + "</color>" + "<color=#000000>:</color>";
        //     }
        // })
        this.replyNode.active = true;
        this._replyContentIndex = 0;
        tween(this.replyNode).repeat(content.length,tween(this.replyNode).delay(0.1).call(()=>{
            if(!this.replyNode){
                return;
            }
            if(content[this._replyContentIndex]){
                if(this.replyContent.string.length < 260){
                    this.replyContent.string = this.replyContent.string + content[this._replyContentIndex];
                }
                else{
                    this.replyContent.string = "" + content[this._replyContentIndex];
                }
                this._replyContentIndex++
            }
        }).start()).start()
        let endTime = 3 + content.length * 0.1
        tween(this.replyNode).delay(endTime).call(()=>{
            if(!this.replyNode){
                return;
            }
            this.replyNode.active = false;
            this.bubble.getComponent(UIOpacity).opacity = 255;
        }).start()
    }

    //睡觉行为
    sleepStart(){
        if(this._sleepNode){
            this._sleepNode.active = true;
            this.npcNode.active = false;
            this.bubble.active = false;
            this.npcNode.children[0].active = false;
            if(this.speakNode){
                this.speakNode.active = false;
            }
            if(this.replyNode){
                this.replyNode.active = false;
            }
            if(this.speakNodeEx){
                this.speakNodeEx.active = false;
            }
            Tween.stopAllByTarget(this._sleepNode);
            tween(this._sleepNode).repeatForever(tween(this._sleepNode).delay(1).call(()=>{
                this._sleepNode.getChildByName("sleep_1").active = !this._sleepNode.getChildByName("sleep_1").active;
                this._sleepNode.getChildByName("sleep_2").active = !this._sleepNode.getChildByName("sleep_2").active;
            }).start()).start();

            let sleepBubble = this._sleepNode.getChildByName("sleepBubble");
            Tween.stopAllByTarget(sleepBubble);
            tween(sleepBubble).to(0.2,{scale:v3(1,1,1)}).call(()=>{
                tween(sleepBubble).repeatForever(tween(sleepBubble).to(0.4,{scale:v3(1.12,1.12,1)}).to(0.4,{scale:v3(1,1,1)}).start()).start()
            }).start();
        }
    }

    sleepFinish(){
        if(this._sleepNode){
            this._sleepNode.active = false;
            this._sleepNameLayout.active = false;
            this.npcNode.active = true;
        }
    }

    //钓鱼行为
    fishStart(dir){
        console.log("dir======" + dir);
        if(this._fishNode){
            this._fishNode.active = true;
            Tween.stopAllByTarget(this._fishNode);
            this._fishNode.children.forEach(node=>{
                node.active = node.name == "fish_" + dir +"_1" ? true : false;
            })
            tween(this._fishNode).repeatForever(tween(this._fishNode).delay(0.8).call(()=>{
                this._fishNode.getChildByName("fish_" + dir +"_1").active = !this._fishNode.getChildByName("fish_" + dir +"_1").active;
                this._fishNode.getChildByName("fish_" + dir +"_2").active = !this._fishNode.getChildByName("fish_" + dir +"_2").active;
            }).start()).start();
        }
    }

    fishFinish(){
        if(this._fishNode){
            this._fishNode.active = false;
        }
    }

    //点击回调
    onBtnNpcClick(){
        //testFUNC
        // let testScale = Math.random() > 0.5 ? 1 : -1;
        // let testItemId = Math.random() > 0.5 ? "test01" : "test02";
        // this.playSendItemAction(testScale,testItemId);
        // return;
        // const currentUrl = window.location.href;
        // const url = new URL(currentUrl);
        // // 获取查询参数
        // let codeParam = url.searchParams.get("version");
        // if(codeParam == "live"){
        //     return;
        // }
        // let mapScript = director.getScene().getComponentInChildren(GameScene).getMapScript();
        // if(mapScript && mapScript._myPlayerNode){
        //     observer.post(EventType.PLAYERCLICK,this.NpcID);
        //     return;
        // }
        // observer.post(EventType.FOLLOWNPC,this.NpcID);
        
        // console.log("npctile======" + this._curTile);
        // console.log("npcPos======" + JSON.stringify(this.node.position));
    }

    //直播模式展示NPC名称
    showNpcName(){
        if(this._sleepNode && this._sleepNode.active){
            if(this._sleepNameLayout.active){

            }
            else{
                // this._sleepNameLayout.active = true;
                // this._sleepNameLayout.getComponentInChildren(Label).string = NpcName[Number(this.NpcID)];
                // let sprNode = this._sleepNameLayout.getChildByName("imgNameDir");
                // Tween.stopAllByTarget(sprNode);
                // tween(sprNode).repeatForever(tween(sprNode).to(0.3,{scale:v3(0.8,0.8,1)}).to(0.3,{scale:v3(1,1,1)}).start()).start();
            }
        }
        if(this.npcNode.children[0].active){

        }
        else{
            // this.npcNode.children[0].active = !GlobalConfig.instance.isStoryModel;
            // this.npcNode.children[0].getComponentInChildren(Label).string = NpcName[Number(this.NpcID)];
            // let sprNode = this.npcNode.children[0].getChildByName("imgNameDir");
            // Tween.stopAllByTarget(sprNode);
            // tween(sprNode).repeatForever(tween(sprNode).to(0.3,{scale:v3(0.8,0.8,1)}).to(0.3,{scale:v3(1,1,1)}).start()).start();
        }
    }

    getNpcTile(){
        return this._curTile;
    }

    //说话行为（下方聊天框）
    speakEx(str:string){
        this.checkSpeakObj();
        const content = str;
        this.replyNode.active = false;
        this.speakNode.active = false;
        Tween.stopAllByTarget(this.speakNodeEx);
        this.bubble.getComponent(UIOpacity).opacity = 0;

        this.speakNodeEx.getComponentInChildren(Label).string = "";
        this.speakNodeEx.active = true;
        this._contentExIndex = 0;
        this.checkMorpheusCapture(content);
        this.checkNewCapture(content);
        tween(this.speakNodeEx).repeat(content.length,tween(this.speakNodeEx).delay(0.1).call(()=>{
            if(content[this._contentExIndex]){
                if(!this.speakNodeEx){
                    return;
                }
                if(this.speakNodeEx.getComponentInChildren(Label).string.length < 260){
                    this.speakNodeEx.getComponentInChildren(Label).string = this.speakNodeEx.getComponentInChildren(Label).string + content[this._contentExIndex];
                }
                else{
                    this.speakNodeEx.getComponentInChildren(Label).string = "" + content[this._contentExIndex];
                }
                this._contentExIndex++
            }
        }).start()).start()

        let endTime = 3 + content.length * 0.1
        tween(this.speakNodeEx).delay(endTime).call(()=>{
            if(!this.speakNodeEx){
                return;
            }
            this.speakNodeEx.active = false;
            this.bubble.getComponent(UIOpacity).opacity = 255;
            this.checkStopRecording();
            this.checkStopNewRecording();
        }).delay(2).call(()=>{
            this.speakNodeEx.active = false;
        }).start()
    }

    //聊天框绑定
    checkSpeakObj(){
        // let mapScript = director.getScene().getComponentInChildren(GameScene).getMapScript();
        // if(!mapScript){
        //     console.log("mapScript find error")
        //     return;
        // }
        // if(!this.speakNode){
        //     this.speakNode = mapScript._npcSpeakObj["speak_" + this.NpcID];
        // }

        // if(!this.replyNode){
        //     this.replyNode = mapScript._npcSpeakObj["reply_" + this.NpcID];
        //     this.replyContent = this.replyNode.getChildByName("speakLayout").getChildByName("replyContent").getComponent(Label);
        //     this.replyName = this.replyNode.getChildByName("speakLayout").getChildByName("replyName").getComponent(RichText);
        // }

        // if(!this.speakNodeEx){
        //     this.speakNodeEx = mapScript._npcSpeakObj["speakEx_" + this.NpcID];
        // }
    }

    getMoveState(){
        return this._isMoving;
    }

    setActionID(actionID:number){
        this._actionID = actionID;
    }

    getActionID(){
        return this._actionID;
    }

    startSpeech(){
        this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("speech",0);
    }

    stopSpeech(){

    }

    checkMorpheusCapture(content){
        if(Number(this.NpcID)!=10013){
            return false;
        }
        if(!this.npcNode.children[0].active){
            return false;
        }
        // let gameScene = director.getScene().getComponentInChildren(GameScene)
        // if(gameScene.getVersion() == "capture"){
        //     let nowTime = new Date().getTime();
        //     let durTime = Math.floor((nowTime - this._captureTime)/1000);
        //     if(durTime > 600){
        //         director.getScene().getComponentInChildren(JietuComponent).startRecording(content);
        //         this._captureTime = nowTime;
        //         return true;
        //     }
        // }
    }

    checkNewCapture(content){
        // let gameScene = director.getScene().getComponentInChildren(GameScene);
        // if(gameScene.getVersion() != "newcapture"){
        //     return;
        // }
        // if(gameScene.getFollowNpcId() == this.NpcID){
        //     director.getScene().getComponentInChildren(JietuComponent).startRecording(content,this.NpcID);
        //     return true;
            
        // }

    }

    checkStopRecording(){
        if(Number(this.NpcID)!=10013){
            return false;
        }
        // let gameScene = director.getScene().getComponentInChildren(GameScene)
        // if(gameScene.getVersion() == "capture"){
        //     director.getScene().getComponentInChildren(JietuComponent).stopRecording();
        // }
    }

    checkStopNewRecording(){
        // let gameScene = director.getScene().getComponentInChildren(GameScene);
        // if(gameScene.getVersion() != "newcapture"){
        //     return;
        // }
        // if(gameScene.getFollowNpcId() == this.NpcID){
        //     director.getScene().getComponentInChildren(JietuComponent).stopRecording();
        //     gameScene.flollowNpcByLive(Number(this.NpcID) + 1);
        // }
    }
    //"none", "happy", "sad", "curious", "anger".
    setFeelingStatus(status:string){
        console.log("status=======" + status);
        if(!status){
            return;
        }
        this._feelingStatus = status;
        switch(status){
            case "none" :
                break;
            default :
                this.imgFeeling.active = true;
                // WebUtils.getResouceImg(FeelingImgUrl[status],this.imgFeeling);
                this.imgFeeling.getComponent(UIOpacity).opacity = 0;
                tween(this.imgFeeling.getComponent(UIOpacity)).to(0.3,{opacity:255}).call(()=>{
                    let time = 1.2;
                    let maxMagnitude = 10;
            
                    // 振动的次数：根据振动的总时间和单次振动时间来计算
                    let vibrationTimes = 6; // 每个方向的振动次数
                    let vibrationInterval = time / vibrationTimes;
            
                    tween(this.imgFeeling)
                        .then(
                            tween(this.imgFeeling)
                            .to(vibrationInterval, { position: this._getRandomPosition(maxMagnitude) })
                            .to(vibrationInterval, { position: this._getRandomPosition(maxMagnitude) })
                            .to(vibrationInterval, { position: this._getRandomPosition(maxMagnitude) })
                        )
                        .repeat(vibrationTimes)  // 振动次数
                        .start();
                }).delay(1.2).to(0.3,{opacity:0}).start();
                break;

        }
    }

    // 获取一个随机的振动位置
    _getRandomPosition(maxMagnitude) {
        // 随机生成一个x和y的偏移量
        let x = Math.random() * maxMagnitude * 2 - maxMagnitude;  // 随机在[-maxMagnitude, maxMagnitude]范围内
        let y = Math.random() * maxMagnitude * 2 - maxMagnitude;  // 随机在[-maxMagnitude, maxMagnitude]范围内
        return v3(x, y,0);  // 返回一个新的 Vec2 对象
    }

    //测试接口
    testFunction(){
        let amaturename = this.npcNode.getComponent(dragonBones.ArmatureDisplay).getArmatureNames();
        console.log(this.NpcID + "amaturename========"+JSON.stringify(amaturename))
        if(this.NpcID == 10012){
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).armatureName = "down";
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("walk",0);
            return;
        }
        amaturename.forEach(name=>{
            if(name == "send"){
                this.npcNode.getComponent(dragonBones.ArmatureDisplay).armatureName = name;
                this.npcNode.getComponent(dragonBones.ArmatureDisplay).armature().animation.animationNames.forEach(animationname=>{
                    if(animationname.includes("send")){
                        console.log(this.NpcID + "animationName========"+animationname)
                        this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation(animationname,0);
                    }
                })
            }
        })
    }

    playSendItemAction(scaleX,itemId){
        console.log("playSendItemAction======" + scaleX + " " + itemId);
        if(this.sendItemNode){
            if(scaleX > 0){
                this.setIdleStatus(KeyCode.KEY_D);
            }
            else{
                this.setIdleStatus(KeyCode.KEY_A);
            }
            this.npcNode.active = false;
            this.sendItemNode.active = true;
            this.sendItemNode.setScale(v3(scaleX,1,1))
            this.sendItemNode.getComponent(dragonBones.ArmatureDisplay).armature().animation.animationNames.forEach(animationname=>{
                if(animationname.includes("send")){
                    this.sendItemNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("send",0);
                }
            })
            resources.load("common/image/item_" + itemId + "/spriteFrame",SpriteFrame,(err,spr:SpriteFrame)=>{
                if(err || !this._isValid){
                    console.log("item load error" + err);
                    return;
                }

                this.sendItemNode.getComponentInChildren(Sprite).spriteFrame = spr;
            });
        }
    }

    onAnimationComplete(){
        if(this.sendItemNode.getComponent(dragonBones.ArmatureDisplay).animationName.includes("send")){
            this.npcNode.active = true;
            this.sendItemNode.active = false;
        }
    }

    setNpcSkin(skinId){
        this._skinId = skinId
        let amaturename = this.npcNode.getComponent(dragonBones.ArmatureDisplay).getArmatureNames();
        let nowAnimationName = this.npcNode.getComponent(dragonBones.ArmatureDisplay).animationName;
        if(!skinId){
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).armatureName = "normal";
            this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation(nowAnimationName,0);
            return;
        }
        amaturename.forEach(name=>{
            if(name.includes(skinId.toString())){
                this.npcNode.getComponent(dragonBones.ArmatureDisplay).armatureName = name;
                this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation(nowAnimationName,0);
            }
        })
    }

    changeSkinData(data){
        console.log("skinData=======" + JSON.stringify(data.data));
        //{"requestId":0,"type":1,"command":10108,"code":0,"data":{"dressId":1001401,"npcId":10014}}
        if(data.data.data.npcId == Number(this.NpcID)){
            this.setNpcSkin(data.data.data.dressId);
            this._skinEndTime = data.data.data.endTime;
            this._skinRecordTime = new Date().getTime();
        }
    }

    calLeftTime(){
        if(this._skinEndTime){
            let nowTime = new Date().getTime();
            let durTime = nowTime - this._skinRecordTime;
            let leftTime = this._skinEndTime - durTime;
            if(leftTime > 0){
                return leftTime;
            }
            else{
                return 0;
            }
        }
        else{
            return 0;
        }
    }

    playDataAnimation(){
        this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("fillthefile",0);
    }

    playWaterAnimation(){
        this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("water",0);
    }

    playMakeCakeAnimation(){
        this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("bake",0);
    }

    playSportAnimation(){
        this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("workout",0);
    }

    playDrawAnimation(){
        this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("paint",0);
    }

    playLiveAnimation(){
        this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("message",0);
    }

    playToAiAnimation(){
        this.npcNode.getComponent(dragonBones.ArmatureDisplay).playAnimation("speak",0);
    }

    loadItemImage(itemId: number, callback: (spriteFrame: SpriteFrame) => void) {
        resources.load("common/image/item_" + itemId + "/spriteFrame",SpriteFrame,(err,spr:SpriteFrame)=>{
            if (!this._isValid) return;
            if(err){
                console.log(err);
            }
            else{
                callback(spr);
            }
        })
    }
}


