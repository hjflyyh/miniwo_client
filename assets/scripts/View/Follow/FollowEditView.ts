import { _decorator, Component, EditBox, Node, instantiate, Sprite } from 'cc';
import { AppConst } from '../../AppConst';
import { SocialModel } from '../../Model/SocialModel';
import { RoleModel } from '../../Model/RoleModel';
import { BagModel } from '../../Model/BagModel';
import { FollowEditViewCell } from './FollowEditViewCell';
import { FollowImgCell } from './FollowImgCell';
import { Utils } from '../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('FollowEditView')
export class FollowEditView extends Component {
    @property(EditBox)
    titleNode: EditBox = null

    @property(EditBox)
    contentNode: EditBox = null

    @property(Node)
    imgsAdd: Node

    @property(Node)
    imgsRender: Node

    @property(Node)
    bagAdd: Node

    @property(Node)
    bagRender: Node

    private bagRenderList: {} = {}
    private imgsRenderList: {} = {}
    private openData: any[] = []

    start() {
        EventSystem.addListent("followEditBack", this.back, this)
        EventSystem.addListent("OnRefreshFollowImgChoose", this.setChooseNodeList, this)
        EventSystem.addListent("OnSaveFollowSettingImg", this.saveFollowSettingImg, this)
        this.openData = []
        this.imgsAdd.active = true
        this.imgsRender.active = false

        this.bagAdd.active = false
        const draftData = SocialModel.getInstance().draftData
        if (draftData) {
            this.titleNode.string = draftData.title || ""
            this.contentNode.string = draftData.content || ""
        }
    }

    saveFollowSettingImg(data) {
        let index = this.openData.findIndex((item) => item.id == data.id && item.type == data.type)
        if (index != -1) {
            this.openData[index] = data
        }
    }

    setChooseNodeList(data) {
        for (let itemID in this.imgsRenderList) {
            let next = this.imgsRenderList[itemID]
            next.active = false
        }
        for(let d = 0 ; d < data.length ; d++){
            if(data[d].type == "modelImg"){
                let journalImg = AppConst.JournalManager.journalImgs.find((i) => i.type == data[d].type && i.id == data[d].id)
                data[d].model_url = journalImg.model_url
            }
        }

        this.openData = data
        this.openData.forEach((item) => {
            let next = this.imgsRenderList[item.id]
            if (!next) {
                next = instantiate(this.imgsRender)
                this.imgsAdd.addChild(next)
                this.imgsRenderList[item.id] = next


                let journalImg = AppConst.JournalManager.journalImgs.find((i) => i.type == item.type && i.id == item.id)
                if (journalImg) {
                    console.log("journalImg:", journalImg)
                    if(journalImg.type == "modelImg"){
                        Utils.loadCoverFitInsideParent(journalImg.model_url, next.getChildByName("render").getComponent(Sprite))
                    }
                //     next.getComponent(Sprite).spriteFrame = AppConst.JournalManager.imgSprite[journalImg["localImgIndex"]]
                }
            }
            next.active = true
        })
    }

    onClickFriend() {
        AppConst.PanelManager.openView("res/View/Follow/FollowFriendChoose")
    }

    onClickImg() {
        this.imgsAdd.active = true
        this.bagAdd.active = false
    }

    onClickAddImg() {
        AppConst.PanelManager.openView("res/View/Follow/FollowImgChoose", this.openData)
    }

    onClickReward() {
        if (this.imgsAdd.active) {
            this.imgsAdd.active = false
            this.bagAdd.active = true

            this.bagRender.active = false
            let allowedRewards = BagModel.getInstance().getSlotAllowedRewards()
            SocialModel.getInstance().itemsCache = {}

            for (let data of allowedRewards) {
                let itemID = data["item_id"]
                let next = this.bagRenderList[itemID]
                if (!next) {
                    next = instantiate(this.bagRender)
                    next.active = true
                    this.bagAdd.addChild(next)
                    this.bagRenderList[itemID] = next
                }
                const followEditViewCell = next.getComponent("FollowEditViewCell") as FollowEditViewCell
                followEditViewCell.itemID = itemID
                followEditViewCell.refreshEditViewCell()
            }
        } else {
            this.imgsAdd.active = true
            this.bagAdd.active = false
        }
    }

    onClickSave() {
        AppConst.SocialHttpManager.sendPostHttp("updateDraft", {
            content: this.contentNode.string,
            title: this.titleNode.string,
            imageUrl: JSON.stringify(this.openData)
        })
    }

    onClickPost() {
        let itemsCache = SocialModel.getInstance().itemsCache
        console.log("itemsCache:", itemsCache)
        let items = Object.keys(itemsCache).reduce((a, k) => a.concat(Array(itemsCache[k]).fill(+k)), []);

        AppConst.SocialHttpManager.sendPostHttp("postTimeline", {
            content: this.contentNode.string,
            title: this.titleNode.string,
            items: items,
            imageUrl: JSON.stringify(this.openData),
            token: RoleModel.getInstance().nakama_token
        })
    }

    onClickDelete() {
        this.contentNode.string = ""
        this.titleNode.string = ""
        // todo imageUrl
        AppConst.SocialHttpManager.sendPostHttp("updateDraft", {
            content: "",
            title: "",
            imageUrl: "",
        })
    }

    back() {
        AppConst.PanelManager.CloseView(this)
    }
}


