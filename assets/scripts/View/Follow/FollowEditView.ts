import { _decorator, Component, EditBox, Node, instantiate } from 'cc';
import { AppConst } from '../../AppConst';
import { SocialModel } from '../../Model/SocialModel';
import { RoleModel } from '../../Model/RoleModel';
import { BagModel } from '../../Model/BagModel';
import { FollowEditViewCell } from './FollowEditViewCell';
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
    bagAdd: Node

    @property(Node)
    bagRender: Node

    private bagRenderList: {} = {}

    start() {
        EventSystem.addListent("followEditBack", this.back, this)
        this.imgsAdd.active = true
        this.bagAdd.active = false
        const draftData = SocialModel.getInstance().draftData
        if (draftData) {
            this.titleNode.string = draftData.title || ""
            this.contentNode.string = draftData.content || ""
        }
    }

    onClickFriend() {
        AppConst.PanelManager.openView("res/View/Follow/FollowFriendChoose")
    }

    onClickImg() {
        AppConst.PanelManager.openView("res/View/Follow/FollowImgChoose")
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
            // imageUrl:  todo 图片url
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


