import { _decorator, Component, EditBox, Label, Node, RichText, ScrollView, tween } from 'cc';
import { AppConst } from '../../AppConst';
import { RoleModel } from '../../Model/RoleModel';
import { UGCModel } from '../../Model/UGCModel';
import { network } from '../../Model/RequestData';
import tableView from '../../tableview/tableView';
import { Utils } from '../../Utils/Utils';
const { ccclass, property } = _decorator;

@ccclass('UserInfo')
export class UserInfo extends Component {

   @property(Label)
   public nikeName: Label = null

   @property(Label)
   public userId: Label = null

   @property( tableView ) protected monthTv!:tableView;
   @property( tableView ) protected dayTv!:tableView;
   @property( tableView ) protected ageTv!:tableView;
   @property( tableView ) protected mbtiTv!:tableView;
   @property( tableView ) protected sexTv!:tableView;

   @property(Label)
   nameLabel : Label

   @property(Label)
   brithLabel : Label

   @property(Label)
   ageLabel : Label
   
   @property(Label)
   mbtiLabel : Label

   @property(Label)
   genderLabel : Label

   @property(EditBox)
   editName : EditBox   

    private __months:any[] = [];
    private __days:any[] = [];

   private __ages:any[] = [];

   private __mbti:any[] = [];

   private __sex:any[] = [];

    private monthSnapIndex = 1;
    private daySnapIndex = 1;
    private ageSnapIndex = 1;
    private mbtiIndex = 1;
    private sexIndex = 1;

    @property(Node)
    selectBirth : Node

    @property(Node)
    selectAge : Node

    @property(Node)
    selectMBTI : Node

    @property(Node)
    selectSex : Node

    @property(Node)
    changeName : Node

   start() {
      this.nikeName.string = RoleModel.getInstance().nickName
      this.userId.string =  "UserId:" + RoleModel.getInstance().playerId

      this.selectBirth.active = false
      this.selectAge.active = false
      this.selectMBTI.active = false
      this.selectSex.active = false

      this.changeName.active = false

      this.initMonth();
      this.initDays();
      this.initAge();
      this.initMbti();
      this.initSex();

      this.refreshRole();

      EventSystem.addListent("RefreshRoleData" , this.refreshRole , this)
   }

   refreshRole(){
      this.brithLabel.string = RoleModel.getInstance().birth && RoleModel.getInstance().birth != "" ? RoleModel.getInstance().birth : "--"
      this.ageLabel.string = RoleModel.getInstance().age ? RoleModel.getInstance().age + "" : "--" 
      this.nameLabel.string = RoleModel.getInstance().nickName
      this.mbtiLabel.string = this.resolveMbtiDisplay(RoleModel.getInstance().mbti);
      this.genderLabel.string = this.resolveGenderDisplay(RoleModel.getInstance().gender);
   }

   private resolveGenderDisplay(value: any): string {
      const text = String(value ?? "").trim().toLowerCase();
      if (text === "male" || text === "man" || text === "0") {
         return "Male";
      }
      if (text === "female" || text === "woman" || text === "1") {
         return "Female";
      }
      return "--";
   }

   private resolveMbtiDisplay(value: any): string {
      if (value == null || value === "") {
         return "--";
      }
      const name = String(value).trim();
      if (!name) {
         return "--";
      }
      const num = Number(name);
      if (Number.isFinite(num) && num > 0 && String(num) === name) {
         return this.resolveTagNameById(num, 5) || name;
      }
      return name;
   }

   private resolveTagNameById(id: number, tagType: number): string {
      if (!Number.isFinite(id) || id <= 0) {
         return "";
      }
      const tags = RoleModel.getInstance()?.tags || [];
      for (let i = 0; i < tags.length; i++) {
         const t = tags[i];
         if (!t) {
            continue;
         }
         if (Number(t.tag_type) === tagType && Number(t.id) === id) {
            return String(t.tag_name || "");
         }
      }
      return String(id);
   }

   initAge(){
      this.__ages.push("");
        this.__ages.push("");
      //   let selectIndex = month-1;
        for (let i=1; i<=120; i++) {
            this.__ages.push(i);
        }
        this.__ages.push("");
         this.ageTv?.init(this.__ages.length, this.__ages);
         this.ageTv?.refreshSync();
         this.ageTv.scrollToIndex(1);
   }

