import { _decorator, Component, Node ,sp, UITransform, Vec3} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('SpineTest')
export class SpineTest extends Component {
    @property(sp.Skeleton)
    spine : sp.Skeleton

    @property(Node)
    chairNode : Node

    offsetDeg = 90

    chairSlot
    start() {
        this.chairSlot = this.spine.findSlot("hair")
        if(this.chairSlot != null){
            console.log(this.chairSlot)

            // const bone = this.chairSlot.bone;
        }else{
            console.log("找不到chair")
        }
    }

    update() {
        if (!this.chairSlot || !this.chairNode || !this.chairNode.parent) return;
        const bone = this.chairSlot.bone;
        if (!bone) return;
        
        // 同一父节点坐标系下，直接赋值
        this.chairNode.setPosition(bone.worldX, bone.worldY, 0);
        // 1) bone 在 skeleton 本地空间里的朝向（x 轴方向）
        const boneDeg = Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        // 2) 叠加 skeleton 节点本身旋转
        // let finalDeg = this.spine.node.angle + boneDeg;
        // 3) 处理镜像（scaleX*scaleY < 0 时方向会翻转）
        // if (this.spine.node.scaleX * this.spine.node.scaleY < 0) {
        //     finalDeg = this.spine.node.angle - boneDeg;
        // }
        // 4) 赋值（如果方向反了就再取负）
        const rotDeg = typeof bone.getWorldRotationX === 'function'
            ? bone.getWorldRotationX()
            : Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        this.chairNode.angle = rotDeg - 90; // 反了就改成 -finalDeg
    }
}

