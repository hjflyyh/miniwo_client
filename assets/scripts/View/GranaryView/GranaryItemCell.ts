import { _decorator, Component, Label, resources, Sprite, SpriteFrame } from 'cc';
import { AppConst } from '../../AppConst';
import { BagModel } from '../../Model/BagModel';
import { PrefabLoad } from '../../Utils/PrefabLoad';
import { getBasicCropsSprite, getBasicSeedMatureSpriteResourcePath } from '../../Model/Farm/FarmSeedVisual';
const { ccclass, property } = _decorator;

@ccclass('GranaryItemCell')
export class GranaryItemCell extends Component {
    @property(Label)
    public nameLabel: Label = null;

    @property(Label)
    public numLabel: Label = null;

    @property(Sprite)
    public prefabLoader: Sprite = null;

    private showType
    private showId

    /** @param type 0=basicSeeds 1=basicCrops；@param id 配置表 key */
    public refreshNode(type: number, id: number | string) {
        this.showType = type
        this.showId = id
        const configKey = String(id);
        const tableName = type === 0 ? 'basicSeeds' : 'basicCrops';
        const row = AppConst.JSONManager?.getItem?.(tableName, configKey) as Record<string, unknown> | null;
        if (!row) {
            this.clearDisplay();
            return;
        }

        const itemId = Number(row.item_id);
        if (!Number.isFinite(itemId) || itemId <= 0) {
            this.clearDisplay();
            return;
        }

        const itemCfg = AppConst.JSONManager?.getItem?.('item', String(itemId)) as Record<string, unknown> | null;
        const displayName = String(
            row.crop_name ?? itemCfg?.name_cn ?? itemCfg?.name_en ?? itemId
        );
        const count = BagModel.getInstance().getItemCount(itemId);

        if (this.nameLabel) {
            this.nameLabel.string = displayName;
        }
        if (this.numLabel) {
            this.numLabel.string = `x${count}`;
        }
        
        let url = type == 0 ? `UITexture/itemIcon/${itemId}/spriteFrame` : getBasicCropsSprite(id + "")
        let _this = this
        resources.load(url, SpriteFrame, (err, sf) => {
            _this.prefabLoader.spriteFrame = sf;
        });
    }

    private clearDisplay() {
        if (this.nameLabel) {
            this.nameLabel.string = '';
        }
        if (this.numLabel) {
            this.numLabel.string = '';
        }
    }

    public onClick(){
        EventSystem.send("OnClickGranaryItemCell" , {type : this.showType , id : this.showId})
    }
}
