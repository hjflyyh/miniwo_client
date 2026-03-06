import { _decorator, Component, instantiate, math, Node, Prefab, ScrollView, tween, UITransform, Vec3 } from 'cc';
import { EventType } from 'db://assets/src/EventType';
// import { GlobalConfig } from 'db://assets/src/game/config/GlobalConfig';
// import TwitterViewMgr from 'db://assets/src/game/gameUI/TwitterViewMgr';
import EventBus from 'db://assets/src/utils/EventBus';
const { ccclass, property } = _decorator;

@ccclass('AiImageView')
export class AiImageView extends Component {
    @property(UITransform)
    transform: UITransform = null;

    @property(ScrollView)
    scrollView: ScrollView = null;

    @property(Node)
    twitterViewContent: Node = null;

    @property(Prefab)
    comicItemPref: Prefab = null;

    private parentSize: math.Size;


    protected onLoad(): void {
        EventBus.I.on(EventType.INIT_AI_IMAGE, this.onInitAiImage, this);
        EventBus.I.on(EventType.SWITCH_GAME_AI_IAMGE, this.onSwitchAiImageView, this);
        this.scrollView.node.on(ScrollView.EventType.SCROLL_ENG_WITH_THRESHOLD, this.onScrollEndedWithThreshod, this);
    }

    protected onDestroy(): void {
        EventBus.I.off(EventType.INIT_AI_IMAGE, this.onInitAiImage, this);
        EventBus.I.off(EventType.SWITCH_GAME_AI_IAMGE, this.onSwitchAiImageView, this);
    }

    start() {
        this.scheduleOnce(() => {
            this.parentSize = this.node.parent.getComponent(UITransform).contentSize;
            this.transform.setContentSize(this.transform.width, this.parentSize.height - 260);
            this.node.setPosition(0, this.parentSize.height / 2 + this.transform.height / 2);
            this.node.getChildByName("view").getComponent(UITransform).setContentSize(this.transform.width, this.parentSize.height - 260);
            this.node.getChildByName("view").setPosition(0, (this.parentSize.height - 260) / 2);
        })
    }

    update(deltaTime: number) {
        if (!this.scrollView.isScrolling()) {
            const contentPosY = this.scrollView.getContentPosition().y;

            if (contentPosY > this.scrollView.getMaxScrollOffset().y + 200) {
                this.onSwitchAiImageView({ data: { isShow: false } })
                EventBus.I.post(EventType.GAME_SWITCH_BANNER_NODE, { isFold: true });
            }
        }
    }

    onScrollEndedWithThreshod() {

    }

    onSwitchAiImageView(param: any) {
        if (param.data.isShow) {
            this.scrollView.scrollToBottom(0.1, false);
            // 向下滑动展开
            tween(this.node)
                .to(1, { position: new Vec3(0, -130, 0) })
                .call(() => {
                    if (!param.data.showVote) {
                        this.scrollView.scrollToTop(2, false);
                    }
                })
                .start();
        } else {
            tween(this.node)
                .to(1, { position: new Vec3(0, this.parentSize.height / 2 + this.transform.height / 2, 0) })
                .start();
        }

    }

    onInitAiImage(param) {
        this.updateTwitterView(param.data);
    }

    updateTwitterView(imageData) {
        this.loadItemsInFrames(imageData);
    }

    private loadItemsInFrames(dataList: any[]) {
        this.scrollView.scrollToTop(0);
        this.twitterViewContent.removeAllChildren();

        const totalLen = dataList.length;
        for (let i = 0; i < totalLen; i++) {
            let comicItem = instantiate(this.comicItemPref);
            this.twitterViewContent.addChild(comicItem);

            comicItem.emit('initData', dataList[i].ImgUrl);
        }
    }
}


