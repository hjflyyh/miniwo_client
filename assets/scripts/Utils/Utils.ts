import { assetManager, Color, ImageAsset, instantiate, log, Sprite, SpriteFrame, sys, Texture2D, UITransform, v2, Vec2, Vec3, view } from "cc";
import { PrefabLoad } from "./PrefabLoad";
import { HttpManager } from "../Manager/HttpManager";
import { AppConst } from "../AppConst";

export class Utils{

    /** 当前时刻（毫秒）：优先 WebSocket 校准后的服务端时间 */
    public static getServerNowMs(): number {
        const wsNow = AppConst.WebSocketManager?.getServerTimestampMs?.();
        if (Number.isFinite(wsNow) && wsNow > 0) {
            return wsNow;
        }
        // return Date.now();
    }

    /** 当前时刻（Unix 秒）：优先服务端时间 */
    public static getServerNowSec(): number {
        return Math.floor(Utils.getServerNowMs() / 1000);
    }

    public static handleAdaptation(){
        let winSize = view.getVisibleSize();
        log("适配比例 ： " + (winSize.height / winSize.width))
        if(winSize.height / winSize.width <= 1.8){
            return true;            
        }
        return false;
    }


    /**
     * 计算两个时间戳之间的进度百分比
     * @param startTimestamp 开始时间戳（毫秒）
     * @param endTimestamp 结束时间戳（毫秒）
     * @param currentTimestamp 当前时间戳（毫秒，默认为当前时间）
     * @returns 剩余百分比（0-100），如果时间范围无效则返回0
     */
    public static calculateRemainingPercentage(
    startTimestamp: number,
    endTimestamp: number,
    currentTimestamp: number = Utils.getServerNowMs()
    ): number {
    // 验证时间戳有效性
    if (startTimestamp >= endTimestamp) {
        console.warn('开始时间必须小于结束时间');
        return 0;
    }

    // 如果当前时间已经超过结束时间，返回0%
    if (currentTimestamp >= endTimestamp) {
        return 0;
    }

    // 如果当前时间小于开始时间，返回100%
    if (currentTimestamp <= startTimestamp) {
        return 100;
    }

    // 计算总时长和已过去时长
    const totalDuration = endTimestamp - startTimestamp;
    const elapsedDuration = currentTimestamp - startTimestamp;

    // 计算剩余百分比
    const remainingPercentage = ((totalDuration - elapsedDuration) / totalDuration) * 100;

    // 保留两位小数并确保在0-100范围内
    return Math.min(100, Math.max(0, Math.round(remainingPercentage * 100) / 100));
    }


    public static getIOSDeviceType(): string {
        // 1. 基础平台检测：必须是原生平台且为 iOS 系统[citation:1][citation:10]
        if (sys.isNative && sys.os === sys.OS.IOS) {
            // 2. 获取用户代理字符串 (User Agent)
            const ua = window.navigator.userAgent.toLowerCase();
            
            // 3. 通过特征字符串进行精确匹配[citation:9]
            if (ua.includes('iphone') || ua.includes('ipod')) {
                return 'iPhone';        // 检测到 iPod 也归类为 iPhone 逻辑
            } else if (ua.includes('ipad')) {
                return 'iPad';
            } else {
                return 'unknown';       // 可能是 Apple TV 或模拟器环境
            }
        }
        
        console.warn('当前并非原生 iOS 平台，无法进行 iOS 设备类型判断');
        return 'unknown';
    }

