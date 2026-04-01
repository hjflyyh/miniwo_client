import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 挂在「区域 NPC 格子」自定义预制体根节点上（可选）。
 * 地图放置时会调用 setNpcId 写入当前格子的 npc id。
 */
@ccclass('RegionNpcCellBinder')
export class RegionNpcCellBinder extends Component {
    @property({ type: Label, tooltip: '可选：用于显示 npc id 的 Label' })
    public idLabel: Label = null;

    public setNpcId(id: string) {
        if (this.idLabel?.isValid) {
            this.idLabel.string = id;
        }
    }
}
