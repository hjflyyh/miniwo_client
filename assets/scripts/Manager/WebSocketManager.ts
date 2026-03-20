import { _decorator, Component, Node , log} from 'cc';
import { network } from '../Model/RequestData';
import { AppConst } from '../AppConst';
import { RoleModel } from '../Model/RoleModel';
import { NPCModel } from '../Model/NPCModel';
const { ccclass, property } = _decorator;

/**
 * WebSocket 连接状态枚举
 */
export enum WebSocketState {
    CONNECTING = 0,      // 连接中
    OPEN = 1,            // 已连接
    CLOSING = 2,         // 关闭中
    CLOSED = 3,          // 已关闭
    RECONNECTING = 4     // 重连中
}

/**
 * WebSocket 事件类型
 */
export enum WebSocketEvent {
    CONNECTED = 'ws_connected',          // 连接成功
    DISCONNECTED = 'ws_disconnected',    // 连接断开
    MESSAGE = 'ws_message',              // 收到消息
    ERROR = 'ws_error',                  // 错误
    RECONNECTING = 'ws_reconnecting',    // 重连中
    NETWORK_CHANGE = 'ws_network_change' // 网络状态变化
}

/**
 * 网络强度枚举
 */
export enum NetworkStrength {
    EXCELLENT = 4,   // 优秀
    GOOD = 3,        // 良好
    FAIR = 2,        // 一般
    POOR = 1,        // 差
    NONE = 0         // 无网络
}

/**
 * WebSocket 配置接口
 */
export interface WebSocketConfig {
    url: string;                     // WebSocket 服务器地址
    protocols?: string | string[];   // 子协议
    reconnectInterval?: number;      // 重连间隔(毫秒)
    maxReconnectAttempts?: number;   // 最大重连尝试次数
    heartbeatInterval?: number;      // 心跳间隔(毫秒)
    heartbeatTimeout?: number;       // 心跳超时时间(毫秒)
    autoReconnect?: boolean;         // 是否自动重连
}

@ccclass('WebSocketManager')
export class WebSocketManager extends Component {
    private ws: WebSocket | null = null;
    private config: WebSocketConfig;
    private state: WebSocketState = WebSocketState.CLOSED;
    private isManualClose: boolean = false;
    private reconnectAttempts: number = 0;
    private lastMessageTime: number = 0;
    private heartbeatTimer: number = 0;

    private currentNetworkStrength: NetworkStrength = NetworkStrength.NONE;

    private reconnectTimer: number = 0;
    private heartbeatTimeoutTimer: number = 0;
    private serverTimestampMs: number = 0;
    private localSyncTimestampMs: number = 0;

    onLoad(){
        AppConst.WebSocketManager = this
    }

    start() {
    }

    public connect(): void {
        if (this.state === WebSocketState.CONNECTING || this.state === WebSocketState.OPEN) {
            console.warn('WebSocketManager: 已经在连接或已连接状态');
            return;
        }
        
        if(this.config == null){
            console.warn('WebSocketManager: 配置错误，请配置url');
            return;
        }
        this.isManualClose = false;
        this.reconnectAttempts = 0;
        
        this.doConnect();
    }

    // 主动断开（例如被顶号），并阻止自动重连
    public disconnect(): void {
        this.isManualClose = true;
        this.clearReconnectTimer();
        this.stopHeartbeat();

        if (!this.ws) {
            this.setState(WebSocketState.CLOSED);
            return;
        }

        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            return;
        }

