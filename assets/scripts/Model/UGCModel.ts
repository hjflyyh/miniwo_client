import { AppConst } from "../AppConst";
import { RoleModel } from "./RoleModel";

/**
 * 对应 miniwoedit `getMap` 返回的 `data.map`（见 mobile_creation_api.md）。
 * 字段名与后端一致（snake_case）。
 */
export interface UGCMapSnapshot {
    id: number;
    player_id: number;
    map_title: number;
    map_name: string;
    map_era: number;
    map_worldview: string;
    map_restriction: string;
    map_story_title: string;
    map_story_info: string;
    map_state: number;
    map_like_count: number;
    map_cover_url: string;
    /** Cocos 导出的地图 JSON 字符串 */
    map_data: string;
    /** JSON 字符串，如 "[1,2,3]"，不是数组 */
    map_npc: string;
    created_at?: string;
    updated_at?: string;
    /** 存在则返回（聚合数据） */
    map_story?: unknown;
    daily_story?: unknown;
    map_card_master?: unknown;
}

function defaultMapSnapshot(): UGCMapSnapshot {
    return {
        id: 0,
        player_id: 0,
        map_title: 0,
        map_name: "",
        map_era: 0,
        map_worldview: "",
        map_restriction: "",
        map_story_title: "",
        map_story_info: "",
        map_state: 0,
        map_like_count: 0,
        map_cover_url: "",
        map_data: "",
        map_npc: "",
    };
}

export class UGCModel {
    private static _inst: UGCModel | null = null;
    public static getInstance(): UGCModel {
        if (!this._inst) this._inst = new UGCModel();
        return this._inst;
    }

    /** 当前编辑地图快照（由 getMap / save* 等 HttpMessage 回填） */
    public mapData: UGCMapSnapshot = defaultMapSnapshot();

    /** 当前地图的 NPC 列表：来自 getNpcByMap 的 npc_list 原始数据 */
    public npcList: any[] = [];
    /** 登录回包里的热门 NPC 列表：data.daily_hot_npc_list */
    public dailyHotNpcList: any[] = [];

    public init() {
        EventSystem.addListent("HttpMessage", this.OnHttpMessage, this);
    }



    public addNpcRenshe(npcId , rensheId){
        let renshe = this.getNpcRenshe(npcId);
        if(renshe.length >= 3){ 
            EventSystem.send("ShowTips" , "最多3个人设");
            return false;
        }
        renshe.push(rensheId);
        this.setNpcRenshe(npcId , renshe)
        return true;
    }

    public removeNpcRenshe(npcId , rensheId){
        let renshe = this.getNpcRenshe(npcId);
        for(let i = 0 ; i < renshe.length ; i++){   
            if(renshe[i] == rensheId){  
                renshe.splice(i , 1);
            }
        }
        this.setNpcRenshe(npcId , renshe)
    }

    public setNpcRenshe(npcId , renshe){    
        for(let i = 0 ; i < this.npcList.length ; i++){
            if(this.npcList[i].id == npcId){
                this.npcList[i].characteristics = renshe
            }
        }
    }

    public getNpcRenshe(npcId){
        for(let i = 0 ; i < this.npcList.length ; i++){
            if(this.npcList[i].id == npcId){
                if(this.npcList[i].characteristics == ""){
                    return [];
                }
                if(Array.isArray(this.npcList[i].characteristics)){
                    return this.npcList[i].characteristics;
                }else{
                    return JSON.parse(this.npcList[i].characteristics);
                }
            }
        }
        return []
    }

    public setNpcSex(npcId , sex){
        for(let i = 0 ; i < this.npcList.length ; i++){
            if(this.npcList[i].id == npcId){
                this.npcList[i].sex = sex;
            }
        }
    }

    public setNpcBackground(npcId , background){    
        for(let i = 0 ; i < this.npcList.length ; i++){
            if(this.npcList[i].id == npcId){
                this.npcList[i].identity = background;
            }
        }        
    }

    public setNpcHobbies(npcId , hobbies){
        for(let i = 0 ; i < this.npcList.length ; i++){
            if(this.npcList[i].id == npcId){
                this.npcList[i].hobbies = hobbies;
            }
        }        
    }

