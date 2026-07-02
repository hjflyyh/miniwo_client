import { _decorator, Component, EditBox, math, Node } from 'cc';
import { YXCollectionView } from '../../../../plugin/list-3x/yx-collection-view';
import { CustomGridFlowLayout } from '../../../../plugin/list-3x/custom-grid-flow-layout';
import { AppConst } from '../../../AppConst';
import { MainFollowListCell } from './MainFollowListCell';
import { SocialModel } from '../../../Model/SocialModel';
import { YXMasonryFlowLayout } from '../../../../plugin/list-3x/yx-masonry-flow-layout';
import { InfiniteList } from '../../../../plugin/InfiniteList/InfiniteList';
const { ccclass, property } = _decorator;

@ccclass('RandomFollowList')
export class RandomFollowList extends Component {
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
    editBox : EditBox

    isOpenEdit = false
    
    start() {
        // EventSystem.addListent("followEditBack", this.postBack, this)
        this.httpRequest()
        // this.refreshData()
    }

    refreshData() {
        this.setBtns()
    }

    onEditEnd() {
        this.onClickFollow()
    }

    onClickFollow() {
        const nick = (this.editBox?.string ?? '').trim()
        if (!nick) {
            AppConst.SocialHttpManager.sendGetHttp("randomTimeline", {})
            return
        }
        SocialModel.getInstance().userTimelineListTarget = 'random'
        AppConst.SocialHttpManager.sendGetHttp("userTimeline", { nick_name: nick })
    }

    postBack() {
        // AppConst.SocialHttpManager.sendGetHttp("followersTimeline", {})
        // this.refreshData()
    }

    setBtns() {
        this.editBtn.active = this.isOpenEdit
        this.oldBtn.active = this.isOpenEdit
    }

    onClickAddBtn() {
        // this.isOpenEdit = !this.isOpenEdit
        // this.setBtns()
    }

    onClickEditBtn() {
        if (!SocialModel.getInstance().draftData) {
            AppConst.SocialHttpManager.sendGetHttp("draft", {})
        }

        AppConst.PanelManager.openView("res/View/Follow/FollowEditView")
    }

    httpRequest() {
        AppConst.SocialHttpManager.sendGetHttp("myfollows", {})
        AppConst.SocialHttpManager.sendGetHttp("randomTimeline", {})
    }

}


