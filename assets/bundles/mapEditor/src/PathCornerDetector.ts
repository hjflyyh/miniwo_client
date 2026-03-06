import { _decorator, Component, Node, Graphics, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('PathCornerDetector')
export class PathCornerDetector extends Component {
    @property(Graphics)
    private graphics: Graphics = null;

    private pathPoints: Vec2[] = [];
    private cornerPoints: Vec2[] = [];

    start() {
        // 示例路径
        this.pathPoints = [
            new Vec2(0, 0),
            new Vec2(100, 0),
            new Vec2(100, 100),
            new Vec2(200, 100),
            new Vec2(200, 200),
            new Vec2(100, 200),
            new Vec2(100, 300),
            new Vec2(0, 300)
        ];

        // 查找拐点
        // const cornerIndices = this.findPathCorners(this.pathPoints);
        // this.cornerPoints = cornerIndices.map(index => this.pathPoints[index]);

        // 绘制路径和拐点
        this.drawPath();
        // this.drawCorners();
    }

    private drawPath() {
        this.graphics.clear();
        this.graphics.lineWidth = 10;
        this.graphics.strokeColor.fromHEX('#3366FF');

        // 绘制路径
        this.graphics.moveTo(this.pathPoints[0].x, this.pathPoints[0].y);
        for (let i = 1; i < this.pathPoints.length; i++) {
            this.graphics.lineTo(this.pathPoints[i].x, this.pathPoints[i].y);
        }
        this.graphics.stroke();
    }

    private drawCorners() {
        this.graphics.fillColor.fromHEX('#FF3333');

        // 绘制拐点标记
        this.cornerPoints.forEach(point => {
            this.graphics.circle(point.x, point.y, 5);
            this.graphics.fill();
        });
    }

    findPathCorners(path: Vec2[], tolerance: number = 0.001): number[] {
        // 路径点少于3个时，不存在拐点
        if (path.length < 3) {
            return [];
        }

        const corners: number[] = [];
        let prevDirection: Vec2 = null;

        for (let i = 1; i < path.length - 1; i++) {
            // 计算当前点到下一点的方向向量
            const currentDirection = path[i + 1].subtract(path[i]).normalize();

            if (prevDirection) {
                // 计算向量点积（范围从-1到1）
                const dotProduct = prevDirection.dot(currentDirection);

                // 如果点积不等于1（容差范围内），说明方向发生了变化
                if (Math.abs(dotProduct - 1) > tolerance) {
                    corners.push(i);
                }
            }

            prevDirection = currentDirection;
        }

        return corners;
    }
}