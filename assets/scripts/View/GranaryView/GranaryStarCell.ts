import { _decorator, Component, Label, Node, resources, Sprite, SpriteFrame } from 'cc';
import { AppConst } from '../../AppConst';
import { getBasicCropsSprite, getBasicSeedMatureSpriteResourcePath } from '../../Model/Farm/FarmSeedVisual';
import { FarmModel } from '../../Model/Farm/FarmModel';
const { ccclass, property } = _decorator;

@ccclass('GranaryStarCell')
export class GranaryStarCell extends Component {
    @property(Label)
    public nameLabel: Label = null;

    @property(Label)
    public lvLabel: Label = null;

    @property(Sprite)
    public prefabLoader: Sprite = null;

    @property([Node])
    public stars : Node[] = []

    start() {

    }

    public refreshNode(id: number | string) {
       const configKey = String(id);
        const tableName = 'basicCrops';
        const row = AppConst.JSONManager?.getItem?.(tableName, configKey) as Record<string, unknown> | null;
        if (!row) {
            // this.clearDisplay();
            return;
        }

        const itemId = Number(row.item_id);
        if (!Number.isFinite(itemId) || itemId <= 0) {
            // this.clearDisplay();
            return;
        }

        const itemCfg = AppConst.JSONManager?.getItem?.('item', String(itemId)) as Record<string, unknown> | null;
        const displayName = String(
            row.crop_name ?? itemCfg?.name_cn ?? itemCfg?.name_en ?? itemId
        );
        

        if (this.nameLabel) {
            this.nameLabel.string = displayName;
        }
        
        let url = getBasicCropsSprite(id + "")
        let _this = this
        resources.load(url, SpriteFrame, (err, sf) => {
            _this.prefabLoader.spriteFrame = sf;
        });

        let seedLv = FarmModel.getInstance().getSeedLv(configKey)
        this.lvLabel.string = seedLv;
        for(let i = 0 ; i < this.stars.length ; i++){
            this.stars[i].active = seedLv > i + 1
        }
    }    
}

