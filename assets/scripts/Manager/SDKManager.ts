import { _decorator, CCBoolean, Component, Node } from 'cc';
import { AppConst } from '../AppConst';
const { ccclass, property } = _decorator;

@ccclass('SDKManager')
export class SDKManager extends Component {
    @property(CCBoolean)
    public isEditMapingWeb : boolean = true

    //平台：webh5 登录->谷歌 ios 邮件
    public platform = "webh5"

    protected onLoad(): void {
        AppConst.SDKManager = this    
    }

    start() {
        
    }
}


