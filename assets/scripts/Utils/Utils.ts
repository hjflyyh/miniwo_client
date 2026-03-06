import { Color, instantiate, v2, Vec2, Vec3 } from "cc";
import { PrefabLoad } from "./PrefabLoad";

export class Utils{
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
}