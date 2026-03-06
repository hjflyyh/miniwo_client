import { _decorator, Component, Label, Node, Sprite } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('FakeLoading')
export class FakeLoading extends Component {
    @property(Sprite)
    progressBar: Sprite = null;  // 进度条组件

    @property
    minLoadTime: number = 2;        // 最小加载时间(秒)

    @property
    maxLoadTime: number = 5;        // 最大加载时间(秒)

    private currentProgress: number = 0;  // 当前进度
    private targetProgress: number = 0;   // 目标进度
    private loadDuration: number = 0;     // 总加载时长
    private elapsedTime: number = 0;      // 已加载时间
    private isLoading: boolean = false;   // 是否正在加载

    protected onLoad(): void {
        this.node.on("startFakeLoading", this.startFakeLoading, this);
        this.node.on("onLoadComplete", this.onLoadComplete, this);
    }

    protected onDestroy(): void {
        this.node.off("startFakeLoading", this.startFakeLoading, this);
        this.node.off("onLoadComplete", this.onLoadComplete, this);
    }

    start() {

    }

    update(deltaTime: number) {
        if (!this.isLoading) return;

        // 累计时间
        this.elapsedTime += deltaTime;

        // 计算理论进度(基于时间)
        const timeBasedProgress = Math.min(this.elapsedTime / this.loadDuration, 1);

        // 动态调整目标进度，使其接近时间进度但有一些随机性
        this.targetProgress = Math.max(this.targetProgress, timeBasedProgress * 0.95 + Math.random() * 0.05);
        this.targetProgress = Math.min(this.targetProgress, 1);

        // 平滑过渡到目标进度
        this.currentProgress += (this.targetProgress - this.currentProgress) * 0.1;
        this.currentProgress = Math.min(this.currentProgress, 1);

        // 更新UI显示
        this.updateUI();

        // 加载完成
        if (this.currentProgress >= 0.89 && this.elapsedTime >= this.loadDuration) {
            this.updateUI();
            this.isLoading = false;
        }
    }

    // 开始假加载
    startFakeLoading() {
        this.resetLoading();
        // 随机生成加载时长
        this.loadDuration = this.minLoadTime + Math.random() * (this.maxLoadTime - this.minLoadTime);
        this.isLoading = true;
    }

    // 重置加载状态
    resetLoading() {
        this.currentProgress = 0;
        this.targetProgress = 0;
        this.elapsedTime = 0;
        this.isLoading = false;
        this.updateUI();
    }

    // 更新UI显示
    updateUI() {
        if (this.progressBar) {
            this.progressBar.fillRange = this.currentProgress;
        }
    }

    // 加载完成回调
    onLoadComplete() {
        console.log("加载完成！");
        this.currentProgress = 1;
        this.updateUI();
        this.scheduleOnce(() => {
            this.node.active = false;
        })
        // 这里可以添加加载完成后的逻辑，比如进入游戏主界面
        // 示例：this.sceneManager.loadScene("MainScene");
    }

    // 手动触发重新加载
    restartLoading() {
        this.startFakeLoading();
    }
}


