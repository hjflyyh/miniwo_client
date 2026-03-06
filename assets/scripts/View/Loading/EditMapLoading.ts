import { _decorator, Component, Node , ProgressBar , director, assetManager, log} from 'cc';
import {MapAssetsManager} from "db://assets/src/common/MapAssetsManager";
import {AppConst} from "db://assets/scripts/AppConst";
const { ccclass, property } = _decorator;

@ccclass('EditMapLoading')
export class EditMapLoading extends Component {
    @property(ProgressBar)
    progressBar : ProgressBar

    loadSpeed = 0.02
    isLoadSuccess = false
    start() {
        this.loadSpeed = 0.02
        // EventSystem.addListent("MapAssetsManagerLoad" , this.mapAssetsManagerLoad , this)
        this.progressBar.progress = 0
        MapAssetsManager.GetInstance().loadMapEditorAssets();
        let _this = this

        director.preloadScene('editor_test', function (completedCount, totalCount, item) {
            _this.progressBar.progress = completedCount / totalCount;
        }, function () {
            director.loadScene("editor_test", (error) => {
                if (error) {
                    console.error(`加载场景 GameScene 失败:`, error);
                    return;
                }
                console.log(`场景 GameScene 切换成功`);
                _this.loadSpeed = 0.5
                _this.isLoadSuccess = true

                AppConst.PanelManager.CloseView(_this)
            });
        });
    }
}

