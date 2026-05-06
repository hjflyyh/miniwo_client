import { _decorator, Component, EditBox, Label, Node, RichText } from 'cc';
import { AppConst } from '../../AppConst';
import { RoleModel } from '../../Model/RoleModel';
import { network } from '../../Model/RequestData';
const { ccclass, property } = _decorator;

@ccclass('UserInfo')
export class UserInfo extends Component {

   @property(Label)
   public nikeName: Label = null

   @property(Label)
   public userId: Label = null

   @property(EditBox)
   editName: EditBox = null

   @property(EditBox)
   editGender: EditBox = null

   @property(EditBox)
   editBirth: EditBox = null

   @property(EditBox)
   editAge: EditBox = null

   @property(EditBox)
   editMBTI: EditBox = null

   @property(EditBox)
   editBio: EditBox = null

   start() {
      this.nikeName.string = RoleModel.getInstance().nickName
      this.userId.string = RoleModel.getInstance().playerId
   }

   onSave() {
      if (this.editName.string && this.editName.string != RoleModel.getInstance().name) {
         let json = new network.ChangeNameRequest();
         AppConst.WebSocketManager.send(json.toJSON(this.editName.string))
      }

      let info = {
         gender: RoleModel.getInstance().gender,
         birth: RoleModel.getInstance().birth,
         age: RoleModel.getInstance().age,
         mbti: RoleModel.getInstance().mbti,
         bio: RoleModel.getInstance().bio,
      } as any
      let changeInfo: boolean = false
      if (this.editGender.string && this.editGender.string != `${RoleModel.getInstance().gender}`) {
         info.gender = Number(this.editGender.string)
         changeInfo = true
      }
      if (this.editBirth.string && this.editBirth.string != RoleModel.getInstance().birth) {
         info.birth = this.editBirth.string
         changeInfo = true
      }
      if (this.editAge.string && this.editAge.string != `${RoleModel.getInstance().age}`) {
         info.age = Number(this.editAge.string)
         changeInfo = true
      }
      if (this.editMBTI.string && this.editMBTI.string != RoleModel.getInstance().mbti) {
         info.mbti = this.editMBTI.string
         changeInfo = true
      }
      if (this.editBio.string && this.editBio.string != RoleModel.getInstance().bio) {
         info.bio = this.editBio.string
         changeInfo = true
      }
      if (changeInfo) {
         let json = new network.ChangeInfoRequest();
         AppConst.WebSocketManager.send(json.toJSON(JSON.stringify(info)))
      }

      AppConst.PanelManager.CloseView(this)
   }

   onBack() {
      AppConst.PanelManager.CloseView(this)
   }
}
