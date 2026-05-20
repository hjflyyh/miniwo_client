import { _decorator, Component, ProgressBar, director } from 'cc';
import { MapAssetsManager } from 'db://assets/src/common/MapAssetsManager';
import { AppConst } from 'db://assets/scripts/AppConst';
import { MapModel } from 'db://assets/scripts/Model/MapModel';
import { FarmMapAssetPreloader } from 'db://assets/bundles/mapEditor/src/farm/FarmMapAssetPreloader';
import { FarmModel } from 'db://assets/scripts/Model/Farm/FarmModel';
const { ccclass, property } = _decorator;

@ccclass('EditMapLoading')
export class EditMapLoading extends Component {
    @property(ProgressBar)
    progressBar: ProgressBar = null;

    loadSpeed = 0.02;
    isLoadSuccess = false;

    start() {
        this.progressBar.progress = 0;
        this.loadSpeed = 0.02;
        this.isLoadSuccess = false;
        void this.runLoadingPipeline();
    }

    private setProgress(ratio: number) {
        if (this.progressBar?.isValid) {
            this.progressBar.progress = Math.max(0, Math.min(1, ratio));
        }
    }

    private async runLoadingPipeline() {
        const mapModel = MapModel.getInstance();
        const mapGameType =
            mapModel.pendingMapGameType ?? mapModel.resolveMapGameType(mapModel.map_detail);
        const isFarmMap = mapGameType === 0 || mapGameType == null;
        if (isFarmMap && mapModel.pendingMapGameType == null) {
            mapModel.pendingMapGameType = 0;
        }

        const mapAssetsPromise = MapAssetsManager.GetInstance()
            .loadMapEditorAssets()
            .then(() => {
                this.setProgress(isFarmMap ? 0.15 : 0.35);
            })
            .catch((e) => {
                console.warn('[EditMapLoading] loadMapEditorAssets failed', e);
            });

        const farmPromise = isFarmMap
            ? FarmMapAssetPreloader.preload((ratio) => {
                  this.setProgress(0.15 + ratio * 0.55);
              }).catch((e) => {
                  console.warn('[EditMapLoading] FarmMapAssetPreloader failed', e);
              })
            : Promise.resolve().then(() => {
                  if (!isFarmMap) {
                      this.setProgress(0.35);
                  }
              });

        await Promise.all([mapAssetsPromise, farmPromise]);

        await new Promise<void>((resolve) => {
            director.preloadScene(
                'editor_test',
                (completedCount, totalCount) => {
                    const base = isFarmMap ? 0.7 : 0.35;
                    const span = isFarmMap ? 0.28 : 0.6;
                    const sceneRatio = totalCount > 0 ? completedCount / totalCount : 1;
                    this.setProgress(base + sceneRatio * span);
                },
                () => {
                    resolve();
                }
            );
        });

        director.loadScene('editor_test', (error) => {
            if (error) {
                console.error('加载场景 editor_test 失败:', error);
                return;
            }
            console.log('场景 editor_test 切换成功');
            if (mapModel.isFarmMapGameType() || isFarmMap) {
                console.log('[EditMapLoading] 进图拉取农场天气');
                void FarmModel.getInstance().enterFarm();
            }
            this.loadSpeed = 0.5;
            this.isLoadSuccess = true;
            AppConst.PanelManager.CloseView(this);
        });
    }
}
