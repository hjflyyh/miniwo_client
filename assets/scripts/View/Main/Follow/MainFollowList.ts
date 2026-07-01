import { _decorator, Component, EditBox, math, Node } from 'cc';
import { YXCollectionView } from '../../../../plugin/list-3x/yx-collection-view';
import { CustomGridFlowLayout } from '../../../../plugin/list-3x/custom-grid-flow-layout';
import { AppConst } from '../../../AppConst';
import { MainFollowListCell } from './MainFollowListCell';
import { SocialModel } from '../../../Model/SocialModel';
import { YXMasonryFlowLayout } from '../../../../plugin/list-3x/yx-masonry-flow-layout';
import { InfiniteList } from '../../../../plugin/InfiniteList/InfiniteList';
const { ccclass, property } = _decorator;

@ccclass('MainFollowList')
export class MainFollowList extends Component {
    /**
     * 列表组件
     */
    // @property(YXCollectionView)
    // listComp: YXCollectionView = null

    @property(Node)
    addBtn: Node = null

    @property(Node)
    editBtn: Node = null

    @property(Node)
    oldBtn: Node = null

    @property(EditBox)
    editBox: EditBox = null

    isOpenEdit = false
    
    start() {
        EventSystem.addListent("followEditBack", this.postBack, this)
        EventSystem.addListent("otherPostList", this.refreshData, this)
        this.editBox?.node.on('editing-did-ended', this.onEditEnd, this)
        this.httpRequest()
        this.refreshData()
    }

    refreshData() {
        this.setBtns()
    }

    postBack() {
        AppConst.SocialHttpManager.sendGetHttp("followersTimeline", {})
        this.refreshData()
    }

    setBtns() {
        this.editBtn.active = this.isOpenEdit
        this.oldBtn.active = this.isOpenEdit
    }

    onClickAddBtn() {
        // this.isOpenEdit = !this.isOpenEdit
        // this.setBtns()
        if (!SocialModel.getInstance().draftData) {
            AppConst.SocialHttpManager.sendGetHttp("draft", {})
        }

        AppConst.PanelManager.openView("res/View/Follow/FollowEditView")        
    }

    onClickEditBtn() {
        if (!SocialModel.getInstance().draftData) {
            AppConst.SocialHttpManager.sendGetHttp("draft", {})
        }

        AppConst.PanelManager.openView("res/View/Follow/FollowEditView")
    }

    onEditEnd() {
        this.onClickFollow()
    }

    onClickFollow() {
        const nick = (this.editBox?.string ?? '').trim()
        if (!nick) {
            AppConst.SocialHttpManager.sendGetHttp("followersTimeline", {})
            return
        }
        SocialModel.getInstance().userTimelineListTarget = 'other'
        AppConst.SocialHttpManager.sendGetHttp("userTimeline", { nick_name: nick })
    }

    httpRequest() {
        AppConst.SocialHttpManager.sendGetHttp("myfollows", {})
        AppConst.SocialHttpManager.sendGetHttp("followersTimeline", {})
    }

}