   initMbti() {
      this.__mbti = [];
      this.__mbti.push("");
      this.__mbti.push("");

      const mbtiList = UGCModel.getInstance().getMBTIList();
      for (let i = 0; i < mbtiList.length; i++) {
         this.__mbti.push(String(mbtiList[i].tag_name || ""));
      }
      this.__mbti.push("");

      this.mbtiTv?.init(this.__mbti.length, this.__mbti);
      this.mbtiTv?.refreshSync();
      this.mbtiTv.scrollToIndex(1);
   }

   initSex() {
      this.__sex = [];
      this.__sex.push("");
      this.__sex.push("");
      this.__sex.push("Male");
      this.__sex.push("Female");
      this.__sex.push("");

      this.sexTv?.init(this.__sex.length, this.__sex);
      this.sexTv?.refreshSync();
      this.sexTv.scrollToIndex(1);
   }

   initMonth(){
        this.__months.push("");
        this.__months.push("");
      //   let selectIndex = month-1;
        for (let i=1; i<=12; i++) {
            this.__months.push(i);
        }
        this.__months.push("");
         this.monthTv?.init(this.__months.length, this.__months);
         this.monthTv?.refreshSync();
         this.monthTv.scrollToIndex(1);
   }

    initDays() {
        this.__days = [];
      //   let day = Number(day_ ?? this.__selectDate.day);
        this.__days.push("");
        this.__days.push("");
      //   let selectIndex = day-1;
        for (let i=1; i<=31; i++) {
            this.__days.push(i);
        }
        this.__days.push("");
        this.doDelayTween(0.01, ()=>{
            this.dayTv?.init(this.__days.length, this.__days);
            this.dayTv?.refreshSync();
            this.dayTv.scrollToIndex(1);
        }, this.node);
    }   

    private clampMonthSnapIndex(rawIndex: number): number {
        const minIdx = 1;
        const maxIdx = 12;
        return Math.max(minIdx, Math.min(maxIdx, rawIndex));
    }

    private calcSnapIndex(tv: tableView): number {
        const cellLen = tv.getCellLen();
        if (cellLen <= 0) {
            return 0;
        }
        return Math.round(tv.getScrollLength() / cellLen);
    }

    private clampDaySnapIndex(rawIndex: number): number {
        const minIdx = 1;
        const maxIdx = 31;
        return Math.max(minIdx, Math.min(maxIdx, rawIndex));
    }

    private clampAgeSnapIndex(rawIndex: number): number {
        const minIdx = 1;
        const maxIdx = 120;
        return Math.max(minIdx, Math.min(maxIdx, rawIndex));
    }

    private clampMbtiSnapIndex(rawIndex: number): number {
        const minIdx = 1;
        const maxIdx = Math.max(1, this.__mbti.length - 2);
        return Math.max(minIdx, Math.min(maxIdx, rawIndex));
    }

    private clampSexSnapIndex(rawIndex: number): number {
        const minIdx = 1;
        const maxIdx = Math.max(1, this.__sex.length - 2);
        return Math.max(minIdx, Math.min(maxIdx, rawIndex));
    }

    private getMonthSnapIndex(): number {
        return this.clampMonthSnapIndex(this.calcSnapIndex(this.monthTv));
    }

    private getDaySnapIndex(): number {
        return this.clampDaySnapIndex(this.calcSnapIndex(this.dayTv));
    }

    private getAgeSnapIndex(): number {
        return this.clampAgeSnapIndex(this.calcSnapIndex(this.ageTv));
    }

    private getMbtiSnapIndex(): number {
        return this.clampMbtiSnapIndex(this.calcSnapIndex(this.mbtiTv));
    }

    private getSexSnapIndex(): number {
        return this.clampSexSnapIndex(this.calcSnapIndex(this.sexTv));
    }

    private getSelectedAge(): number {
        const idx = this.getAgeSnapIndex();
        const value = Number(this.__ages[idx]);
        if (Number.isFinite(value) && value >= 1 && value <= 120) {
            return value;
        }
        return idx;
    }

    private getSelectedMbti(): string {
        const idx = this.getMbtiSnapIndex() + 1;
        return String(this.__mbti[idx] || "").trim();
    }

    private findMbtiScrollIndex(mbtiValue: any): number {
        const name = this.resolveMbtiDisplay(mbtiValue);
        if (name && name !== "--") {
            const idx = this.__mbti.indexOf(name);
            if (idx >= 0) {
                return idx;
            }
        }
        return 1;
    }

