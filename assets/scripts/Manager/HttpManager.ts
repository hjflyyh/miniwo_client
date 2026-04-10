import { _decorator, Component, log, Node } from 'cc';
import { AppConst } from '../AppConst';
const { ccclass, property } = _decorator;

@ccclass('HttpManager')
export class HttpManager extends Component {
    public static ipBase = "192.168.30.109"
    public static baseUrl = "http://" + HttpManager.ipBase + ":8080"
    public static chatBaseUrl = "http://" + HttpManager.ipBase + ":7350"
    start() {
        AppConst.HttpManager = this
    }

    public sendPostHttp(functionName , data){
        log(functionName)
        EventSystem.send("ShowJuhua" ,"HttpSend")
        fetch(HttpManager.baseUrl + "/" + functionName , {
            method :'POST',
            headers: {'Content-Type': 'application/json'},
            body: data
        })
        .then(res => res.json())
        .then(data => {
            console.log("请求回复：",data)
            if(data.success){
                if(data.data == null){
                    data.data = {}
                }
                if(data.data["functionName"] == null){
                    data.data["functionName"] = functionName
                }
                
                EventSystem.send("HttpMessage" , data.data)
            }else{
                if(data.error){
                    EventSystem.send("ShowTips" , data.error)
                }
            }
        })
    }

    /**
     * 兼容 AI 透传 JSON：不要求 {success:true,data} 包装，直接把原始响应派发出去。
     * 仍会优先提示 error/message 字段。
     */
    public sendPostHttpAny(functionName: string, data: any) {
        log(functionName);
        EventSystem.send("ShowJuhua", "HttpSend");
        fetch(HttpManager.baseUrl + "/" + functionName, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data
        })
            .then(res => res.json())
            .then(resp => {
                console.log("请求回复：", resp);
                if (resp?.error) {
                    EventSystem.send("ShowTips", resp.error);
                    return;
                }
                if (resp?.message && resp?.success === false) {
                    EventSystem.send("ShowTips", resp.message);
                    return;
                }
                // 统一派发：业务侧可按 functionName 区分解析
                EventSystem.send("HttpMessage", { functionName, raw: resp });
            });
    }

}


