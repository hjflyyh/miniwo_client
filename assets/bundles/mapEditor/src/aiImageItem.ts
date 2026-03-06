import { _decorator, Component, EditBox, instantiate, Label, Node, Prefab, Sprite, SpriteFrame, UITransform } from 'cc';
import { EventType } from 'db://assets/src/EventType';
// import { socket } from 'db://assets/src/game/App';
// import { GlobalConfig } from 'db://assets/src/game/config/GlobalConfig';
// import { network } from 'db://assets/src/model/RequestData';
import EventBus from 'db://assets/src/utils/EventBus';
// import WebUtils from 'db://assets/src/utils/WebUtils';
const { ccclass, property } = _decorator;

@ccclass('aiImageItem')
export class aiImageItem extends Component {
    @property(UITransform)
    transform: UITransform = null;

    protected onLoad(): void {
        this.node.on('initData', this.initData, this);
    }

    protected onDestroy(): void {

    }

    start() {

    }

    update(deltaTime: number) {

    }

    initData(imageUrl: string) {
        // WebUtils.getRemoteImg(imageUrl, this.transform.node, (err, spriteFrame: SpriteFrame) => {
        //     if (!err) {
        //         let scale = this.transform.width / spriteFrame.width;
        //         this.transform.height = spriteFrame.height * scale;
        //     }
        // });
    }
}


