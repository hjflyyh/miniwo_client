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
            if(data.success && data.data){
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

}