    public static loadCover(url : string , sprite : Sprite , width = null , height = null){
        if (!url) return;
        if(!url.includes('http')){
            url = HttpManager.baseUrl + url
        }
        sprite.spriteFrame = null
        assetManager.loadRemote<ImageAsset>(url , (err , ImageAsset) => {
            // 异步返回时 cell 可能已回收 / 节点已销毁，避免访问无效 Sprite 报错
            if (!sprite || !sprite.isValid) {
                return;
            }
            if(err || !ImageAsset){
                console.log("图片下载失败" , err)
                sprite.spriteFrame = null
                return
            }
            const tex = new Texture2D()
            tex.image = ImageAsset

            const sf = new SpriteFrame()
            sf.texture = tex
            sprite.spriteFrame = sf


            const ui = sprite.getComponent(UITransform) || sprite.node.getComponent(UITransform);
            if (!ui) return;
            // 1) 目标框：参数为 null 的维度保持不变
            const targetW = width == null ? ui.width : width;
            const targetH = height == null ? ui.height : height;
            // 2) 原图尺寸
            const srcW = ImageAsset.width;
            const srcH = ImageAsset.height;
            if (srcW <= 0 || srcH <= 0 || targetW <= 0 || targetH <= 0) return;
            // 3) cover 等比填充：取较大缩放比
            //    - 大图会缩小
            //    - 小图会放大
            //    - 至少一边刚好撑满，另一边 >= 目标
            const scale = Math.max(targetW / srcW, targetH / srcH);
            const finalW = srcW * scale;
            const finalH = srcH * scale;
            // 4) 仅改图片显示尺寸，不改目标框定义
            //    如果你希望目标框固定 + 裁切，请确保父节点有 Mask
            ui.setContentSize(finalW, finalH);
        })
    }

    /**
     * 在父节点范围内等比缩放展示 modelImg（contain，不裁切）。
     * maxWidth / maxHeight 省略时取 Sprite 父节点 UITransform 尺寸，再退回 Sprite 自身尺寸。
     */
    public static loadCoverFitInsideParent(
        url: string,
        sprite: Sprite,
        maxWidth: number | null = null,
        maxHeight: number | null = null,
    ) {
        if (!url || !sprite) {
            return;
        }
        if (!url.includes('http')) {
            url = HttpManager.baseUrl + url;
        }
        assetManager.loadRemote<ImageAsset>(url, (err, imageAsset) => {
            if (!sprite?.isValid) {
                return;
            }
            if (err || !imageAsset) {
                console.log("图片下载失败", err);
                sprite.spriteFrame = null;
                return;
            }

            const tex = new Texture2D();
            tex.image = imageAsset;
            const sf = new SpriteFrame();
            sf.texture = tex;
            sprite.spriteFrame = sf;
            Utils.fitSpriteInsideParent(sprite, imageAsset.width, imageAsset.height, maxWidth, maxHeight);
        });
    }

    /** 将已挂载 spriteFrame 的 Sprite 按父节点范围等比缩放 */
    public static fitSpriteInsideParent(
        sprite: Sprite,
        imgW: number,
        imgH: number,
        maxWidth: number | null = null,
        maxHeight: number | null = null,
    ) {
        if (!sprite?.isValid || imgW <= 0 || imgH <= 0) {
            return;
        }

        let ui = sprite.getComponent(UITransform);
        if (!ui) {
            ui = sprite.node.addComponent(UITransform);
        }

        const parentUi = sprite.node.parent?.getComponent(UITransform);
        let maxW = maxWidth ?? parentUi?.width ?? 0;
        let maxH = maxHeight ?? parentUi?.height ?? 0;
        if (maxW <= 0 || maxH <= 0) {
            maxW = ui.width > 0 ? ui.width : 512;
            maxH = ui.height > 0 ? ui.height : 512;
        }

        const scale = Math.min(maxW / imgW, maxH / imgH);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        ui.setContentSize(imgW * scale, imgH * scale);
    }

    /**
     * 按目标高度等比缩放（宽度随比例变化，不裁切）。
     * targetHeight 省略时优先取父节点 UITransform 高度，其次 Sprite 自身高度。
     */
    public static loadCoverFitHeight(url: string, sprite: Sprite, targetHeight: number | null = null) {
        if (!url || !sprite) {
            return;
        }
        if (!url.includes('http')) {
            url = HttpManager.baseUrl + url;
        }
        assetManager.loadRemote<ImageAsset>(url, (err, imageAsset) => {
            if (!sprite?.isValid) {
                return;
            }
            if (err || !imageAsset) {
                console.log("图片下载失败", err);
                sprite.spriteFrame = null;
                return;
            }

            const tex = new Texture2D();
            tex.image = imageAsset;
            const sf = new SpriteFrame();
            sf.texture = tex;
            sprite.spriteFrame = sf;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;

            const ui = sprite.getComponent(UITransform) || sprite.node.getComponent(UITransform);
            if (!ui) {
                return;
            }

            const parentUi = sprite.node.parent?.getComponent(UITransform);
            const targetH = targetHeight ?? parentUi?.height ?? ui.height;
            const srcW = imageAsset.width;
            const srcH = imageAsset.height;
            if (srcW <= 0 || srcH <= 0 || targetH <= 0) {
                return;
            }

            const scale = targetH / srcH;
            const finalW = srcW * scale;
            ui.setContentSize(finalW, targetH);
        });
    }