        this.cleanupWebSocket();
        this.setState(WebSocketState.CLOSED);
    }

    public setConfig(url){
        log("socket:" + url)
        this.config = {
            url: url,
            protocols: null,
            reconnectInterval: 3000,
            maxReconnectAttempts: 5,
            heartbeatInterval: 30000,
            heartbeatTimeout: 10000,
            autoReconnect: true
        };
    }

    /**
     * 是否已连接
     */
    public isConnected(): boolean {
        return this.state === WebSocketState.OPEN && 
               this.ws?.readyState === WebSocket.OPEN;
    }

    public syncServerTimestampMs(serverTs: number): void {
        const normalized = this.normalizeTimestampMs(serverTs);
        if (!normalized) {
            return;
        }
        this.serverTimestampMs = normalized;
        this.localSyncTimestampMs = Date.now();
    }

    public getServerTimestampMs(): number {
        if (!this.serverTimestampMs || !this.localSyncTimestampMs) {
            return Date.now();
        }
        const elapsed = Date.now() - this.localSyncTimestampMs;
        return this.serverTimestampMs + Math.max(0, elapsed);
    }

    /**
     * 发送消息
     * @param data 要发送的数据
     */
    public send(data: any): boolean {
        if (this.state !== WebSocketState.OPEN || !this.ws) {
            console.error('WebSocketManager: 连接未建立，无法发送消息');
            return false;
        }
        
        try {
            let message = data;
            
            log("send msg:")
            log(JSON.stringify(message))
            
            this.ws.send(JSON.stringify(message));
            return true;
            
        } catch (error) {
            console.error('WebSocketManager: 发送消息失败', error);
            return false;
        }
    }    

    
    private doConnect(): void {
        try {
            this.setState(WebSocketState.CONNECTING);
            
            // 清除之前的 WebSocket 实例
            if (this.ws) {
                this.cleanupWebSocket();
            }
            
            // 创建新的 WebSocket 连接
            if (this.config.protocols) {
                this.ws = new WebSocket(this.config.url, this.config.protocols);
            } else {
                this.ws = new WebSocket(this.config.url);
            }
            this.ws.binaryType = 'arraybuffer';
            
            this.setupWebSocketEvents();
            
        } catch (error) {
            console.error('WebSocketManager: 创建连接失败', error);
            this.handleConnectionError();
        }
    }

    private setupWebSocketEvents(): void {
        if (!this.ws) return;
        
        this.ws.onopen = this.onOpen.bind(this);
        this.ws.onclose = this.onClose.bind(this);
        this.ws.onmessage = this.onMessage.bind(this);
        this.ws.onerror = this.onError.bind(this);
    }

        /**
     * 连接成功回调
     */
    private onOpen(event: Event): void {
        const wasReconnecting = this.reconnectAttempts > 0 || this.state === WebSocketState.RECONNECTING;
        console.log('WebSocketManager: 连接成功');
        this.setState(WebSocketState.OPEN);
        this.reconnectAttempts = 0;
        this.lastMessageTime = Date.now();
        
        RoleModel.getInstance().onWebSocketConnected()
        EventSystem.send("WebSocketConnected", { reconnected: wasReconnecting });

        this.sendHeartbeat()
        
        // if(AppConst.SDKManager.isEditMapingWeb){
        //     RoleModel.getInstance().sendLogin("1769413496856" , "1769413496856" ,"123")
        // }

        // 开始心跳检测
        this.startHeartbeat();
        
        // 触发连接成功事件
        // eventTarget.emit(WebSocketEvent.CONNECTED, event);
    }
    
    /**
     * 连接关闭回调
     */
    private onClose(event: CloseEvent): void {
        console.log(`WebSocketManager: 连接关闭, code: ${event.code}, reason: ${event.reason}`);
        this.setState(WebSocketState.CLOSED);
        
        // 清除心跳检测
        this.stopHeartbeat();
        
        // 触发连接断开事件
        // eventTarget.emit(WebSocketEvent.DISCONNECTED, event);
        
        // 如果不是手动关闭且配置了自动重连，则尝试重连
        if (!this.isManualClose && this.config.autoReconnect) {
            this.scheduleReconnect();
        }
    }
    
    /**
     * 收到消息回调
     */
    private onMessage(event: MessageEvent): void {
        this.lastMessageTime = Date.now();
        try {
            // 尝试解析 JSON 数据
            let data = event.data;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                    const topLevelTs = this.extractServerTimestampMs(data);
                    if (topLevelTs) {
                        this.syncServerTimestampMs(topLevelTs);
                    }
                    if(data.rpc != null && data.rpc.id != null){
                        // log("消息:")
                        console.log(data)
                        const rpcTs = this.extractServerTimestampMs(data.rpc.payload);
                        if (rpcTs) {
                            this.syncServerTimestampMs(rpcTs);
                        }
                        EventSystem.send("WebSocketMessage" , data.rpc)
                    }else if(data.notifications != null && data.notifications.notifications != null){
                        for(let d = 0 ; d < data.notifications.notifications.length ; d++){
                            EventSystem.send("WebSocketNotifications" , data.notifications.notifications[d])
                            console.log(JSON.parse(data.notifications.notifications[d].content))
                        }
                        
                    }else if(data.match_data != null){
                        const md = data.match_data
                        const opCode = Number(md.op_code)
                        const b64 = md.data as string

                        const binary = atob(b64)
                        const bytes = Uint8Array.from(binary , c => c.charCodeAt(0))
                        const jsonStr = new TextDecoder("utf-8").decode(bytes)

                        const payload = JSON.parse(jsonStr)
                        const payloadTs = this.extractServerTimestampMs(payload);
                        if (payloadTs) {
                            this.syncServerTimestampMs(payloadTs);
                        }

                        const match_data = {
                            matchId : md.match_id,
                            opCode,
                            reliable: !!md.reliable,
                            payload
                        }
                        EventSystem.send("OnMatchData" , match_data)
                    }else{
                        console.log(data)
                        log("消息错误")
                    }
                } catch {
                    // 如果不是 JSON，保持原样
                }
            }
            
            // 触发消息事件
            // eventTarget.emit(WebSocketEvent.MESSAGE, data);
            
        } catch (error) {
            console.error('WebSocketManager: 处理消息失败', error);
        }
    }
    
    /**
     * 错误回调
     */
    private onError(event: Event): void {
        console.error('WebSocketManager: 连接错误', event);
        
        // 触发错误事件
        // eventTarget.emit(WebSocketEvent.ERROR, event);
        
        // 处理连接错误
        this.handleConnectionError();
    }

    private handleConnectionError(): void {
        this.setState(WebSocketState.CLOSED);
        
        // 如果不是手动关闭且配置了自动重连，则尝试重连
        if (!this.isManualClose && this.config.autoReconnect) {
            this.scheduleReconnect();
        }
    }


    private scheduleReconnect(): void {
        // 检查是否达到最大重连次数
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
            console.error(`WebSocketManager: 已达到最大重连次数 (${this.config.maxReconnectAttempts})`);
            return;
        }
        
        // 检查网络状态
        if (!this.checkNetworkAvailable()) {
            console.warn('WebSocketManager: 网络不可用，暂停重连');
            return;
        }
        
        this.reconnectAttempts++;
        console.log(`WebSocketManager: 尝试重连 (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
        
        this.setState(WebSocketState.RECONNECTING);
        // eventTarget.emit(WebSocketEvent.RECONNECTING, { attempt: this.reconnectAttempts });
        
        // 设置重连定时器
        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            this.doConnect();
        }, this.config.reconnectInterval) as unknown as number;
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = 0;
        }
    }

    private cleanupWebSocket(): void {
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onclose = null;
            this.ws.onmessage = null;
            this.ws.onerror = null;
            
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
            
            this.ws = null;
        }
    }

    private setState(state: WebSocketState): void {
        this.state = state;
        console.log(`WebSocketManager: 状态改变 -> ${WebSocketState[state]}`);
    }

    private sendHeartbeat(){
        let json = new network.HeartbeatRequest();
        this.send(json.toJSON());
    }

    private startHeartbeat(): void {
        // 清除已有定时器
        this.stopHeartbeat();
        
        // 心跳定时器
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected()) {
                // 发送心跳包
                this.sendHeartbeat()
                
                // 设置心跳超时检测
                this.startHeartbeatTimeout();
            }
        }, this.config.heartbeatInterval) as unknown as number;
    }

    /**
     * 开始心跳超时检测
     */
    private startHeartbeatTimeout(): void {
        // 清除已有超时定时器
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
        }
        
        this.heartbeatTimeoutTimer = setTimeout(() => {
            // 检查最后收到消息的时间
            const now = Date.now();
            const timeSinceLastMessage = now - this.lastMessageTime;
            
            if (timeSinceLastMessage > this.config.heartbeatTimeout!) {
                console.error('WebSocketManager: 心跳超时，连接可能已断开');
                this.handleConnectionError();
            }
        }, this.config.heartbeatTimeout) as unknown as number;
    }    

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = 0;
        }
        
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = 0;
        }
    }

    private checkNetworkAvailable(): boolean {
        const strength = this.calculateNetworkStrength();
        return strength > NetworkStrength.NONE;
    }

    public getNetworkStrength(): NetworkStrength {
        return this.currentNetworkStrength;
    }

    private calculateNetworkStrength(): NetworkStrength {
        // 浏览器环境检测
        if (typeof window !== 'undefined' && 'navigator' in window) {
            // 检查是否有网络连接
            if (!navigator.onLine) {
                return NetworkStrength.NONE;
            }
            
            // 使用 Network Information API 获取更详细信息
            if ('connection' in navigator) {
                const connection = (navigator as any).connection;
                if (connection) {
                    const { effectiveType, downlink, rtt } = connection;
                    
                    // 根据网络类型判断
                    if (effectiveType === '4g') {
                        return NetworkStrength.EXCELLENT;
                    } else if (effectiveType === '3g') {
                        return NetworkStrength.GOOD;
                    } else if (effectiveType === '2g') {
                        return NetworkStrength.FAIR;
                    } else if (effectiveType === 'slow-2g') {
                        return NetworkStrength.POOR;
                    }
                    
                    // 根据下行速度判断
                    if (downlink >= 10) {
                        return NetworkStrength.EXCELLENT;
                    } else if (downlink >= 5) {
                        return NetworkStrength.GOOD;
                    } else if (downlink >= 1) {
                        return NetworkStrength.FAIR;
                    } else if (downlink > 0) {
                        return NetworkStrength.POOR;
                    }
                }
            }
            
            // 默认返回良好（假设有网络连接）
            return NetworkStrength.GOOD;
        }
        
        // 非浏览器环境
        return NetworkStrength.GOOD;
    }

    private normalizeTimestampMs(raw: any): number {
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) {
            return 0;
        }
        // 秒级时间戳自动转毫秒
        return n < 1e12 ? Math.floor(n * 1000) : Math.floor(n);
    }

    private extractServerTimestampMs(data: any): number {
        if (!data) {
            return 0;
        }

        if (typeof data === "string") {
            try {
                const parsed = JSON.parse(data);
                return this.extractServerTimestampMs(parsed);
            } catch {
                return 0;
            }
        }

        if (typeof data !== "object") {
            return 0;
        }

        const candidates = [
            data.server_ts,
            data.serverTs,
            data.server_time,
            data.serverTime,
            data.timestamp,
            data.ts,
            data.time,
        ];
        for (let i = 0; i < candidates.length; i++) {
            const normalized = this.normalizeTimestampMs(candidates[i]);
            if (normalized > 0) {
                return normalized;
            }
        }

        if (data.payload) {
            const fromPayload = this.extractServerTimestampMs(data.payload);
            if (fromPayload > 0) {
                return fromPayload;
            }
        }
        if (data.rpc && data.rpc.payload) {
            const fromRpcPayload = this.extractServerTimestampMs(data.rpc.payload);
            if (fromRpcPayload > 0) {
                return fromRpcPayload;
            }
        }

        return 0;
    }
}


