import { _decorator, Component, EditBox, Node } from 'cc';
import { AppConst } from '../AppConst';
import { RoleModel } from '../Model/RoleModel';
import { HttpManager } from '../Manager/HttpManager';
const { ccclass, property } = _decorator;

@ccclass('ChooseWorldView')
export class ChooseWorldView extends Component {
    @property([Node])
    public worldNodes : Node[] = [];

    @property(Node)
    public createName : Node

    @property(EditBox)
    public createNameEdit : EditBox


    private chooseIndex = -1;

    start() {
        this.createName.active = false
        this.refreshTab();
    }

    refreshTab(){
        for(let i = 0; i < this.worldNodes.length; i++){
            this.worldNodes[i].active = i == this.chooseIndex;
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
        this.createName.active = true
        // const req = AppConst.HttpManager.sendPostHttp("createUserMap", JSON.stringify({
        //         token: RoleModel.getInstance().token,
        //     }));
        //     Promise.resolve(req).then(
        //         () => {
        //             console.log("createUserMap success")
        //             const nakamaToken = RoleModel.getInstance().nakama_token != null ? String(RoleModel.getInstance().nakama_token) : '';
        //             const wsUrl = `ws://${HttpManager.wsIpBase}/ws?token=${encodeURIComponent(nakamaToken)}`;
        //             console.log(wsUrl)
        //             AppConst.WebSocketManager.setConfig(wsUrl);
        //             AppConst.WebSocketManager.connect();    
        //             AppConst.PanelManager.CloseViewByUrl("res/View/ChooseWorldView")           
        //         },
        //         () => {

        //         },
        //     ).then(() => {
                    
        //     });
    }

    onClickCloseName(){
        this.createName.active = false
    }

    onClickSureCreate(){
        const name = this.createNameEdit.string
        if(!name || name.length <= 0){
            EventSystem.send("ShowTips", "Please input world name")
            return
        }
        const req = AppConst.HttpManager.sendPostHttp("createUserMap", JSON.stringify({
                token: RoleModel.getInstance().token,
                mapName: name,
                mapEra : this.chooseIndex + 1,
            }));
        Promise.resolve(req).then(
                () => {
                    console.log("createUserMap success")
                    const nakamaToken = RoleModel.getInstance().nakama_token != null ? String(RoleModel.getInstance().nakama_token) : '';
                    const wsUrl = `ws://${HttpManager.wsIpBase}/ws?token=${encodeURIComponent(nakamaToken)}`;
                    AppConst.WebSocketManager.setConfig(wsUrl);
                    AppConst.WebSocketManager.connect();    
                    AppConst.PanelManager.CloseViewByUrl("res/View/ChooseWorldView")           
                },
                () => {

                },
            ).then(() => {
                    
        });
    } 
}