    private getSelectedGender(): string {
        const idx = this.getSexSnapIndex() + 1;
        return String(this.__sex[idx] || "").trim();
    }

    private findSexScrollIndex(genderValue: any): number {
        const display = this.resolveGenderDisplay(genderValue);
        if (display !== "--") {
            const idx = this.__sex.indexOf(display);
            if (idx >= 0) {
                return idx;
            }
        }
        return 1;
    }

    onScrollEnd(tv:tableView) {
        let sIdx = this.calcSnapIndex(tv);
        const uuid = tv.node.uuid;
        if (uuid === this.monthTv.node.uuid) {
            sIdx = this.clampMonthSnapIndex(sIdx);
            this.monthSnapIndex = sIdx;
        } else if (uuid === this.dayTv.node.uuid) {
            sIdx = this.clampDaySnapIndex(sIdx);
            this.daySnapIndex = sIdx;
        } else if (uuid === this.ageTv.node.uuid) {
            sIdx = this.clampAgeSnapIndex(sIdx);
            this.ageSnapIndex = sIdx;
        } else if (uuid === this.mbtiTv.node.uuid) {
            sIdx = this.clampMbtiSnapIndex(sIdx);
            this.mbtiIndex = sIdx;
        } else if (uuid === this.sexTv.node.uuid) {
            sIdx = this.clampSexSnapIndex(sIdx);
            this.sexIndex = sIdx;
        }
        tv.scrollToIndex(sIdx, 0.1);
        tv.scheduleOnce(tv.stopAutoScroll, 0.1);
    }

    protected onEnable(): void {
        this.monthTv.node.on(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);
        this.dayTv.node.on(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);
        this.ageTv.node.on(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);
        this.mbtiTv.node.on(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);
        this.sexTv.node.on(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);

        const mbtiRow = this.mbtiLabel?.node?.parent;
        if (mbtiRow) {
            mbtiRow.on(Node.EventType.TOUCH_END, this.onClickMBTI, this);
        }

        const genderRow = this.genderLabel?.node?.parent;
        if (genderRow) {
            genderRow.on(Node.EventType.TOUCH_END, this.onClickSex, this);
        }
    }

    protected onDisable(): void {
        this.monthTv.node.off(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);
        this.dayTv.node.off(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);
        this.ageTv.node.off(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);
        this.mbtiTv.node.off(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);
        this.sexTv.node.off(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnd, this);

        const mbtiRow = this.mbtiLabel?.node?.parent;
        if (mbtiRow) {
            mbtiRow.off(Node.EventType.TOUCH_END, this.onClickMBTI, this);
        }

        const genderRow = this.genderLabel?.node?.parent;
        if (genderRow) {
            genderRow.off(Node.EventType.TOUCH_END, this.onClickSex, this);
        }
    }    

   onSave() {
      
   }

   onBack() {
      AppConst.PanelManager.CloseView(this)
   }

   onClickBrith(){
      this.selectBirth.active = true
   }

    private getSelectedBirthdayMonth(): number {
        const idx = this.getMonthSnapIndex();
        const value = Number(this.__months[idx]);
        if (Number.isFinite(value) && value >= 1 && value <= 12) {
            return value;
        }
        return idx;
    }

    private getSelectedBirthdayDay(): number {
        const idx = this.getDaySnapIndex();
        const value = Number(this.__days[idx]);
        if (Number.isFinite(value) && value >= 1 && value <= 31) {
            return value;
        }
        return idx;
    }

    async onCheckBrith() {
        const birthday_month = this.getSelectedBirthdayMonth();
        const birthday_day = this.getSelectedBirthdayDay();
        this.monthSnapIndex = this.getMonthSnapIndex();
        this.daySnapIndex = this.getDaySnapIndex();

        const token = RoleModel.getInstance().token;
        if (!token) {
            EventSystem.send('ShowTips', '请先登录');
            return;
        }

        console.log('[UserInfo] onCheckBrith monthIndex:', this.monthSnapIndex, 'dayIndex:', this.daySnapIndex,
            'birthday_month:', birthday_month, 'birthday_day:', birthday_day);

        try {
            const res = await AppConst.HttpManager.sendPostHttp(
                'changeUserBirthday',
                JSON.stringify({
                    token,
                    birthday_month,
                    birthday_day,
                }),
            );
            if (!res?.success) {
                return;
            }
            this.closeBrith();
            EventSystem.send('RefreshRoleData');
        } catch {
            // 错误提示由 HttpManager 统一处理
        }
    }