    public static randomNum(minNum : number , maxNum: number){
        let num = 1;
        switch(arguments.length){
            case 1:
                let a = Math.random()*minNum+1
                num = parseInt(a + "" , 10);
                break
            case 2:
                let b = Math.random()*(maxNum - minNum+1)+minNum;
                num = parseInt(b+"", 10)
                break    
        }
        return num
    }

    //打乱数组
    public static shuffle(arr){
        var length = arr.length,randomIndex,temp;
        while(length){
            randomIndex = Math.floor(Math.random() * (length--))
            temp = arr[randomIndex]
            arr[randomIndex]= arr[length]
            arr[length] = temp
        }   
        return arr
    }

    //2点距离
    public static getDistance(start , end){
        return start.sub(end).mag()
    }

    //保留小数点N位
    public static roundToNum(num , round){
        return parseFloat(num.toFixed(round))
    }

    //数组中随机挑N个
    public static getRandomAry(ary , num){
        if(num >= ary){
            return ary;
        }
        let newAry = [];
        let retAry = [];
        for(let n = 0 ; n < ary.length ; n++){
            newAry.push(ary[n])
        }
        for(let n = 0 ; n < num ; n++){
            let ind = this.randomNum(1 , newAry.length) -1;
            retAry.push(newAry[ind])
            newAry.splice(ind , 1)
        }
        return retAry
    }

    public static lookAt(endPos , startPos){
        //朝向
        var dx = endPos.x- startPos.X
        var dy = endPos.y- startPos.year;
        var dir = v2(dx , dy)
        var angle = dir.signAngle(v2(1,0))
        var degree = angle / Math.PI * 100
        return degree
    }

    /**
     * 屏幕坐标转换为局部坐标
     */
    public static screenToLocal(screenPos: Vec2 , uiTransform): Vec3 {
        const worldPos = new Vec3(screenPos.x, screenPos.y, 0);
        
        if (uiTransform) {
            return uiTransform.convertToNodeSpaceAR(worldPos);
        }
        
        return worldPos;
    }
    
        /**
     * Bresenham直线算法 - 遍历两点间所有格子
     * @param start 起点坐标 (x, y)
     * @param end 终点坐标 (x, y)
     * @returns 路径上的所有格子坐标
     */
    public static bresenhamLine(start: Vec2, end: Vec2): Vec2[] {
        const points: Vec2[] = [];
        
        let x0 = Math.floor(start.x);
        let y0 = Math.floor(start.y);
        let x1 = Math.floor(end.x);
        let y1 = Math.floor(end.y);
        
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;
        
        while (true) {
            points.push(new Vec2(x0, y0));
            
            if (x0 === x1 && y0 === y1) break;
            
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
        
        return points;
    }

    /**
     * 遍历两点形成的矩形区域内的所有格子
     * @param start 起点
     * @param end 终点
     * @returns 矩形内所有格子坐标
     */
    public static traverseRectangle(start: Vec2, end: Vec2): Vec2[] {
        const points: Vec2[] = [];
        
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        
        // 遍历矩形区域
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                points.push(new Vec2(x, y));
            }
        }
        
        return points;
    }    

    public static instantiate(node){
        let newNode = instantiate(node)
        if(node.getComponent && typeof node.getComponent === 'function' && node.getComponent("PrefabLoad")){
            let prefab = node.getComponent("PrefabLoad") as PrefabLoad
            if(prefab != null){
                let newPrefab = newNode.getComponent("PrefabLoad") as PrefabLoad
                newPrefab.resRef = prefab.resRef
                prefab.resRef.addRef()
            }
        }
        return newNode
    }

    public static changeSpritesShader(node , isGray){
        let color = isGray ? Color.GRAY : Color.WHITE
        for (let i = 0; i < node.children.length; i++) {
            const sprite = node.getComponent("Sprite");
            if (sprite) {
                sprite.color = color;
            }
        }
    }

    public static getDateFromStr(timeStr) {
        // 截取T之前的部分（2026-03-18）
        return timeStr.split('T')[0];
    }
}