import { Observer } from "./Observer";

export default class EventBus extends Observer {
    private static _instance: EventBus = null;
    public static get I(): EventBus {
        if (this._instance == null) {
            this._instance = new EventBus();
        }
        return this._instance;
    }
}