import { _decorator, Component, Node ,log , CCInteger} from 'cc';
import { SelectionItem } from './SelectionItem';
const { ccclass, property } = _decorator;

@ccclass('SelectionComponent')
export class SelectionComponent extends Component {
    @property([SelectionItem])
    public items:SelectionItem[] = []

    @property(CCInteger)
    public changeIndex : number = 0

    public changeCallBack = null
    public changeCallBackTarget = null

    //冻结的队列
    @property([CCInteger])
    public iceIndexs : number[] = []

    start() {
        this.onChangeIndex();
    }

    public GetChooseNode(){
        return this.items[this.changeIndex]
    }
    
    onClickItem(a, b){
        let target = a.target
        if(target.getComponent("SelectionItem")!= null){
            let selectionItem = target.getComponent("SelectionItem")
            if(selectionItem.changeIndex >= 0){
                for(let i = 0 ; i < this.iceIndexs.length ; i++){
                    if(this.iceIndexs[i] == selectionItem.changeIndex){
                        if(this.changeCallBack != null && this.changeCallBackTarget != null){
                            null != this.changeCallBack && this.changeCallBack.apply(this.changeCallBackTarget , this)
                        }
                        return
                    }
                }
                let isCallBack = false
                if(this.changeIndex != selectionItem.changeIndex){
                    //点击回调
                    isCallBack = true
                }
                this.changeIndex = selectionItem.changeIndex

                    if(this.changeCallBack != null && this.changeCallBackTarget != null){
                        null != this.changeCallBack && this.changeCallBack.apply(this.changeCallBackTarget , this)
                    }
                this.onChangeIndex();
            }else{
                log("子组件index错误")
            }
        }else{
            log("SelectionItem不存在")
        }
    }

    onChangeIndex(){
        for(let i = 0 ; i < this.items.length ; i++){
            this.items[i].setIndex(this.changeIndex)
        }
    }
}


