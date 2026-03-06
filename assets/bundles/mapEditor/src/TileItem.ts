import { _decorator, Component, Enum, Node } from 'cc';
// import { NpcEventType } from 'db://assets/src/StaticUtils/NPCConfig';
const { ccclass, property } = _decorator;

export interface TileObjectData {
    id: string;
    x: number;
    y: number;
    type: string;
    isWalkable: boolean
}

enum TileDecorType {
    None,
    Bed,
    Computer,
    ComputerTable,
    DrawingBoard,
    Cook
}

@ccclass('TileItem')
export class TileItem extends Component {
    @property
    id: string = "";
    @property
    isWalkable: boolean = false;
    @property
    isMulFloor: boolean = false;

    @property({ type: Enum(TileDecorType) })
    selfDecorType: TileDecorType = TileDecorType.None;

    actionPoint: Node;

    dinningArrays: { dinning: Node, afterDinner: Node };

    protected onLoad(): void {
        this.actionPoint = this.node.getChildByName('actionPoint');
        this.init();
    }

    init() {
        if (this.selfDecorType == TileDecorType.ComputerTable) {
            this.dinningArrays = {
                dinning: this.node.getChildByName("food_1"),
                afterDinner: this.node.getChildByName("food_2")
            }

            this.dinningArrays.dinning.active = false;
            this.dinningArrays.afterDinner.active = false;
        }
    }

    actionExecute(npc: Node, actionId: number, status?: number) {
        if (this.actionPoint) {
            npc.setWorldPosition(this.actionPoint.worldPosition)
        }

        switch (this.selfDecorType) {
            case TileDecorType.Bed:

                break;
            case TileDecorType.Computer:

                break;
            case TileDecorType.ComputerTable:
                this.dinningArrays.dinning.active = false;
                this.dinningArrays.afterDinner.active = false;

                // if (actionId == NpcEventType.dinning) {
                //     if (status == 1) {
                //         this.dinningArrays.dinning.active = true;
                //     } else if (status == 2) {
                //         this.dinningArrays.afterDinner.active = true;
                //     }
                // }
                break;
            case TileDecorType.DrawingBoard:
                break;
            case TileDecorType.Cook:
                break;
            default:
                break;
        }
    }

    // 结束执行
    endExecute() {
        if (this.selfDecorType == TileDecorType.ComputerTable) {
            this.dinningArrays.dinning.active = false;
            this.dinningArrays.afterDinner.active = false;
        }
    }
}


