import { _decorator, Canvas, Component, director, instantiate, Node, Prefab, resources, Sprite, SpriteFrame } from 'cc';
// import { popItemPrefab } from '../game/gameUI/popItemPrefab';
const { ccclass, property } = _decorator;

@ccclass('scenItemNode')
export class scenItemNode extends Component {

    @property(Prefab)
    private popItemPrefab:Prefab = null;

    _itemId:number = 0;
    _uniqid:any = null;
    private _isValid: boolean = true;

    start() {

    }

    update(deltaTime: number) {
        
    }

    protected onDestroy(): void {
        this._isValid = false;
    }

    initData(itemData:any){
        if(!itemData.itemId){
            this.node.destroy();
            return;
        }
        this._itemId = itemData.itemId;
        this._uniqid = itemData.tilePos;
        resources.load("common/image/item_" + itemData.itemId + "/spriteFrame",SpriteFrame,(err,spr:SpriteFrame)=>{
            if (!this._isValid) return;
            if(err){
                console.log("item load error" + err);
            }
            else{
                this.node.getComponent(Sprite).spriteFrame = spr;
            }
        });
    }

    onBtnClick(){
        let popItemPrefabNode = instantiate(this.popItemPrefab);
        // popItemPrefabNode.getComponent(popItemPrefab).initData(this._itemId);
        // let canvas =  director.getScene().getComponentInChildren(Canvas);
        // canvas.node.addChild(popItemPrefabNode);
    }

    initByItemData(itemData:any){
        this._itemId = itemData.itemId;
        resources.load("common/image/item_" + itemData.itemId + "/spriteFrame",SpriteFrame,(err,spr:SpriteFrame)=>{
            if (!this._isValid) return;
        });
    }
}


