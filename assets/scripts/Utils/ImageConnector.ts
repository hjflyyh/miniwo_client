import { _decorator, Component, Node, Sprite, UITransform, Vec3, debug } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ImageConnector')
export class ImageConnector extends Component {
    @property(Node)
    leftNode: Node = null!;
    
    @property(Node)
    rightNode: Node = null!;
    
    @property(Node)
    middleImage: Node = null!;
    
    // 连接点调试颜色
    @property
    leftPointColor: string = '#ff0000';
    
    @property
    rightPointColor: string = '#00ff00';
    
    onLoad() {
        
    }
    
    update() {
        this.updateConnection()
    }
    
    updateConnection() {
        if (!this.leftNode || !this.rightNode || !this.middleImage) {
            return;
        }
        
        // 获取左右节点的右边和左边边缘
        const leftEdge = this.getRightEdge(this.leftNode);
        const rightEdge = this.getLeftEdge(this.rightNode);
        
        if (!leftEdge || !rightEdge) return;
        
        // 计算中间位置和宽度
        const centerX = (leftEdge.x + rightEdge.x) / 2;
        const width = Math.abs(rightEdge.x - leftEdge.x);
        
        const uiTransform = this.middleImage.getComponent(UITransform);
        if (uiTransform) {
            // this.middleImage.setPosition(centerX, leftEdge.y, leftEdge.z);
            uiTransform.width = Math.max(width, 1);
        }
    }
    
    private getRightEdge(node: Node): Vec3 | null {
        const uiTransform = node.getComponent(UITransform);
        if (!uiTransform) return null;
        
        const pos = node.position.clone();
        pos.x += uiTransform.width / 2; // 右边缘
        return pos;
    }
    
    private getLeftEdge(node: Node): Vec3 | null {
        const uiTransform = node.getComponent(UITransform);
        if (!uiTransform) return null;
        
        const pos = node.position.clone();
        pos.x -= uiTransform.width / 2; // 左边缘
        return pos;
    }
    
    public refresh() {
        this.updateConnection();
    }
}