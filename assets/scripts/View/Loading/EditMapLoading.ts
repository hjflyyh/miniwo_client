import { _decorator, Component, ProgressBar, director } from 'cc';
import { MapAssetsManager } from 'db://assets/src/common/MapAssetsManager';
import { AppConst } from 'db://assets/scripts/AppConst';
import { MapModel } from 'db://assets/scripts/Model/MapModel';
import { FarmMapAssetPreloader } from '../Game/FarmMapAssetPreloader';
const { ccclass, property } = _decorator;

const EDIT_MAP_EDITOR_READY_EVENT = 'EditMapEditorReady';
const MAP_EDITOR_READY_TIMEOUT_MS = 60000;

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

        EventSystem.send("HideJuhua", "EnterGameMap");
    }

    protected onDestroy(): void {
        EventSystem.remove(this);
    }

    private setProgress(ratio: number) {
        if (this.progressBar?.isValid) {
            this.progressBar.progress = Math.max(0, Math.min(1, ratio));
        }
    }

    private waitForMapEditorReady(): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                resolve();
            };

            EventSystem.addListent(EDIT_MAP_EDITOR_READY_EVENT, finish, this);
            const timer = setTimeout(() => {
                console.warn('[EditMapLoading] EditMapEditorReady timeout');
                finish();
            }, MAP_EDITOR_READY_TIMEOUT_MS);
        });
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
                this.setProgress(isFarmMap ? 0.12 : 0.35);
            })
            .catch((e) => {
                console.warn('[EditMapLoading] loadMapEditorAssets failed', e);
            });

        const farmPromise = isFarmMap
            ? FarmMapAssetPreloader.preload((ratio) => {
                  this.setProgress(0.12 + ratio * 0.58);
              }).catch((e) => {
                  console.warn('[EditMapLoading] FarmMapAssetPreloader failed', e);
              })
            : Promise.resolve();

        await Promise.all([mapAssetsPromise, farmPromise]);

        const editorReadyPromise = this.waitForMapEditorReady();

        await new Promise<void>((resolve) => {
            director.preloadScene(
                'editor_test',
                (completedCount, totalCount) => {
                    const base = isFarmMap ? 0.72 : 0.35;
                    const span = isFarmMap ? 0.18 : 0.6;
                    const sceneRatio = totalCount > 0 ? completedCount / totalCount : 1;
                    this.setProgress(base + sceneRatio * span);
                },
                () => {
                    resolve();
                }
            );
        });

        await new Promise<void>((resolve, reject) => {
            director.loadScene('editor_test', (error) => {
                if (error) {
                    console.error('加载场景 editor_test 失败:', error);
                    reject(error);
                    return;
                }
                console.log('场景 editor_test 切换成功');
                resolve();
            });
        }).catch(() => undefined);

        if (!this.node?.isValid) {
            return;
        }

        this.setProgress(0.92);
        await editorReadyPromise;
        this.setProgress(1);

        console.log('[EditMapLoading] 地图底图与内容初始化完成');
        this.loadSpeed = 0.5;
        this.isLoadSuccess = true;
        AppConst.PanelManager.CloseView(this);
    }
}


