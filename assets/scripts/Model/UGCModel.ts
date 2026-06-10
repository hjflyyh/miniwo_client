import { sys } from "cc";
import { AppConst } from "../AppConst";
import { MapModel } from "./MapModel";
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

    /** 个人全部 NPC（含 work_status），来自 listMyNpcs */
    public myNpcList: any[] = [];

    public init() {
        EventSystem.addListent("HttpMessage", this.OnHttpMessage, this);
    }



    public addNpcRenshe(npcId , rensheId){
        let renshe = this.getNpcRenshe(npcId);
        if(renshe.length >= 3){ 
            EventSystem.send("ShowTips" , "At most 3 characters are set.");
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
            this.myNpcList = [];
            for(let d = 0 ; d < this.dailyHotNpcList.length ; d++){
                if(this.dailyHotNpcList[d].player_id && this.dailyHotNpcList[d].player_id == RoleModel.getInstance().playerId){
                    this.myNpcList.push(this.dailyHotNpcList[d])
                }
            }
            console.log(this.myNpcList)
            for(let m = 0 ; m < this.myNpcList.length ; m++){   
                AppConst.JournalManager.addNpcJournal(this.myNpcList[m].npc_id , this.myNpcList[m].model_url)
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
            const mapId = Number(
                MapModel.getInstance().my_map_data?.id ?? this.mapData.id ?? data.mapId ?? 0,
            );
            if (mapId > 0) {
                this.mergeNpcListFromLocal(mapId);
            }
            EventSystem.send("OnRefreshUGCMapNpc")
        } else if (data.functionName == "listMyNpcs") {
            this.applyListMyNpcsFromHttp(data);
        } else if(data.functionName == "listGeneratedNpcs"){
            const list = data;
            EventSystem.send("OnRefreshGeneratedMyNpcList", list);
        }else if (data.functionName == "creatorNpc") {
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
                        npc.id = npcId
                        list.push(npc);
                    }
                } else {
                    npc.id = npcId
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

    /** 获取当前玩家全部 NPC（含 work_status 等） */
    public listMyNpcs() {
        AppConst.HttpManager.sendPostHttp(
            "listMyNpcs",
            JSON.stringify({ token: this.token() }),
        );
    }

    private parseNpcListFromHttpPayload(data: any): any[] {
        if (Array.isArray(data)) {
            return data;
        }
        if (Array.isArray(data?.npc_list)) {
            return data.npc_list;
        }
        if (Array.isArray(data?.npcs)) {
            return data.npcs;
        }
        if (Array.isArray(data?.list)) {
            return data.list;
        }
        return [];
    }

    /** listMyNpcs 回包：同步 myNpcList / npcList 并刷新 CreateNpcView */
    private applyListMyNpcsFromHttp(data: any) {
        const list = this.parseNpcListFromHttpPayload(data);
        this.myNpcList = list;
        this.npcList = list.slice();

        const mapId = Number(
            MapModel.getInstance().my_map_data?.id ?? this.mapData.id ?? data?.mapId ?? 0,
        );
        if (mapId > 0) {
            this.mergeNpcListFromLocal(mapId);
        }

        EventSystem.send("OnRefreshMyNpcList", this.myNpcList);
        EventSystem.send("OnRefreshUGCMapNpc");
        EventSystem.send("OnRefreshCreateNpcView");
    }

    /** 获取当前玩家全部 NPC（含数据库 work_status） */
    public listGeneratedNpcs() {
        AppConst.HttpManager.sendPostHttp(
            "listGeneratedNpcs",
            JSON.stringify({ token: this.token() }),
        );
    }

    /** 批量设置 NPC work_status：0=回家待机，1=去农场工作 */
    public batchSetNPCWorkStatus(npcIds: number[], workStatus: 0 | 1) {
        const ids = (npcIds || [])
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id) && id > 0);
        return AppConst.HttpManager.sendPostHttp(
            "api/npc/work_status/batch",
            JSON.stringify({
                token: this.token(),
                npc_ids: ids,
                work_status: workStatus,
            }),
        );
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
        const mapId = MapModel.getInstance().my_map_data.id;
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

    public getNpcById(npcId: number): any | null {
        const idNum = Number(npcId);
        if (!Number.isFinite(idNum) || idNum <= 0) {
            return null;
        }
        return this.npcList.find((n: any) => {
            const nid = n && (n.id != null ? n.id : n.npc_id);
            return Number(nid) === idNum;
        }) ?? null;
    }

    private patchNpcInList(list: any[], npcId: number, patch: Record<string, unknown>): boolean {
        const idNum = Number(npcId);
        if (!Array.isArray(list) || !Number.isFinite(idNum) || idNum <= 0) {
            return false;
        }
        for (let i = 0; i < list.length; i++) {
            const n = list[i];
            const nid = Number(n?.id ?? n?.npc_id);
            if (nid === idNum) {
                Object.assign(list[i], patch);
                return true;
            }
        }
        return false;
    }

    /** 序列帧生成任务已提交：同步 npcList / myNpcList 的 sprite_generating_status */
    public setNpcSpriteGeneratingStatus(npcId: number, status: number) {
        const patch = { sprite_generating_status: Math.floor(Number(status) || 0) };
        this.patchNpcInList(this.npcList, npcId, patch);
        this.patchNpcInList(this.myNpcList, npcId, patch);
        this.saveNpcListToLocal();
        EventSystem.send("OnRefreshUGCMapNpc");
        EventSystem.send("OnRefreshMyNpcList", this.myNpcList);
    }

    private npcListLocalStorageKey(mapId: number): string {
        return `ugc_npc_list_map_${Math.floor(Number(mapId) || 0)}`;
    }

    /** 将当前 npcList 写入本地（按地图维度缓存立绘 URL 等） */
    public saveNpcListToLocal(mapId?: number) {
        const mid = Math.floor(
            Number(mapId ?? MapModel.getInstance().my_map_data?.id ?? this.mapData.id ?? 0),
        );
        if (!Number.isFinite(mid) || mid <= 0) {
            return;
        }
        try {
            sys.localStorage.setItem(this.npcListLocalStorageKey(mid), JSON.stringify(this.npcList));
        } catch (e) {
            console.warn("[UGCModel] saveNpcListToLocal failed", e);
        }
    }

    /** 拉取服务端列表后，合并本地已缓存的立绘 URL */
    public mergeNpcListFromLocal(mapId: number) {
        const mid = Math.floor(Number(mapId) || 0);
        if (mid <= 0) {
            return;
        }
        try {
            const raw = sys.localStorage.getItem(this.npcListLocalStorageKey(mid));
            if (!raw) {
                return;
            }
            const cached = JSON.parse(raw);
            if (!Array.isArray(cached)) {
                return;
            }
            for (let i = 0; i < cached.length; i++) {
                const cn = cached[i];
                const idNum = Number(cn?.id ?? cn?.npc_id);
                if (!Number.isFinite(idNum) || idNum <= 0) {
                    continue;
                }
                const idx = this.npcList.findIndex((n: any) => {
                    const nid = n && (n.id != null ? n.id : n.npc_id);
                    return Number(nid) === idNum;
                });
                if (idx < 0) {
                    continue;
                }
                const modelUrl = String(cn?.model_url ?? cn?.standee_url ?? cn?.portrait_url ?? "").trim();
                if (modelUrl) {
                    this.npcList[idx].model_url = modelUrl;
                    this.npcList[idx].standee_url = String(cn?.standee_url ?? modelUrl).trim();
                    this.npcList[idx].portrait_url = String(cn?.portrait_url ?? modelUrl).trim();
                    AppConst.JournalManager.addNpcJournal(idNum, modelUrl);
                }
            }
        } catch (e) {
            console.warn("[UGCModel] mergeNpcListFromLocal failed", e);
        }
    }

    /**
     * 立绘生成完成：更新内存 NPC 与本地缓存。
     * model_url 为服务端 NPC 列表标准字段。
     */
    public applyStandeeUrlToNpc(npcId: number, standeeUrl: string, compositeNpcId?: string) {
        const url = String(standeeUrl || "").trim();
        if (!url) {
            return;
        }
        const npc = this.getNpcById(npcId);
        if (!npc) {
            return;
        }
        npc.model_url = url;
        npc.standee_url = url;
        npc.portrait_url = url;
        AppConst.JournalManager.addNpcJournal(npcId, url);
        if (compositeNpcId) {
            npc.composite_npc_id = String(compositeNpcId);
            npc.reference_image_url = this.buildStandeePreviewPath(compositeNpcId);
        }
        this.saveNpcListToLocal();
        EventSystem.send("OnRefreshUGCMapNpc");
    }

    /** 立绘预览路径，供序列帧生成 reference_image_url 使用 */
    public buildStandeePreviewPath(compositeNpcId: string): string {
        const key = String(compositeNpcId || "").trim();
        if (!key) {
            return "";
        }
        return `/api/npc/character/standee-preview/${key}`;
    }

    public getStandeeReferenceImageUrl(npcId: number): string {
        const npc = this.getNpcById(npcId);
        if (!npc) {
            return "";
        }
        const stored = String(npc.reference_image_url ?? "").trim();
        if (stored) {
            return stored;
        }
        const composite = String(npc.composite_npc_id ?? "").trim();
        if (composite) {
            return this.buildStandeePreviewPath(composite);
        }
        const mapId = Number(
            npc.map_id ?? MapModel.getInstance().my_map_data?.id ?? this.mapData.id ?? 0,
        );
        const nid = Number(npc.id ?? npc.npc_id ?? npcId);
        if (mapId > 0 && nid > 0) {
            return this.buildStandeePreviewPath(`${mapId}_${nid}`);
        }
        return "";
    }

    /** 根据立绘预览路径生成序列帧 → POST /api/npc/character/generate */
    public generateNpcSpriteFrames(npcId: number, name: string, referenceImageUrl: string) {
        const nid = this.resolveNpcIdForRequest(npcId);
        if (nid == null) {
            EventSystem.send("ShowTips", "NPC不存在");
            return Promise.reject(new Error("NPC not found"));
        }
        const ref = String(referenceImageUrl || "").trim();
        if (!ref) {
            EventSystem.send("ShowTips", "立绘预览地址无效");
            return Promise.reject(new Error("reference_image_url empty"));
        }
        return AppConst.HttpManager.sendPostHttpAny(
            "api/npc/character/generate",
            JSON.stringify({
                token: this.token(),
                npc_id: nid,
            }),
            { silent: false },
        );
    }

    private parseIdArray(maybe: any): number[] {
        if (maybe == null) return [];
        if (Array.isArray(maybe)) {
            return maybe.map((v) => Number(v)).filter((n) => Number.isFinite(n));
        }
        if (typeof maybe === "string") {
            const s = maybe.trim();
            if (!s) return [];
            if (s.startsWith("[") && s.endsWith("]")) {
                try {
                    const arr = JSON.parse(s);
                    if (Array.isArray(arr)) {
                        return arr.map((v) => Number(v)).filter((n) => Number.isFinite(n));
                    }
                } catch {
                    // fallthrough
                }
            }
            const nums = s.match(/\d+/g) || [];
            return nums.map((v) => Number(v)).filter((n) => Number.isFinite(n));
        }
        if (typeof maybe === "number" && Number.isFinite(maybe)) {
            return [maybe];
        }
        return [];
    }

    private parseStringList(maybe: any): string[] {
        if (maybe == null) return [];
        if (Array.isArray(maybe)) {
            return maybe.map((v) => String(v ?? "").trim()).filter(Boolean);
        }
        if (typeof maybe === "string") {
            const s = maybe.trim();
            if (!s) return [];
            if (s.startsWith("[") && s.endsWith("]")) {
                try {
                    const arr = JSON.parse(s);
                    if (Array.isArray(arr)) {
                        return arr.map((v) => String(v ?? "").trim()).filter(Boolean);
                    }
                } catch {
                    // fallthrough
                }
            }
            return s.split(/[,，|｜、\n\r\t]+/g).map((v) => v.trim()).filter(Boolean);
        }
        return [String(maybe)].map((v) => v.trim()).filter(Boolean);
    }

    private resolveTagNameById(id: number, tagType?: number): string {
        if (!Number.isFinite(id) || id <= 0) return "";
        const tags = RoleModel.getInstance()?.tags || [];
        for (let i = 0; i < tags.length; i++) {
            const t = tags[i];
            if (!t) continue;
            if (Number(t.id) === id) {
                if (tagType == null || Number(t.tag_type) === tagType) {
                    return String(t.tag_name || "");
                }
            }
        }
        return "";
    }

    private toTagNameArray(raw: any, tagType?: number): string[] {
        const ids = this.parseIdArray(raw);
        if (ids.length > 0) {
            return ids
                .map((id) => this.resolveTagNameById(id, tagType))
                .filter(Boolean);
        }
        return this.parseStringList(raw);
    }

    private sexToText(sex: any): string {
        const sexNum = Number(sex);
        if (sexNum === 0) return "Man";
        if (sexNum === 1) return "Woman";
        if (sexNum === 2) return "Other";
        if (typeof sex === "string" && sex.trim()) return sex.trim();
        return "";
    }

    /** 组装 generateAICharacter 请求体（标签 id 转为 tag_name） */
    public buildGenerateAICharacterPayload(npcId: number): Record<string, unknown> | null {
        const npc = this.getNpcById(npcId);
        if (!npc) return null;

        const mapId = Number(
            npc.map_id ?? MapModel.getInstance().my_map_data?.id ?? this.mapData.id ?? 0
        );
        const nid = Number(npc.id ?? npc.npc_id ?? npcId);

        return {
            token: this.token(),
            name: String(npc.name ?? ""),
            age: Number(npc.age ?? 0),
            sex: this.sexToText(npc.sex),
            mbti: this.resolveTagNameById(Number(npc.mbti), 5),
            characteristics: this.toTagNameArray(npc.characteristics, 2),
            hobbies: this.toTagNameArray(npc.hobbies),
            identity: this.toTagNameArray(npc.identity, 7),
            map_id: mapId,
            npc_id: nid,
        };
    }

    /** AI 生成角色人设（透传 JSON：{ ok, data }） */
    public generateAICharacter(npcId: number) {
        const body = this.buildGenerateAICharacterPayload(npcId);
        if (!body) {
            EventSystem.send("ShowTips", "NPC不存在");
            return Promise.reject(new Error("NPC not found"));
        }
        return AppConst.HttpManager.sendPostHttpAny(
            "generateAICharacter",
            JSON.stringify(body),
            { silent: false },
        );
    }

    /** 将 generateAICharacter 返回的 data 合并进内存 NPC */
    public applyAICharacterToNpc(npcId: number, aiData: Record<string, unknown>) {
        const npc = this.getNpcById(npcId);
        if (!npc || !aiData) return;
        Object.assign(npc, aiData);
    }

    private resolveNpcIdForRequest(npcId: number): number | null {
        const npc = this.getNpcById(npcId);
        const nid = Number(npc?.id ?? npc?.npc_id ?? npcId);
        if (!Number.isFinite(nid) || nid <= 0) {
            return null;
        }
        return Math.floor(nid);
    }

    /** 模式 B：外貌描述文生图 → POST /api/npc/character/standee */
    public generateNpcCharacterByText(npcId: number, name: string, npcDescription: string) {
        const nid = this.resolveNpcIdForRequest(npcId);
        if (nid == null) {
            EventSystem.send("ShowTips", "NPC不存在");
            return Promise.reject(new Error("NPC not found"));
        }
        return AppConst.HttpManager.sendPostHttpAny(
            "api/npc/character/standee",
            JSON.stringify({
                token: this.token(),
                npc_id: nid,
                name: String(name || ""),
                npc_description: String(npcDescription || ""),
            }),
            { silent: false },
        );
    }

    /** 模式 A：参考图图生图 → POST /api/npc/character/standee */
    public generateNpcCharacterByReference(npcId: number, name: string, referenceImageData: string) {
        const nid = this.resolveNpcIdForRequest(npcId);
        if (nid == null) {
            EventSystem.send("ShowTips", "NPC不存在");
            return Promise.reject(new Error("NPC not found"));
        }
        return AppConst.HttpManager.sendPostHttpAny(
            "api/npc/character/standee",
            JSON.stringify({
                token: this.token(),
                npc_id: nid,
                name: String(name || ""),
                reference_image_data: String(referenceImageData || ""),
            }),
            { silent: false },
        );
    }

    /** 立绘异步任务轮询 → GET /api/npc/character/standee/:task_id */
    public queryNpcStandeeTask(taskId: string) {
        const id = encodeURIComponent(String(taskId || "").trim());
        if (!id) {
            return Promise.reject(new Error("task_id empty"));
        }
        return AppConst.HttpManager.sendGetHttpAny(
            `api/npc/character/standee/${id}?token=${encodeURIComponent(this.token())}`,
            { silent: false },
        );
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