    public removeNpcHobbies(npcId , hobbiesId){
        let hobbies = this.getNpcHobbies(npcId);
        for(let i = 0 ; i < hobbies.length ; i++){   
            if(hobbies[i] == hobbiesId){  
                hobbies.splice(i , 1);
            }
        }
        this.setNpcHobbies(npcId , hobbies)
    }

    public getNpcBackground(npcId){ 
        for(let i = 0 ; i < this.npcList.length ; i++){
            if(this.npcList[i].id == npcId){
                return this.npcList[i].identity;
            }
        }
        return "";
    }

    public addNpcHobbies(npcId , hobbiesId){    
        let hobbies = this.getNpcHobbies(npcId);
        hobbies.push(hobbiesId);
        this.setNpcHobbies(npcId , hobbies)
        return true;

    }

    public getNpcHobbies(npcId){ 
        for(let i = 0 ; i < this.npcList.length ; i++){
            if(this.npcList[i].id == npcId){
                if(this.npcList[i].hobbies == ""){
                    return [];
                }
                if(Array.isArray(this.npcList[i].hobbies)){
                    return this.npcList[i].hobbies;
                }else{
                    return JSON.parse(this.npcList[i].hobbies);
                }
            }
        }
        return []
    }

    public getNpcSex(npcId){
        for(let i = 0 ; i < this.npcList.length ; i++){
            if(this.npcList[i].id == npcId){
                return this.npcList[i].sex;
            }
        }
        return 0;
    }

    public getMBTIList(){
        let list = []
        for(let i = 0 ; i < RoleModel.getInstance().tags.length ; i++){
            if(RoleModel.getInstance().tags[i].tag_type == 5){
                list.push(RoleModel.getInstance().tags[i])
            }
        }        
        return list;
    }

    public getRensheList(){
        let list = []
        for(let i = 0 ; i < RoleModel.getInstance().tags.length ; i++){
            if(RoleModel.getInstance().tags[i].tag_type == 2){
                list.push(RoleModel.getInstance().tags[i])
            }
        }        
        return list;
    }

    public getBackgroundList(){
        let list = []
        for(let i = 0 ; i < RoleModel.getInstance().tags.length ; i++){
            if(RoleModel.getInstance().tags[i].tag_type == 7){
                list.push(RoleModel.getInstance().tags[i])
            }
        }        
        return list;
    }

    public setNpcMBTI(npcId , mbti){
        for(let i = 0 ; i < this.npcList.length ; i++){
            if(this.npcList[i].id == npcId){
                this.npcList[i].mbti = mbti;
            }
        }
    }

    public getNpcMBTI(npcId){
        for(let i = 0 ; i < this.npcList.length ; i++){
            if(this.npcList[i].id == npcId){
                return this.npcList[i].mbti;
            }
        }
        return 0
    }

    /** 用服务端返回的 map 对象合并到 mapData（浅合并已知字段） */
    public applyMapFromServer(partial: Partial<UGCMapSnapshot> | Record<string, unknown>) {
        if (!partial || typeof partial !== "object") {
            return;
        }
        const m = this.mapData;
        const p = partial as Record<string, unknown>;
        const num = (v: unknown, d: number) => {
            if (v === undefined || v === null) {
                return d;
            }
            if (typeof v === "number" && !Number.isNaN(v)) {
                return v;
            }
            if (typeof v === "string" && v.trim() !== "") {
                const n = Number(v);
                return Number.isNaN(n) ? d : n;
            }
            return d;
        };
        const str = (v: unknown, d: string) => (v == null ? d : String(v));

        if (p.id !== undefined) m.id = num(p.id, m.id);
        if (p.player_id !== undefined) m.player_id = num(p.player_id, m.player_id);
        if (p.map_title !== undefined) m.map_title = num(p.map_title, m.map_title);
        if (p.map_name !== undefined) m.map_name = str(p.map_name, m.map_name);
        if (p.map_era !== undefined) m.map_era = num(p.map_era, m.map_era);
        if (p.map_worldview !== undefined) m.map_worldview = str(p.map_worldview, m.map_worldview);
        if (p.map_restriction !== undefined) m.map_restriction = str(p.map_restriction, m.map_restriction);
        if (p.map_story_title !== undefined) m.map_story_title = str(p.map_story_title, m.map_story_title);
        if (p.map_story_info !== undefined) m.map_story_info = str(p.map_story_info, m.map_story_info);
        if (p.map_state !== undefined) m.map_state = num(p.map_state, m.map_state);
        if (p.map_like_count !== undefined) m.map_like_count = num(p.map_like_count, m.map_like_count);
        if (p.map_cover_url !== undefined) m.map_cover_url = str(p.map_cover_url, m.map_cover_url);
        if (p.map_data !== undefined) m.map_data = str(p.map_data, m.map_data);
        if (p.map_npc !== undefined) m.map_npc = str(p.map_npc, m.map_npc);
        if (p.created_at !== undefined) m.created_at = str(p.created_at, m.created_at);
        if (p.updated_at !== undefined) m.updated_at = str(p.updated_at, m.updated_at);
        if (p.map_story !== undefined) m.map_story = p.map_story;
        if (p.daily_story !== undefined) m.daily_story = p.daily_story;
        if (p.map_card_master !== undefined) m.map_card_master = p.map_card_master;
    }

