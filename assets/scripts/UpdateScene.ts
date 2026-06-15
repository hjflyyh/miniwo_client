import { _decorator, Asset, Component, director, game, Label, loader, Node, ProgressBar, sys } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('UpdateScene')
export class UpdateScene extends Component {
    private _storagePath = '';
    private _am: jsb.AssetsManager = null!;

    @property(ProgressBar)
    public progressBar: ProgressBar = null!;

    @property(Label)
    public progressLabel: Label = null!;

    @property(Asset)
    manifestUrl: Asset = null!;

    private _checkListener = null;
    private _updating = false;
    private _failCount = 0;

    onLoad() {
        // Hot update is only available in Native build
        if (!jsb) {
            return;
        }
        this._storagePath = ((jsb.fileUtils ? jsb.fileUtils.getWritablePath() : '/') + 'blackjack-remote-asset');
        console.log('Storage path for remote asset : ' + this._storagePath);
        // this.versionCompareHandle = function (versionA: string, versionB: string) {

        // };
        this._am = new jsb.AssetsManager('', this._storagePath, this.versionCompareHandle);       
        this.progressLabel.string = 'Hot Update is ready, please check or directly update.';
        this.progressBar.progress = 0; 

        this.scheduleOnce(()=>{
            this.checkUpdate();
        } , 1)        
    }

    start() {

    }

    checkUpdate(){
        this.progressLabel.string = 'Checking hot update...';
        if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
            var url = this.manifestUrl.nativeUrl;
            if (loader.md5Pipe) {
                url = loader.md5Pipe.transformURL(url);
            }
            this._am.loadLocalManifest(url);
        }
        if (!this._am.getLocalManifest() || !this._am.getLocalManifest().isLoaded()) {
            this.progressLabel.string = 'Failed to load local manifest ...';
            return;
        }        
        this._am.setEventCallback(this.checkCb.bind(this));    
        
        this._am.checkUpdate();
        this._updating = true;        
    }
    
    checkCb(event: any){
        let isRungame = false;

        console.log('Code: ' + event.getEventCode());
        switch (event.getEventCode()) {
            case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                this.progressLabel.string = "No local manifest file found, hot update skipped.";
                break;
            case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
            case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
                this.progressLabel.string = "Fail to download manifest file, hot update skipped.";
                break;
            case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                this.progressLabel.string = "Already up to date with the latest remote version.";
                isRungame = true;
                break;
            case jsb.EventAssetsManager.NEW_VERSION_FOUND:
                this.progressLabel.string = 'New version found, please try to update. (' + Math.ceil(this._am.getTotalBytes() / 1024) + 'kb)';
                
                this.scheduleOnce(()=>{
                    this.hotUpdate();
                } , 1.5)                
                break;
            default:
                return;
        }


        this._am.setEventCallback(null!);
        this._checkListener = null;
        this._updating = false;

        if(isRungame)
        {
            director.loadScene('StartScene');
        }
    }

    hotUpdate(){
        if (this._am && !this._updating) {
            this._am.setEventCallback(this.updateCb.bind(this));

            if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
                // Resolve md5 url
                var url = this.manifestUrl.nativeUrl;
                if (loader.md5Pipe) {
                    url = loader.md5Pipe.transformURL(url);
                }
                this._am.loadLocalManifest(url);
            }

            this._failCount = 0;
            this._am.update();
            this._updating = true;
        }
    }

    updateCb(event: any){
        var needRestart = false;
        var failed = false;

        switch (event.getEventCode())
        {
            case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                this.progressLabel.string = "No local manifest file found, hot update skipped.";
                failed = true;

                break;
            case jsb.EventAssetsManager.UPDATE_PROGRESSION:
                var msg = event.getMessage();
                if (msg) {
                    // this.showText.string = 'Updated file: ' + msg;
                }
                this.progressLabel.string =  "File progression : " + (event.getPercent() * 100).toFixed(1) + "%";
                this.progressBar.progress = event.getPercent();
                break;
            case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
            case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
                this.progressLabel.string = "Fail to download manifest file, hot update skipped.";

                failed = true;
                break;
            case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                this.progressLabel.string = "Already up to date with the latest remote version.";

                failed = true;
                break;
            case jsb.EventAssetsManager.UPDATE_FINISHED:
                this.progressLabel.string = 'Update finished. ' + event.getMessage();
                needRestart = true;
                break;
            case jsb.EventAssetsManager.UPDATE_FAILED:
                this.progressLabel.string = 'Update failed. ' + event.getMessage();

                break;
            case jsb.EventAssetsManager.ERROR_UPDATING:
                this.progressLabel.string = 'Asset update error: ' + event.getAssetId() + ', ' + event.getMessage();

                break;
            case jsb.EventAssetsManager.ERROR_DECOMPRESS:
                this.progressLabel.string = event.getMessage();
                break;
            case jsb.EventAssetsManager.ASSET_UPDATED:

                break;
            case 11:

                break;
            default:
                break;
        }

        if (failed) {
            this._am.setEventCallback(null);
            // this._updateListener = null;
            this._updating = false;
        }

        if (needRestart) {
            this._am.setEventCallback(null);
            // this._updateListener = null;
            // Prepend the manifest's search path
            var searchPaths = jsb.fileUtils.getSearchPaths();
            var newPaths = this._am.getLocalManifest().getSearchPaths();
            Array.prototype.unshift.apply(searchPaths, newPaths);
            // This value will be retrieved and appended to the default search path during game startup,
            // please refer to samples/js-tests/main.js for detailed usage.
            // !!! Re-add the search paths in main.js is very important, otherwise, new scripts won't take effect.
            sys.localStorage.setItem('HotUpdateSearchPaths', JSON.stringify(searchPaths));
            jsb.fileUtils.setSearchPaths(searchPaths);

            // cc.audioEngine.stopAll();
            game.restart();
        }
    }

    versionCompareHandle(versionA: string, versionB: string){
            console.log("JS Custom Version Compare: version A is " + versionA + ', version B is ' + versionB);
            var vA = versionA.split('.');
            var vB = versionB.split('.');
            for (var i = 0; i < vA.length; ++i) {
                var a = parseInt(vA[i]);
                var b = parseInt(vB[i] || '0');
                if (a === b) {
                    continue;
                }
                else {
                    return a - b;
                }
            }
            if (vB.length > vA.length) {
                return -1;
            }
            else {
                return 0;
            }
    }
}

