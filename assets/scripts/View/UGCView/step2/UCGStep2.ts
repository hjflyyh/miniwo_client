import { _decorator, Component, EditBox, instantiate, Label, Node } from 'cc';
import { RoleModel } from '../../../Model/RoleModel';
import { UGCTagTime } from './UGCTagTime';
import { UGCModel } from '../../../Model/UGCModel';
const { ccclass, property } = _decorator;

@ccclass('UCGStep2')
export class UCGStep2 extends Component {
    @property(Node)
    public tagCell: Node = null;

    @property(Node)
    public tagAryNode: Node = null;


    @property(Node)
    public tagMaskNode: Node = null;

    private tagNodes = []

    @property(Label)
    private tagName: Label = null;

    @property(EditBox)
    private worldView: EditBox = null;

    @property(EditBox)
    private worldRule: EditBox = null;

    start() {
        this.tagAryNode.active = false
        this.tagMaskNode.active = false
        this.initTags();

        EventSystem.addListent("OnChangeMapEra" , this.onChangeMapEra , this)
    }

    onChangeMapEra(){
        this.worldView.string = UGCModel.getInstance().mapData.map_worldview || ""
        this.worldRule.string = UGCModel.getInstance().mapData.map_restriction || ""
        this.tagAryNode.active = false
        this.tagMaskNode.active = false        
        for(let i = 0 ; i < RoleModel.getInstance().tags.length ; i++){
            if(RoleModel.getInstance().tags[i].id == UGCModel.getInstance().mapData.map_era){
                this.tagName.string = RoleModel.getInstance().tags[i].tag_name
                return
            }
        }
        this.tagName.string = "请选择时代标签"
    }

    initTags(){
        console.log(RoleModel.getInstance().tags)
        for(let i = 0 ; i < RoleModel.getInstance().tags.length ; i++){
            if(RoleModel.getInstance().tags[i].tag_type == 4){
                let tagNode = instantiate(this.tagCell)
                tagNode.parent = this.tagCell.parent
                tagNode.active = true

                let tagCell : UGCTagTime = tagNode.getComponent(UGCTagTime)
                tagCell.initCell(RoleModel.getInstance().tags[i])

                this.tagNodes.push(tagNode)
            }
        }

        this.tagCell.active = false;  
        this.onChangeMapEra()      
    }    

    onClickOpenTagAry(){
        if(this.tagAryNode.active){
            this.tagAryNode.active = false
            this.tagMaskNode.active = false
        }else{
            this.tagAryNode.active = true
            this.tagMaskNode.active = true
        }
    }

    onClickNext(){
        if(this.worldView.string == "" || this.worldRule.string == ""){
            EventSystem.send("ShowTips" , "请输入世界观和规则")
            return
        }
        if(UGCModel.getInstance().mapData.map_era <= 0){
            EventSystem.send("ShowTips" , "请选择时代标签")
            return
        }
        if(UGCModel.getInstance().mapData.map_worldview != "" && UGCModel.getInstance().mapData.map_restriction != ""){
            EventSystem.send("OnSaveMapWorldviewSuccess")
            return
        }
        UGCModel.getInstance().saveMapWorldview(UGCModel.getInstance().mapData.id , 
            this.worldView.string , this.worldRule.string , UGCModel.getInstance().mapData.map_era
        )
    }

    onClickWorldViewAI(){
        if(this.worldRule.string == ""){
            EventSystem.send("ShowTips" , "请输入世界规则")
            return
        }
        if(UGCModel.getInstance().mapData.map_era <= 0){
            EventSystem.send("ShowTips" , "请选择时代标签")
            return
        }        
        let worldAttribute = ""
        for(let i = 0 ; i < RoleModel.getInstance().tags.length ; i++){
            if(RoleModel.getInstance().tags[i].id == UGCModel.getInstance().mapData.map_title){
                worldAttribute = RoleModel.getInstance().tags[i].tag_name
            }
        }        
        UGCModel.getInstance().generateWorldviewByAI(
            UGCModel.getInstance().mapData.id , UGCModel.getInstance().mapData.map_name ,
            worldAttribute , this.tagName.string , this.worldRule.string
        )
    }
}

