import { _decorator, Component, Node ,sp, UITransform, Vec3} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('SpineTest')
export class SpineTest extends Component {
    @property(sp.Skeleton)
    spine : sp.Skeleton

    @property(Node)
    touNode : Node

    @property(Node)
    shentiuNode : Node

    @property(Node)
    zuoshouNode : Node

    @property(Node)
    youhouNode : Node

    @property(Node)
    youjiaoNode : Node

    @property(Node)
    zuojiaoNode : Node

    offsetDeg = 90

    touSlot
    shentiSlot
    zuoshouSlot
    youshouSlot
    youjiaoSlot
    zuojiaoSlot

    isRun = true
    start() {
        this.touSlot = this.spine.findSlot("touguadian")
        if(this.touSlot != null){
            console.log(this.touSlot)
        }else{
            console.log("找不到头")
        }

        this.shentiSlot = this.spine.findSlot("shentiguadian")
        if(this.shentiSlot != null){
            console.log(this.shentiSlot)
        }else{
            console.log("找不到身体")
        }

        this.zuoshouSlot = this.spine.findSlot("zuoshoubiguadian")
        if(this.zuoshouSlot != null){
            console.log(this.zuoshouSlot)
        }else{
            console.log("找不到左手")
        }

        this.youshouSlot = this.spine.findSlot("youshoubiguadian")
        if(this.youshouSlot != null){
            console.log(this.youshouSlot)
        }else{
            console.log("找不到右手")
        }

        this.youjiaoSlot = this.spine.findSlot("youjiaoguadian")
        if(this.youjiaoSlot != null){
            console.log(this.youjiaoSlot)
        }else{
            console.log("找不到右脚")
        }

        this.zuojiaoSlot = this.spine.findSlot("zuojiaoguadian")
        if(this.zuojiaoSlot != null){
            console.log(this.zuojiaoSlot)
        }else{
            console.log("找不到左脚")
        }
    }

    update() {
        if(!this.isRun) return;
        this.updateTou()
        this.updateShenti()
        this.updateZuoshou()
        this.updateYouhou()
        this.updateYoujiao()
        this.updateZuojiao()

    }

    updateZuojiao() {
        if (!this.zuojiaoSlot || !this.zuojiaoNode || !this.zuojiaoNode.parent) return;
        const bone = this.zuojiaoSlot.bone;
        if (!bone) return;
        
        // 同一父节点坐标系下，直接赋值
        this.zuojiaoNode.setPosition(bone.worldX, bone.worldY, 0);
        // 1) bone 在 skeleton 本地空间里的朝向（x 轴方向）
        const boneDeg = Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        
        // 4) 赋值（如果方向反了就再取负）
        const rotDeg = typeof bone.getWorldRotationX === 'function'
            ? bone.getWorldRotationX()
            : Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        this.zuojiaoNode.angle = rotDeg + 90; // 反了就改成 -finalDeg
    }

    updateYoujiao() {
        if (!this.youjiaoSlot || !this.youjiaoNode || !this.youjiaoNode.parent) return;
        const bone = this.youjiaoSlot.bone;
        if (!bone) return;
        
        // 同一父节点坐标系下，直接赋值
        this.youjiaoNode.setPosition(bone.worldX, bone.worldY, 0);
        // 1) bone 在 skeleton 本地空间里的朝向（x 轴方向）
        const boneDeg = Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        
        // 4) 赋值（如果方向反了就再取负）
        const rotDeg = typeof bone.getWorldRotationX === 'function'
            ? bone.getWorldRotationX()
            : Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        this.youjiaoNode.angle = rotDeg + 90; // 反了就改成 -finalDeg
    }

    updateYouhou(){
        if (!this.youshouSlot || !this.youhouNode || !this.youhouNode.parent) return;
        const bone = this.youshouSlot.bone;
        if (!bone) return;  

        // 同一父节点坐标系下，直接赋值
        this.youhouNode.setPosition(bone.worldX, bone.worldY, 0);
        // 1) bone 在 skeleton 本地空间里的朝向（x 轴方向）
        const boneDeg = Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        
        // 4) 赋值（如果方向反了就再取负）
        const rotDeg = typeof bone.getWorldRotationX === 'function'
            ? bone.getWorldRotationX()
            : Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        this.youhouNode.angle = rotDeg + 90 ; // 反了就改成 -finalDeg
    }

    updateZuoshou() {
        if (!this.zuoshouSlot || !this.zuoshouNode || !this.zuoshouNode.parent) return;
        const bone = this.zuoshouSlot.bone;
        if (!bone) return;
        
        // 同一父节点坐标系下，直接赋值
        this.zuoshouNode.setPosition(bone.worldX, bone.worldY, 0);
        // 1) bone 在 skeleton 本地空间里的朝向（x 轴方向）
        const boneDeg = Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        
        // 4) 赋值（如果方向反了就再取负）
        const rotDeg = typeof bone.getWorldRotationX === 'function'
            ? bone.getWorldRotationX()
            : Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        this.zuoshouNode.angle = rotDeg + 90 ; // 反了就改成 -finalDeg
    }

    updateTou(){
        if (!this.touSlot || !this.touNode || !this.touNode.parent) return;
        const bone = this.touSlot.bone;
        if (!bone) return;
        
        // 同一父节点坐标系下，直接赋值
        this.touNode.setPosition(bone.worldX, bone.worldY, 0);
        // 1) bone 在 skeleton 本地空间里的朝向（x 轴方向）
        const boneDeg = Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        
        // 4) 赋值（如果方向反了就再取负）
        const rotDeg = typeof bone.getWorldRotationX === 'function'
            ? bone.getWorldRotationX()
            : Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        this.touNode.angle = rotDeg - 90; // 反了就改成 -finalDeg
    }

    updateShenti(){
        if (!this.shentiSlot || !this.shentiuNode || !this.shentiuNode.parent) return;
        const bone = this.shentiSlot.bone;
        if (!bone) return;
        
        // 同一父节点坐标系下，直接赋值
        this.shentiuNode.setPosition(bone.worldX, bone.worldY, 0);
        // 1) bone 在 skeleton 本地空间里的朝向（x 轴方向）
        const boneDeg = Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        
        // 4) 赋值（如果方向反了就再取负）
        const rotDeg = typeof bone.getWorldRotationX === 'function'
            ? bone.getWorldRotationX()
            : Math.atan2(bone.c, bone.a) * 180 / Math.PI;
        this.shentiuNode.angle = rotDeg - 90; // 反了就改成 -finalDeg
    }
}

