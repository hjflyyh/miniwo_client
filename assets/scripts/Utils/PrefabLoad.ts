import { _decorator, Component, Node , assetManager , resources , instantiate , SpriteFrame , Sprite, log, CCBoolean, CCInteger, UITransform, Size} from 'cc';
import { AppConst } from '../AppConst';
import { Utils } from './Utils';
const { ccclass, property } = _decorator;

@ccclass('PrefabLoad')
export class PrefabLoad extends Component {
    public loadHandle = null
    public target = null

    @property
    bundleName: string = "";

    @property
    isTexture: Boolean = false;

    private _url : string;

    private runSuccess = false
    public resRef = null

    public _res = null
    private _resFrame = null
    public content = null

    @property
    isGray: Boolean = false;

    @property(CCBoolean)
    isSetSize : boolean = false

    @property(CCInteger)
    sizeW : number = 32

    @property(CCInteger)
    sizeH : number = 32

    get url(): string {
        return this._url;
    }
    
    set url(value: string) {
        if(this._url != value){
            this._url = value
            this.onChangeUrl()
        }else{
            null != this.loadHandle && this.loadHandle.apply(this.target , this)
        }
    }

    onLoad(): void {
    }

    start() {
        
    }

    protected onDestroy(): void {
        this.loadHandle = null;
        this.target = null;
        this.reset()
    }

    private onChangeUrl(){
        var _this = this , newUrl = this._url
        if(null != newUrl && 0 != newUrl.length){
            if(this.bundleName != null && this.bundleName != ""){
                // console.log(newUrl)
                let bundle = assetManager.getBundle(this.bundleName)
                if(this.isTexture){
                    bundle.load(newUrl, SpriteFrame, (err, spriteFrame) => {
                            if(spriteFrame == null){
                                console.log(newUrl)
                            }
                            _this.onAddObject(err , spriteFrame , newUrl);
                        }
                    )
                }else{
                    bundle.load(this._url , (error , prefab)=>{
                        _this.onAddObject(error , prefab , newUrl);
                    })
                }

            }else{
                if(this.isTexture){
                    resources.load(newUrl , SpriteFrame , (o , spriteFrame) => {
                        _this.onAddObject(o , spriteFrame , newUrl);
                    })
                }else{
                    resources.load(newUrl , function(o , object){
                        _this.onAddObject(o , object , newUrl);
                    })
                }
            }
        }else{
            this.reset()
        }

    }

    private reset(){
        this._url = null
        if(null != this.content){
            this.content.removeFromParent(!0)
            this.content.destroy()
            this.content = null
        }
        this.clearRes()
    }

    private clearRes(){
        // if(this._resFrame != null){
        //     this._resFrame = null
        // }
        if(this.resRef != null){
            this.resRef.decRef()
            this.resRef = null
        }
    }

    private onAddObject(o , object , newUrl){
        var _this = this;
        _this.runSuccess = true

        this.reset()
        if(null != object){
            _this.resRef = object
            object.addRef()
            
            // if(!this.isTexture){
            //     _this.node && _this.node.children.length > 0 && _this.reset();
            // }
            if(this.isTexture){
                this._resFrame = object
                this.node && (this.node.getComponent(Sprite).spriteFrame = object)

                if(this.isSetSize){
                    let tr = this.node.getComponent(UITransform)
                    tr.contentSize = new Size(this.sizeW , this.sizeH)
                }
            }else{
                var n = instantiate(object)
                _this.content = n;
                _this.node && _this.node.addChild(n)
            }
            _this._res = _this._url = newUrl

            null != this.loadHandle && this.loadHandle.apply(this.target , this)
        }
    }

    public setGray(isGray){
        this.isGray = isGray
        Utils.changeSpritesShader(this.node ,this.isGray);
    }
}


