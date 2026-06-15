import { _decorator, Component, Node , Label , tween , v3 , UITransform , Sprite , SpriteFrame , assetManager} from 'cc';
import { AppConst } from '../AppConst';
// import { MapAssetsManager } from '../../src/common/MapAssetsManager';

const { ccclass, property } = _decorator;

@ccclass('Loading')
export class Loading extends Component {
    _timeDur:number = 0;
    @property(Node)
    public lblText: Node;

    @property(Node)
    imgCloudArr: Node[] = [];

    @property(Node)
    imgPlanetArr: Node[] = [];

    @property(Node)
    imgGrassArr: Node[] = [];

    // @property(Node)
    // public npcNode: Node;

    _frameIndex: number = 0;

    @property(SpriteFrame)
    animationFrameArr: SpriteFrame[] = [];

    bundleNames: Array<string> = ["mapEditor"];

    //初始化任务，加载bundle，加载config
    initTaskQueue = {}
    taskBundle = "loadBundle"
    taskConfig = "loadConfig"

    private loadSuccessBundleNum = 0;
    start() {
      this.initTaskQueue[this.taskBundle] = false
      this.initTaskQueue[this.taskConfig] = false

      this.initImgAnim();
      this.scheduleOnce(function(){
        this.loadBundles();
      } , 0.1)
      this.initSocket();

      EventSystem.addListent("ConfigLoadAll" , this.OnConfigLoadAll , this)
    }

    initSocket(){
      // AppConst.WebSocketManager.setConfig("ws://192.168.30.30:8686/");

      // AppConst.WebSocketManager.connect();
    }

    //配置加载完成
    OnConfigLoadAll(){
      console.log("配置加载完成")
      this.initTaskQueue[this.taskConfig] = true
      this.checkInitTask()
    }

    checkInitTask(){
        for(let i in this.initTaskQueue){
          if(!this.initTaskQueue[i]){
            return
          }
        }
        console.log("所有初始化任务完成")  
        EventSystem.send("InitTaskQueueSuccess")
    }

    loadBundles(){
      if(this.bundleNames.length <= 0){
        this.initTaskQueue[this.taskBundle] = true
        this.checkInitTask();
      }else{
        for(let b = 0 ; b < this.bundleNames.length ; b++){
          var bundleName = this.bundleNames[b]
          let _this = this
          assetManager.loadBundle(this.bundleNames[b], (err, loadedBundle) => {
            if (err) {
                console.error(`加载 Bundle ${bundleName} 失败:`, err);
                return;
            }

            AppConst.PanelManager.bundles[loadedBundle.name] = loadedBundle
            console.log(`Bundle ${loadedBundle.name} 加载成功`);
            _this.loadSuccessBundleNum++;
            if(_this.loadSuccessBundleNum == _this.bundleNames.length){
              console.log("所有Bundle加载完成");
              this.initTaskQueue[this.taskBundle] = true
              this.checkInitTask();
              // MapAssetsManager.GetInstance().loadMapEditorAssets();
              }
          });
        }
      }
    }

    initImgAnim(){
        this.imgCloudArr.forEach(cloudNode=>{
            tween(cloudNode).repeatForever(tween(cloudNode).by(0.2,{position:v3(-5,0,0)}).call(()=>{
              if(cloudNode.position.x <= -300){
                cloudNode.setPosition(v3(300+cloudNode.getComponent(UITransform).contentSize.width,cloudNode.position.y,0));
              }
            }).start()).start()
          })
          this.imgPlanetArr.forEach(planet=>{
            tween(planet).repeatForever(tween(planet).by(0.15,{position:v3(-5,0,0)}).call(()=>{
              if(planet.position.x <= -300){
                planet.setPosition(v3(300+planet.getComponent(UITransform).contentSize.width,planet.position.y,0));
              }
            }).start()).start()
          })
          this.imgGrassArr.forEach(grass=>{
            tween(grass).repeatForever(tween(grass).by(0.02,{position:v3(-5,0,0)}).call(()=>{
              if(grass.position.x <= -300){
                grass.setPosition(v3(300+grass.getComponent(UITransform).contentSize.width,grass.position.y,0));
              }
            }).start()).start()
          })

          this._frameIndex = 0;
          // this.npcNode.getComponent(Sprite).spriteFrame = this.animationFrameArr[this._frameIndex];
          // if (this.animationFrameArr.length > 0) {
          //   tween(this.npcNode).repeatForever(tween(this.npcNode).delay(0.12).call(() => {
          //     if (this._frameIndex < this.animationFrameArr.length - 1) {
          //       this._frameIndex++;
          //     }
          //     else {
          //       this._frameIndex = 0
          //     }
          //     this.npcNode.getComponent(Sprite).spriteFrame = this.animationFrameArr[this._frameIndex];
          //   }).start()).start();
          // }
    }

    protected update(dt: number): void {
        this._timeDur = this._timeDur + dt;
        if(this._timeDur > 0.5){
          if(this.lblText.getComponent(Label).string == "Loading"){
            this.lblText.getComponent(Label).string = "Loading."
          }
          else if(this.lblText.getComponent(Label).string == "Loading."){
            this.lblText.getComponent(Label).string = "Loading.."
          }
          else if(this.lblText.getComponent(Label).string == "Loading.."){
            this.lblText.getComponent(Label).string = "Loading..."
          }
          else if(this.lblText.getComponent(Label).string == "Loading..."){
            this.lblText.getComponent(Label).string = "Loading"
          }
          this._timeDur = 0;
        }
      }
}


