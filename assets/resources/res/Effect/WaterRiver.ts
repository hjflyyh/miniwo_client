import { _decorator, Component, Material, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('WaterRiver')
export class WaterRiver extends Component {
    private tickTime: number = 0;

    private mr1: Material;
    
    start() {
        this.mr1 = this.getComponent(Sprite).customMaterial;
        this.mr1.setProperty("u_type", 1);
    }

    update(deltaTime: number) {
        this.tickTime += 0.01;
        this.mr1.setProperty("u_time", this.tickTime);
        
        if (this.tickTime > 100) {
            this.tickTime -= 100;
        }
    }
}