   closeBrith(){
      this.selectBirth.active = false
   }

   closeAge(){
      this.selectAge.active = false
   }

    private  doDelayTween( delayTime: number, func, node: Node) {
        let t = tween( node )
                    .delay( delayTime )
                    .call( ()=>{ func(); } )
                    .start();
        return t;
    }   

    onClickAge(){
      this.selectAge.active = true
    }

    async onCheckAge() {
        const age = this.getSelectedAge() + 1;
        this.ageSnapIndex = this.getAgeSnapIndex();

        const token = RoleModel.getInstance().token;
        if (!token) {
            EventSystem.send('ShowTips', '请先登录');
            return;
        }

        console.log('[UserInfo] onCheckAge ageIndex:', this.ageSnapIndex, 'age:', age);

        try {
            const res = await AppConst.HttpManager.sendPostHttp(
                'changeUserAge',
                JSON.stringify({
                    token,
                    age,
                }),
            );
            if (!res?.success) {
                return;
            }
            this.closeAge();
            EventSystem.send('RefreshRoleData');
        } catch {
            // 错误提示由 HttpManager 统一处理
        }
    }

    onClickMBTI() {
        this.selectMBTI.active = true;
        const scrollIdx = this.findMbtiScrollIndex(RoleModel.getInstance().mbti);
        this.mbtiIndex = scrollIdx;
        this.mbtiTv?.scrollToIndex(scrollIdx);
    }

    closeMBTI() {
        this.selectMBTI.active = false;
    }

    async onCheckMBTI() {
        const mbti = this.getSelectedMbti();
        this.mbtiIndex = this.getMbtiSnapIndex();

        const token = RoleModel.getInstance().token;
        if (!token) {
            EventSystem.send('ShowTips', '请先登录');
            return;
        }
        if (!mbti) {
            EventSystem.send('ShowTips', '请选择 MBTI');
            return;
        }

        console.log('[UserInfo] onCheckMBTI mbtiIndex:', this.mbtiIndex, 'mbti:', mbti);

        try {
            const res = await AppConst.HttpManager.sendPostHttp(
                'changeUserMbti',
                JSON.stringify({
                    token,
                    mbti,
                }),
            );
            if (!res?.success) {
                return;
            }
            this.closeMBTI();
            EventSystem.send('RefreshRoleData');
        } catch {
            // 错误提示由 HttpManager 统一处理
        }
    }

    onClickSex() {
        this.selectSex.active = true;
        const scrollIdx = this.findSexScrollIndex(RoleModel.getInstance().gender);
        this.sexIndex = scrollIdx;
        this.sexTv?.scrollToIndex(scrollIdx);
    }

    closeSex() {
        this.selectSex.active = false;
    }

    async onCheckSex() {
        const gender = this.getSelectedGender();
        this.sexIndex = this.getSexSnapIndex();

        const token = RoleModel.getInstance().token;
        if (!token) {
            EventSystem.send('ShowTips', '请先登录');
            return;
        }
        if (!gender) {
            EventSystem.send('ShowTips', '请选择性别');
            return;
        }

        console.log('[UserInfo] onCheckSex sexIndex:', this.sexIndex, 'gender:', gender);

        try {
            const res = await AppConst.HttpManager.sendPostHttp(
                'changeUserGender',
                JSON.stringify({
                    token,
                    gender,
                }),
            );
            if (!res?.success) {
                return;
            }
            this.closeSex();
            EventSystem.send('RefreshRoleData');
        } catch {
            // 错误提示由 HttpManager 统一处理
        }
    }

    onClickName(){
         this.changeName.active = true
    }

    onCloseName(){
      this.changeName.active = false
    }

    async onChangeName(){
      if(this.editName.string == ""){
         EventSystem.send("ShowTips" , "Please enter your name.")
         return
      }
      const token = RoleModel.getInstance().token;
      let name = this.editName.string
      this.changeName.active = false
         try {
            const res = await AppConst.HttpManager.sendPostHttp(
                'changeNickName',
                JSON.stringify({
                    "token" : token,
                    "nick_name" : name,
                }),
            );
            if (!res?.success) {
                return;
            }
            EventSystem.send('RefreshRoleData');
        } catch {
            // 错误提示由 HttpManager 统一处理
        }
    }
}