    /** 解析 map_npc JSON 字符串为 id 列表 */
    public parseMapNpcIds(): number[] {
        const raw = this.mapData.map_npc;
        if (!raw || typeof raw !== "string") {
            return [];
        }
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return parsed.map((x) => Number(x)).filter((n) => !Number.isNaN(n));
        } catch {
            return [];
        }
    }

    public resetMapData() {
        this.mapData = defaultMapSnapshot();
    }

    private OnHttpMessage(data: any) {
        if (!data) {
            return;
        }
        if (data.cmd == 1) {
            if (Array.isArray(data.daily_hot_npc_list)) {
                this.dailyHotNpcList = data.daily_hot_npc_list;
            } else {
                this.dailyHotNpcList = [];
            }
            EventSystem.send("OnRefreshDailyHotNpcList", this.dailyHotNpcList);
            return;
        }
        //functionName: "createMapWithTitle"
        if (data.functionName == "createMapWithTitle" && data.map) {
            this.applyMapFromServer(data.map);
            EventSystem.send("OnCreateMapSuccess", this.mapData)
        } else if (data.functionName == "getMap" && data.map) {
            this.applyMapFromServer(data.map);
            EventSystem.send("OnGetMapSuccess", this.mapData)

            AppConst.PanelManager.CloseViewByUrl("res/View/CreateMap/MyWorldView")
            AppConst.PanelManager.openView("res/View/CreateMap/CreateView")
        } else if (data.functionName == "saveMapWorldview" && data.map) {
            this.applyMapFromServer(data.map);
            EventSystem.send("OnSaveMapWorldviewSuccess", this.mapData)
        } else if (data.functionName == "getNpcByMap") {
            // getNpcByMap：返回 npc_list
            if (Array.isArray(data.npc_list)) {
                this.npcList = data.npc_list;
            } else {
                this.npcList = [];
            }
            EventSystem.send("OnRefreshUGCMapNpc")
        } else if (data.functionName == "creatorNpc") {
            // creatorNpc：统一壳 {success:true,data:{...,npc:{...}}}，这里收到的是 data.npc
            const npc = data;
            if (npc) {
                const list = this.npcList || [];
                const npcId = (npc.id != null ? npc.id : npc.npc_id);
                if (npcId != null) {
                    const idNum = Number(npcId);
                    const idx = list.findIndex((it: any) => {
                        const itId = it && (it.id != null ? it.id : it.npc_id);
                        return Number(itId) === idNum;
                    });
                    if (idx >= 0) {
                        list[idx] = npc;
                    } else {
                        list.push(npc);
                    }
                } else {
                    list.push(npc);
                }
                this.npcList = list;
                EventSystem.send("OnRefreshUGCMapNpc");
            }
        }
    }

    private token() {
        return RoleModel.getInstance().token;
    }

    public getMap(mapId) {
        AppConst.HttpManager.sendPostHttp(
            "getMap",
            JSON.stringify({ "token": this.token(), mapId: Number(mapId) })
        )
    }

    public createMap() {
        AppConst.HttpManager.sendPostHttp(
            "createMap",
            JSON.stringify({ "token": this.token() })
        )
    }

    public createMapWithTitle(mapTitle , mapName){
        AppConst.HttpManager.sendPostHttp(
            "createMapWithTitle",
            JSON.stringify({ "token": this.token() , 
                mapTitle: Number(mapTitle),
                mapName: String(mapName || "")
            })
        )
    }

    /** Step 1：创建地图（按接口文档的 creatorMap） */
    public creatorMap() {
        AppConst.HttpManager.sendPostHttp(
            "creatorMap",
            JSON.stringify({ "token": this.token() })
        )
    }

    //#### saveMapTitle
    public saveMap(mapId , mapTitle , mapName) {
        AppConst.HttpManager.sendPostHttp(
            "saveMap",
              JSON.stringify({
                "token": this.token(),
                mapId: Number(mapId),
                mapTitle: Number(mapTitle),
                mapName: String(mapName || "")
            })
        )
    }

    /** Step 1：保存标题（按接口文档的 saveMapTitle） */
    public saveMapTitle(mapId, mapTitle, mapName) {
        AppConst.HttpManager.sendPostHttp(
            "saveMapTitle",
            JSON.stringify({
                "token": this.token(),
                mapId: Number(mapId),
                mapTitle: Number(mapTitle),
                mapName: String(mapName || "")
            })
        )
    }

    //### Step 2：世界观保存 + AI 生成世界观
    public saveMapWorldview(mapId , mapWorldview , mapRestriction , mapEra){
        AppConst.HttpManager.sendPostHttp(
            "saveMapWorldview",
              JSON.stringify({
                "token": this.token(),
                mapId: Number(mapId),
                mapWorldview: mapWorldview,
                mapRestriction: mapRestriction,
                mapEra: mapEra
            })
        )
    }

    //#### generateWorldviewByAI（AI 透传）
    public generateWorldviewByAI(mapId , worldName , worldAttribute , eraBackground , ruleRestriction){
        AppConst.HttpManager.sendPostHttpAny(
            "generateWorldviewByAI",
              JSON.stringify({
                "token": this.token(),
                mapId: Number(mapId),
                worldName: worldName,
                worldAttribute: worldAttribute,
                eraBackground: eraBackground,
                ruleRestriction: ruleRestriction,
            })
        )
    }

    //### Step 3：NPC 增删改查 + AI 生成人设
    public creatorNpc(mapId , name , age){
        AppConst.HttpManager.sendPostHttp(
            "creatorNpc",
              JSON.stringify({
                "token": this.token(),
                mapId: Number(mapId),
                name: name,
                age: age
            })
        )
    }

    //#### getNpcByMap
    public getNpcByMap(mapId){
        AppConst.HttpManager.sendPostHttp(
            "getNpcByMap",
              JSON.stringify({
                "token": this.token(),
                mapId: Number(mapId),
            })
        )
    }

    //#### updateNpcById
    public updateNpcById(mapId , npcId , name , sex , mbti , renshe , background , hobbies){
        AppConst.HttpManager.sendPostHttp(
            "updateNpcById",
              JSON.stringify({
                "token": this.token(),
                mapId: Number(mapId),
                npcId: Number(npcId),
                name: name, 
                sex: sex,
                mbti: mbti,
                characteristics: renshe,
                identity: background,
                hobbies: hobbies
              })
        )
    }

    /**
     * 将内存中该 NPC 的当前字段同步到服务器（在本地 set/add/remove 之后调用）。
     * characteristics 为数组时会序列化为 JSON 字符串以符合接口 string 类型。
     */
    public syncNpcToServerById(npcId: number) {
        const mapId = this.mapData?.id;
        if (mapId == null || Number(mapId) <= 0) {
            return;
        }
        const idNum = Number(npcId);
        const npc = this.npcList.find((n: any) => {
            const nid = n && (n.id != null ? n.id : n.npc_id);
            return Number(nid) === idNum;
        });
        if (!npc) {
            return;
        }
        const name = String(npc.name ?? npc.npc_name ?? "");
        const sex = npc.sex;
        const mbti = npc.mbti;
        let characteristics: string;
        const ch = npc.characteristics;
        if (Array.isArray(ch)) {
            characteristics = JSON.stringify(ch);
        } else if (ch == null || ch === "") {
            characteristics = "";
        } else {
            characteristics = String(ch);
        }

        let hobbies = npc.hobbies ?? "";
        if (Array.isArray(hobbies)) {
            hobbies = JSON.stringify(hobbies);
        } else if (hobbies == null || hobbies === "") {
            hobbies = "";
        }
        const identity = String(npc.identity ?? "");
        
        this.updateNpcById(mapId, idNum, name, sex, mbti, characteristics, identity, hobbies);
    }

    public delNpcById(mapId , npcId){
        AppConst.HttpManager.sendPostHttp(
            "delNpcById",
              JSON.stringify({
                "token": this.token(),
                mapId: Number(mapId),
                npcId: Number(npcId)
            })
        )
    }

    //#### generateNpcByAI（AI 透传/准透传）
    public generateNpcByAI(mapId , npcId , name , gender , occupation , MBTI , world_setting , special_traits , appearance , personality , backstory,hobbies){
        AppConst.HttpManager.sendPostHttpAny(
            "generateNpcByAI",
              JSON.stringify({
                "token": this.token(),
                mapId: Number(mapId),
                npcId: Number(npcId),
                name: name,
                gender: gender,
                occupation: occupation,
                MBTI: MBTI,
                world_setting: world_setting,
                special_traits: special_traits,
                appearance: appearance,
                personality: personality,
                backstory: backstory,
                hobbies: hobbies
            })
        )
    }

    //### Step 4：地图编辑保存/清空 + 查询地图数据
    public saveMapData(mapId, mapData: string, base64Image: string = "") {
        AppConst.HttpManager.sendPostHttp(
            "saveMapData",
            JSON.stringify({
                "token": this.token(),
                mapId: Number(mapId),
                mapData: String(mapData || ""),
                base64Image: String(base64Image || "")
            })
        )
    }

    public deleteEditingMap(mapId) {
        AppConst.HttpManager.sendPostHttp(
            "deleteEditingMap",
            JSON.stringify({ "token": this.token(), mapId: Number(mapId) })
        )
    }

    // Step 5：故事大纲（AI 透传）
    public generateStoryOutlineByAI(mapId, map_info: any, npc_list: any[], story_setting: string) {
        AppConst.HttpManager.sendPostHttpAny(
            "generateStoryOutlineByAI",
            JSON.stringify({
                "token": this.token(),
                mapId: Number(mapId),
                map_info: map_info || { houses: [], items: [], locations: [] },
                npc_list: npc_list || [],
                story_setting: String(story_setting || "")
            })
        )
    }

    // Step 6：每日故事
    public generateDailyStory(payload: any) {
        AppConst.HttpManager.sendPostHttp(
            "generateDailyStory",
            JSON.stringify({ "token": this.token(), ...(payload || {}) })
        )
    }

    // Step 7：卡牌
    public generateMapCards(payload: any) {
        AppConst.HttpManager.sendPostHttp(
            "generateMapCards",
            JSON.stringify({ "token": this.token(), ...(payload || {}) })
        )
    }

    public generateCardStoryPreview(payload: any) {
        AppConst.HttpManager.sendPostHttp(
            "generateCardStoryPreview",
            JSON.stringify({ "token": this.token(), ...(payload || {}) })
        )
    }

    public generateCardStoryAndSave(payload: any) {
        AppConst.HttpManager.sendPostHttp(
            "generateCardStoryAndSave",
            JSON.stringify({ "token": this.token(), ...(payload || {}) })
        )
    }

    public updateCardFragmentTriggerTime(payload: any) {
        AppConst.HttpManager.sendPostHttp(
            "updateCardFragmentTriggerTime",
            JSON.stringify({ "token": this.token(), ...(payload || {}) })
        )
    }

    // Step 8：排期
    public generateMapSchedule(payload: any) {
        AppConst.HttpManager.sendPostHttp(
            "generateMapSchedule",
            JSON.stringify({ "token": this.token(), ...(payload || {}) })
        )
    }

    public saveMapSchedule(payload: any) {
        AppConst.HttpManager.sendPostHttp(
            "saveMapSchedule",
            JSON.stringify({ "token": this.token(), ...(payload || {}) })
        )
    }

    // 草稿箱 / 审核
    public getDraftMaps(page: number = 1, limit: number = 20) {
        AppConst.HttpManager.sendPostHttp(
            "getDraftMaps",
            JSON.stringify({ "token": this.token(), page: Number(page || 1), limit: Number(limit || 20) })
        )
    }

    public deleteDraftMap(mapId) {
        AppConst.HttpManager.sendPostHttp(
            "deleteDraftMap",
            JSON.stringify({ "token": this.token(), mapId: Number(mapId) })
        )
    }

    public submitMapForReview(mapId) {
        AppConst.HttpManager.sendPostHttp(
            "submitMapForReview",
            JSON.stringify({ "token": this.token(), mapId: Number(mapId) })
        )
    }

}

