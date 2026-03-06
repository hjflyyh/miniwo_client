import { _decorator, Component, EventTouch, instantiate, Label, math, Node, Prefab, tween, UITransform, Vec3, Widget } from 'cc';
import { EventType } from 'db://assets/src/EventType';
// import { GlobalConfig } from 'db://assets/src/game/config/GlobalConfig';
// import TwitterViewMgr from 'db://assets/src/game/gameUI/TwitterViewMgr';
import EventBus from 'db://assets/src/utils/EventBus';
// import WebUtils from 'db://assets/src/utils/WebUtils';
const { ccclass, property } = _decorator;

@ccclass('EditorBannerNode')
export class EditorBannerNode extends Component {

    @property(Node)
    epListLayout: Node = null;

    @property(Node)
    epListNode: Node = null;

    @property(Node)
    imgBannerBg: Node = null;

    private startY: number = 0;
    private isDragging: boolean = false;
    private startTouchY: number = 0;
    private bannerHeight: number = 0;
    private parentHeight: number = 0;
    private foldedPosY: number = 0;
    private expandedPosY: number = 0;

    private isFolded: boolean = true;
    private isClick: boolean = false;

    private aiImageUrl: string = "https://dramai.world/npc/getPythonGenImg";

    private imageData: any[] = [];

    private getSize(node: Node = this.node): math.Size {
        return node.getComponent(UITransform).contentSize;
    }

    onLoad() {
        // if (!TwitterViewMgr.canShowBanner()) {
        //     this.node.active = false;
        //     return;
        // }
        this.node.active = false;
        return
        // 初始位置
        this.bannerHeight = this.getSize().height;
        this.parentHeight = this.getSize(this.node.parent).height;
        this.foldedPosY = this.parentHeight / 2 + 40;
        this.expandedPosY = this.parentHeight / 2 - this.bannerHeight / 2;
        // this.node.setPosition(new Vec3(0, this.foldedPosY, 0));
        this.isFolded = true;

        EventBus.I.on(EventType.GAME_SWITCH_BANNER_NODE, this.onSwitchBannerNode, this);

        // 添加触摸事件
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDestroy() {
        EventBus.I.off(EventType.GAME_SWITCH_BANNER_NODE, this.onSwitchBannerNode, this);

        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    protected start(): void {
        this.scheduleOnce(() => {
            this.node.getComponent(Widget).enabled = false;
            this.foldedPosY = this.node.parent.getComponent(UITransform).height / 2 + 40;
            this.expandedPosY = this.node.parent.getComponent(UITransform).height / 2 - this.bannerHeight / 2;

            this.updateEpListUI();
            this.onAiImagePostData().then((data) => {
                this.imageData = data;
                EventBus.I.post(EventType.INIT_AI_IMAGE, data);
            })
        })
    }

    onTouchStart(event: EventTouch) {
        this.isDragging = true;
        this.isClick = true;
        this.startTouchY = event.getUILocation().y;
        this.startY = this.node.position.y;
    }

    onTouchMove(event: EventTouch) {
        if (!this.isDragging) return;

        const deltaY = event.getUILocation().y - this.startTouchY;
        let newY = this.startY + deltaY;
        this.isClick = deltaY < 5;

        // 限制滑动范围
        newY = Math.max(Math.min(newY, this.foldedPosY), this.expandedPosY);
        this.node.setPosition(new Vec3(0, newY, 0));
    }

    onTouchEnd() {
        if (!this.isDragging) return;
        this.isDragging = false;

        if (this.isClick) {
            if (this.isFolded) {
                this.doExpand();
            } else {
                this.doFold();
                EventBus.I.post(EventType.SWITCH_GAME_AI_IAMGE, { isShow: false });
            }
            this.isClick = false;
            return;
        }

        // 根据当前位置决定是展开还是收起
        const currentY = this.node.position.y;
        if (currentY < this.foldedPosY - 10) {
            this.doExpand();
        } else {
            this.doFold();
            EventBus.I.post(EventType.SWITCH_GAME_AI_IAMGE, { isShow: false });
        }
    }

    private onSwitchBannerNode(param: any) {
        if (param.data.isFold) {
            this.doFold();
        } else {
            this.doExpand(!!param.data.showVote);
        }
    }

    private doFold() {
        this.isFolded = true;
        // 向上滑动收起
        tween(this.node)
            .to(0.3, { position: new Vec3(0, this.foldedPosY, 0) })
            .start();
    }

    private doExpand(showVote: boolean = false) {
        if (this.isFolded) {
            EventBus.I.post(EventType.SWITCH_GAME_AI_IAMGE, { isShow: true });
        }
        this.isFolded = false;
        // 向下滑动展开
        tween(this.node)
            .to(0.3, { position: new Vec3(0, this.expandedPosY, 0) })
            .start();
    }

    updateEpListUI() {
        this.epListLayout.removeAllChildren();

        // const roomData = TwitterViewMgr.getRoomData(4);
        // if (!roomData) {
            // console.error(`scene[${4}] data not found.`)
            // return;
        // }
        // WebUtils.getRemoteImg(roomData.tweetUrl, this.imgBannerBg);
    }

    // ai图片获取
    onAiImagePostData(): Promise<any> {
        return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', this.aiImageUrl, true);
            // 设置请求头，根据后端要求可能需要修改
            xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');

            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } else {
                        console.log(`HTTP error! status: ${xhr.status}`)
                    }
                }
            };

            xhr.onerror = () => {
                console.log('Network request failed')
            };

            // 发送数据，根据Content-Type序列化数据
            xhr.send();
        })
    }
}


