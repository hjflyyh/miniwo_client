import { NPCModel } from "./NPCModel";
import { MapModel } from "./MapModel";
import { CardModel } from "./CardModel";
import { BagModel } from "./BagModel";
import { ShopModel } from "./ShopModel";
import { SocialModel } from "./SocialModel";
import { UGCModel } from "./UGCModel";
import { AffinitieModel } from "./AffinitieModel";
import { FarmModel } from "./Farm/FarmModel";
import { WorkshopModel } from "./Workshop/WorkshopModel";
import { MailModel } from "./MailModel";
import { CGModel } from "./CGModel";
import { MapChatManager } from "../Manager/ChatManager";
import { PrivateChatManager } from "../Manager/PrivateChatMessage";

/** 切换账号时清空除 RoleModel 外的 Model / Manager 单例内存数据 */
export function resetAllGameModelsExceptRole() {
    NPCModel.resetInstance();
    MapModel.resetInstance();
    CardModel.resetInstance();
    BagModel.resetInstance();
    ShopModel.resetInstance();
    SocialModel.resetInstance();
    UGCModel.resetInstance();
    AffinitieModel.resetInstance();
    FarmModel.resetInstance();
    WorkshopModel.resetInstance();
    MailModel.resetInstance();
    CGModel.resetInstance();
    MapChatManager.resetInstance();
    PrivateChatManager.resetInstance();
}
