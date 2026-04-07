import { _decorator, CCInteger, Component, EditBox, Label, Node } from 'cc';
import { AppConst } from '../../AppConst';
import { UGCModel } from '../../Model/UGCModel';
import { MapModel } from '../../Model/MapModel';
const { ccclass, property } = _decorator;

@ccclass('CreateView')
export class CreateView extends Component {
    @property({ type: [Node] })
    public tagChoose: Node[] = [];

    public languageStep = [131, 134, 145];

    public languageStepInfo = [132 , -1 , 150];

    private showTagIndex = 0;

    @property(Node)
    public createNameNode: Node = null;

    @property(Node)
    public createNpcNode: Node = null;

    @property(Node)
    public step1: Node = null;

    @property(Node)
    public step2: Node = null;

    @property(Node)
    public step3: Node = null;

    @property(EditBox)
    public mapNameEditBox: EditBox = null;

    @property(EditBox)
    public npcNameEditBox: EditBox = null;

    @property(EditBox)
    public npcAgeEditBox: EditBox = null;

    @property(Label)
    public stepInfoLabel: Label = null;

    @property(Label)
    public stepTitleLabel: Label = null;

    start() {
        this.createNameNode.active = false;
        this.createNpcNode.active = false;

        this.checkTag();

        AppConst.PanelManager.CloseViewByUrl("res/View/CreateMap/MyWorldView")


        EventSystem.addListent("OnCreateMapSuccess" , this.OnCreateMapSuccess , this)
        EventSystem.addListent("OnSaveMapWorldviewSuccess" , this.OnSaveMapWorldviewSuccess , this)
        this.setTagChoose();


        if(UGCModel.getInstance().mapData.id > 0){
            UGCModel.getInstance().getNpcByMap(UGCModel.getInstance().mapData.id);
        }
    }

    checkTag(){
        if(UGCModel.getInstance().mapData.id == 0){
            this.showTagIndex = 0;
        }else if(UGCModel.getInstance().mapData.map_worldview == ""){
            this.showTagIndex = 1;
        }else {
            this.showTagIndex = 2;
        }
    }

    setTagChoose(){
        for(let i = 0 ; i < this.tagChoose.length ; i++){
            if(i == this.showTagIndex){
                this.tagChoose[i].active = true
            }else{
                this.tagChoose[i].active = false
            }
        }
        this.step1.active = this.showTagIndex == 0;
        this.step2.active = this.showTagIndex == 1;
        this.step3.active = this.showTagIndex == 2;

        this.stepInfoLabel.string = AppConst.LanguageManager.getTextByConfig(this.languageStepInfo[this.showTagIndex])
        this.stepTitleLabel.string = AppConst.LanguageManager.getTextByConfig(this.languageStep[this.showTagIndex])
    }

    onClickNext(a , tab){
        console.log("click next", tab)
        if(tab == 1){
            if(UGCModel.getInstance().mapData.map_title == 0){
                EventSystem.send("ShowTips" , "请选择地图标题")
                return
            }
            if(UGCModel.getInstance().mapData.id == 0){
                this.createNameNode.active = true;
            }else{
                this.showTagIndex = 1
                this.setTagChoose();
            }
        }
        if(tab == 2){
            if(UGCModel.getInstance().mapData.map_npc.length == 0){
                EventSystem.send("ShowTips" , "请至少选择一个NPC")
                return
            }
            MapModel.getInstance().EnterMap(1)
        }
    }

    onOpenNpcCreate(){
        this.createNpcNode.active = true;
    }

    onClickBack(){
        this.showTagIndex--;
        this.setTagChoose();
    }

    onClickCreateMap(){
        if(this.mapNameEditBox.string == ""){
            EventSystem.send("ShowTips" , "请输入地图名称")
            return
        }
        UGCModel.getInstance().createMapWithTitle(UGCModel.getInstance().mapData.map_title , this.mapNameEditBox.string);
    }

    onClickCreateNpc(){
        const name = this.npcNameEditBox.string ? this.npcNameEditBox.string.trim() : "";
        if(name == ""){
            EventSystem.send("ShowTips" , "请输入NPC名称")
            return
        }
        const age = this.npcAgeEditBox.string ? this.npcAgeEditBox.string.trim() : "";
        if(age == "" || isNaN(Number(age))){
            EventSystem.send("ShowTips" , "请输入NPC年龄，必须为数字")
            return
        }
        if(UGCModel.getInstance().npcList.length >= 10){
            EventSystem.send("ShowTips" , "NPC数量不能超过10个")
            return
        }
        // 检查是否存在同名 NPC（按名称精确匹配）
        const ugc = UGCModel.getInstance();
        const hasSame = (ugc.npcList || []).some((npc: any) => {
            const npcName = String(npc?.name || "").trim();
            return npcName === name;
        });
        if (hasSame) {
            EventSystem.send("ShowTips" , "已存在同名NPC，请换一个名字");
            return;
        }

        ugc.creatorNpc(ugc.mapData.id , name , Number(age));
        this.createNpcNode.active = false;
    }

    OnCreateMapSuccess(){
        EventSystem.send("ShowTips" , "地图创建成功")
        this.createNameNode.active = false;
        this.showTagIndex = 1
        this.setTagChoose();
    }

    OnSaveMapWorldviewSuccess(){
        this.showTagIndex = 2
        this.setTagChoose();
    }

}

