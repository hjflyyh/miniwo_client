import { _decorator, Component, Node } from 'cc';
import { FARM_EVENT_WEATHER_UPDATED, WeatherSnapshot } from '../../Model/Farm/FarmTypes';
import { FarmModel } from '../../Model/Farm/FarmModel';

const { ccclass, property } = _decorator;

/** 与 FarmTypes / 服务端 weather 枚举一致：0晴 1雨 2风 3雪 */
const WeatherType = {
    Sunny: 0,
    Rain: 1,
    Wind: 2,
    Snow: 3,
} as const;

@ccclass('GameWeather')
export class GameWeather extends Component {
    /** 下雨 */
    @property(Node)
    rain: Node = null;

    /** 下雪 */
    @property(Node)
    snow: Node = null;

    /** 刮风 */
    @property(Node)
    wind: Node = null;

    private weatherListener: Record<string, unknown> = {};

    onLoad() {
        this.hideAllEffects();
    }

    start() {
        EventSystem.addListent(FARM_EVENT_WEATHER_UPDATED, this.onWeatherUpdated, this);
        this.syncFromModel();
    }

    onDestroy() {
        
    }

    private onWeatherUpdated(snapshot?: WeatherSnapshot) {
        this.applyWeather(snapshot ?? FarmModel.getInstance().getWeather());
    }

    private syncFromModel() {
        this.applyWeather(FarmModel.getInstance().getWeather());
    }

    private applyWeather(snapshot: WeatherSnapshot | null) {
        if (!snapshot) {
            this.hideAllEffects();
            return;
        }

        const type = Number(snapshot.weather);
        if (this.rain) {
            this.rain.active = type === WeatherType.Rain;
        }
        if (this.wind) {
            this.wind.active = type === WeatherType.Wind;
        }
        if (this.snow) {
            this.snow.active = type === WeatherType.Snow;
        }
    }

    private hideAllEffects() {
        if (this.rain) {
            this.rain.active = false;
        }
        if (this.wind) {
            this.wind.active = false;
        }
        if (this.snow) {
            this.snow.active = false;
        }
    }
}
