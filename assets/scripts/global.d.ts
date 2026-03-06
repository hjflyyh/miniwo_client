/**
 * 全局事件系统类型声明
 * EventSystem 和 GridEventSystem 在 EventSystem.js 中定义并挂载到 window 对象
 */

interface IEventSystem {
    /**
     * 发送事件
     * @param eventKey 事件键名
     * @param param 可选参数1
     * @param param2 可选参数2
     */
    send(eventKey: string, param?: any, param2?: any): void;
    
    /**
     * 添加事件监听
     * @param eventKey 事件键名
     * @param eventCallBack 回调函数
     * @param target 目标对象
     */
    addListent(eventKey: string, eventCallBack: Function, target: any): void;
    
    /**
     * 移除目标对象的所有事件监听
     * @param target 目标对象
     */
    remove(target: any): void;
    
    /**
     * 移除所有事件监听
     */
    removeAll(): void;
    
    /**
     * 关闭视图并移除事件监听
     * @param target 目标对象
     */
    clostView(target: any): void;
    
    /**
     * 设置调试模式
     * @param debug 是否开启调试
     */
    setDebug(debug: boolean): void;
    
    /**
     * 设置订阅启用状态
     * @param enable 是否启用
     */
    setSubscribeEnable(enable: boolean): void;
    
    /**
     * 添加Bean对象
     * @param bean Bean对象
     */
    addBean(bean: any): void;
    
    /**
     * 遍历所有Bean对象并调用指定方法
     * @param method 方法名
     * @param params 参数数组
     */
    eachBean(method: string, params?: any[]): void;
}

declare const EventSystem: IEventSystem;
declare const GridEventSystem: IEventSystem;