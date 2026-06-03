import { _decorator, Component, Node } from 'cc';
import { AppConst } from '../AppConst';
import { RoleModel } from '../Model/RoleModel';
const { ccclass, property } = _decorator;

@ccclass('ChooseWorldView')
export class ChooseWorldView extends Component {
    @property([Node])
    public worldNodes : Node[] = [];

    private chooseIndex = -1;

    start() {
        this.refreshTab();
    }

    refreshTab(){
        for(let i = 0; i < this.worldNodes.length; i++){
            this.worldNodes[i].active = i === this.chooseIndex;
        }
    }

    onClickTab(a , b){
        if(this.chooseIndex == parseInt(b)){
            this.chooseIndex = -1;
        }else{
            this.chooseIndex = parseInt(b);
        }
        this.refreshTab();
    }

    onClickCreate(){
        if(this.chooseIndex < 0){
            EventSystem.send("ShowTips", "First choose a world");
            return;
        }
        const req = AppConst.HttpManager.sendPostHttp("createUserMap", JSON.stringify({
                token: RoleModel.getInstance().token,
            }));
            Promise.resolve(req).then(
                () => {},
                () => {},
            ).then(() => {
                    
            });
    }
}

