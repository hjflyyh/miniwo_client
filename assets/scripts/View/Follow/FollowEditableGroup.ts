import { _decorator, Component, EditBox, EventTouch, Label, Node, Size, Sprite, SpriteFrame, UITransform, Vec2, Vec3, v3 } from 'cc';
const { ccclass , property} = _decorator;

export type FollowEditableType = 'editImg' | 'editBox';

type InitParams = {
    type: FollowEditableType;
    spriteFrame?: SpriteFrame | null;
    imageWidth?: number;
    imageHeight?: number;
    text?: string;
};

type GroupState = {
    inited: boolean;
    type: FollowEditableType;
    designBg: Size;
    designContent: Size;
    baseContent: Size;
    closePos: Vec3;
    scalePos: Vec3;
    rotationPos: Vec3;
    contentScale: number;

    dragging: boolean;
    dragLast: Vec2;
    tmpDragPending: boolean;
    tmpDragStart: Vec2;

    scaling: boolean;
    scaleLastDist: number;

    rotating: boolean;
    rotLastRad: number;

    controlsVisible: boolean;
    tapStartUi: Vec2;
};

@ccclass('FollowEditableGroup')
export class FollowEditableGroup extends Component {
    @property(Node)
    public dragLimitNode: Node | null = null;

    private _state: GroupState = {
        inited: false,
        type: 'editImg',
        designBg: new Size(1, 1),
        designContent: new Size(1, 1),
        baseContent: new Size(1, 1),
        closePos: v3(),
        scalePos: v3(),
        rotationPos: v3(),
        contentScale: 1,
        dragging: false,
        dragLast: new Vec2(),
        tmpDragPending: false,
        tmpDragStart: new Vec2(),
        scaling: false,
        scaleLastDist: 0,
        rotating: false,
        rotLastRad: 0,

        controlsVisible: true,
        tapStartUi: new Vec2(),
    };

    private readonly _scaleMin = 0.25;
    private readonly _scaleMax = 20;
    private readonly _textMinH = 40;
    private readonly _textFixedW = 160;

    private _bound = false;
    private _limitNode: Node | null = null;
    private _tapThreshold = 12;

    protected start(): void {
        EventSystem.addListent("OnHideFollowEditleGroupBg" , function(){
            this._setControlsVisible(false)
        }, this)
    }

    public init(params: InitParams) {
        this._state.type = params.type;
        this._captureDesignIfNeeded();
        this._ensureBound();

        if (params.type === 'editImg') {
            this._initEditImg(params.spriteFrame ?? null, params.imageWidth, params.imageHeight);
        } else {
            this._initEditBox(params.text ?? '');
        }
        // init 默认隐藏控制点，但允许拖拽
        // this._setControlsVisible(false);
        this._refreshLayout();
        this._clampToEditNodeRange();
    }

    public setDragLimitNode(node: Node | null) {
        this.dragLimitNode = node;
        this._limitNode = node;
    }

    onDestroy() {
        this._unbind();
    }

    private _setControlsVisible(visible: boolean) {
        this._state.controlsVisible = visible;
        const bg = this.node.getChildByName('bg');
        const close = this.node.getChildByName('close');
        const scaleNode = this.node.getChildByName('scaleNode');
        const rotationNode = this.node.getChildByName('rotationNode');

        if (bg) bg.active = visible;
        if (close) close.active = visible;
        if (scaleNode) scaleNode.active = visible;
        if (rotationNode) rotationNode.active = visible;

        if (this._state.type === 'editBox') {
            const tmp = this.node.getChildByName('tmpEditBox');
            const eb = tmp?.getComponent(EditBox);
            if (eb) {
                eb.enabled = visible;
            }
        }
    }

    private _captureDesignIfNeeded() {
        if (this._state.inited) {
            return;
        }
        const bg = this.node.getChildByName('bg');
        const close = this.node.getChildByName('close');
        const scaleNode = this.node.getChildByName('scaleNode');
        const rotationNode = this.node.getChildByName('rotationNode');
        const contentNode = this._getContentNode();
        const bgUt = bg?.getComponent(UITransform);
        const contentUt = contentNode?.getComponent(UITransform);

        if (!bgUt || !contentUt) {
            return;
        }

        this._state.designBg.set(bgUt.contentSize);
        this._state.designContent.set(contentUt.contentSize);
        this._state.baseContent.set(contentUt.contentSize);
        this._state.closePos = close ? close.position.clone() : v3();
        this._state.scalePos = scaleNode ? scaleNode.position.clone() : v3();
        this._state.rotationPos = rotationNode ? rotationNode.position.clone() : v3();
        this._state.inited = true;
    }

    private _getContentNode(): Node | null {
        if (this._state.type === 'editImg') {
            return this.node.getChildByName('showImg');
        }
        return this.node.getChildByName('tmpEditBox');
    }

    private _initEditImg(frame: SpriteFrame | null, imageWidth?: number, imageHeight?: number) {
        const showImg = this.node.getChildByName('showImg');
        const sp = showImg?.getComponent(Sprite);
        const ut = showImg?.getComponent(UITransform);
        if (!showImg || !sp || !ut) {
            return;
        }
        const width = imageWidth ?? 100;
        const height = imageHeight ?? 100;
        if (frame) {
            sp.spriteFrame = frame;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        ut.setContentSize(width, height);
        this._state.baseContent.set(width, height);
        showImg.setScale(1, 1, 1);
    }

    private _initEditBox(text: string) {
        const tmp = this.node.getChildByName('tmpEditBox');
        const eb = tmp?.getComponent(EditBox);
        const tmpUt = tmp?.getComponent(UITransform);
        if (!tmp || !eb || !tmpUt) {
            return;
        }
        eb.string = text;
        const label = eb.textLabel;
        const labelUt = label?.node.getComponent(UITransform);
        if (!label || !labelUt) {
            return;
        }

        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.enableWrapText = true;
        labelUt.setContentSize(this._textFixedW, labelUt.contentSize.height);
        label.updateRenderData(true);
        const h = Math.max(labelUt.contentSize.height, this._textMinH);

        tmpUt.setContentSize(this._textFixedW, h);
        this._state.baseContent.set(this._textFixedW, h);
        tmp.setScale(1, 1, 1);

        eb.node.off(EditBox.EventType.TEXT_CHANGED, this._onTextChanged, this);
        eb.node.on(EditBox.EventType.TEXT_CHANGED, this._onTextChanged, this);
    }

    private _onTextChanged() {
        if (this._state.type !== 'editBox') {
            return;
        }
        const tmp = this.node.getChildByName('tmpEditBox');
        const eb = tmp?.getComponent(EditBox);
        const tmpUt = tmp?.getComponent(UITransform);
        const label = eb?.textLabel;
        const labelUt = label?.node.getComponent(UITransform);
        if (!tmp || !eb || !tmpUt || !label || !labelUt) {
            return;
        }
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.enableWrapText = true;
        labelUt.setContentSize(this._textFixedW, labelUt.contentSize.height);
        label.updateRenderData(true);
        const h = Math.max(labelUt.contentSize.height, this._textMinH);
        tmpUt.setContentSize(this._textFixedW, h);
        this._state.baseContent.set(this._textFixedW, h);
        this._refreshLayout();
        this._clampToEditNodeRange();
    }

    private _refreshLayout() {
        const bg = this.node.getChildByName('bg');
        const close = this.node.getChildByName('close');
        const scaleNode = this.node.getChildByName('scaleNode');
        const rotationNode = this.node.getChildByName('rotationNode');
        const contentNode = this._getContentNode();
        const bgUt = bg?.getComponent(UITransform);
        if (!bgUt || !contentNode) {
            return;
        }

        const dcw = Math.max(this._state.designContent.width, 1);
        const dch = Math.max(this._state.designContent.height, 1);
        const contentW = this._state.baseContent.width * this._state.contentScale;
        const contentH = this._state.baseContent.height * this._state.contentScale;

        let bgW = this._state.designBg.width;
        let bgH = this._state.designBg.height;
        if (this._state.type === 'editImg') {
            // 图片组：保持初始边距，不按比例放大背景，避免 bg 明显大于图片
            const padW = Math.max(0, this._state.designBg.width - this._state.designContent.width);
            const padH = Math.max(0, this._state.designBg.height - this._state.designContent.height);
            bgW = contentW + padW;
            bgH = contentH + padH;
        } else {
            // 文本组：沿用比例方案，保证文字增长时背景联动
            const sW = contentW / dcw;
            const sH = contentH / dch;
            bgW = this._state.designBg.width * sW;
            bgH = this._state.designBg.height * sH;
        }

        bgUt.setContentSize(bgW, bgH);
        contentNode.setScale(this._state.contentScale, this._state.contentScale, 1);

        const sW = bgW / Math.max(this._state.designBg.width, 1);
        const sH = bgH / Math.max(this._state.designBg.height, 1);

        if (close) {
            close.setPosition(this._state.closePos.x * sW, this._state.closePos.y * sH, 0);
        }
        if (scaleNode) {
            scaleNode.setPosition(this._state.scalePos.x * sW, this._state.scalePos.y * sH, 0);
        }
        if (rotationNode) {
            rotationNode.setPosition(this._state.rotationPos.x * sW, this._state.rotationPos.y * sH, 0);
        }
    }

    private _ensureBound() {
        if (this._bound) {
            return;
        }
        const content = this._getContentNode();

        const onTapStart = (e: EventTouch) => {
            e.getUILocation(this._state.tapStartUi);
        };
        const onTapEnd = (e: EventTouch) => {
            const ui = new Vec2();
            e.getUILocation(ui);
            if (Vec2.distance(ui, this._state.tapStartUi) <= this._tapThreshold) {
                if (!this._state.controlsVisible) {
                    
                    EventSystem.send("OnHideFollowEditleGroupBg")
                    this._setControlsVisible(true);
                }
            }
        };

        const onDragStart = (e: EventTouch) => {
            if (this._isControlNode(e.target as Node)) {
                return;
            }
            this._state.dragging = true;
            e.getUILocation(this._state.dragLast);
        };
        const onDragMove = (e: EventTouch) => {
            if (!this._state.dragging) {
                return;
            }
            const ui = new Vec2();
            e.getUILocation(ui);
            const dx = ui.x - this._state.dragLast.x;
            const dy = ui.y - this._state.dragLast.y;
            this._state.dragLast.set(ui);
            const p = this.node.position;
            this.node.setPosition(p.x + dx, p.y + dy, p.z);
            this._clampToEditNodeRange();
        };
        const onDragEnd = () => {
            this._state.dragging = false;
        };

        // 只在“本体”上拖拽/点击（bg 可能被隐藏）
        content?.on(Node.EventType.TOUCH_START, onTapStart, this);
        content?.on(Node.EventType.TOUCH_START, onDragStart, this);
        content?.on(Node.EventType.TOUCH_MOVE, onDragMove, this);
        content?.on(Node.EventType.TOUCH_END, onTapEnd, this);
        content?.on(Node.EventType.TOUCH_END, onDragEnd, this);
        content?.on(Node.EventType.TOUCH_CANCEL, onDragEnd, this);

        // 文本区域支持“滑动才拖拽”，避免影响输入
        const tmp = this.node.getChildByName('tmpEditBox');
        let onTmpStart: ((e: EventTouch) => void) | null = null;
        let onTmpMove: ((e: EventTouch) => void) | null = null;
        let onTmpEnd: (() => void) | null = null;
        if (tmp) {
            const threshold = 12;
            onTmpStart = (e: EventTouch) => {
                onTapStart(e);
                this._state.tmpDragPending = true;
                e.getUILocation(this._state.tmpDragStart);
            };
            onTmpMove = (e: EventTouch) => {
                const ui = new Vec2();
                e.getUILocation(ui);
                if (this._state.tmpDragPending && Vec2.distance(ui, this._state.tmpDragStart) > threshold) {
                    this._state.tmpDragPending = false;
                    this._state.dragging = true;
                    this._state.dragLast.set(ui);
                }
                if (this._state.dragging) {
                    const dx = ui.x - this._state.dragLast.x;
                    const dy = ui.y - this._state.dragLast.y;
                    this._state.dragLast.set(ui);
                    const p = this.node.position;
                    this.node.setPosition(p.x + dx, p.y + dy, p.z);
                    this._clampToEditNodeRange();
                }
            };
            onTmpEnd = () => {
                this._state.tmpDragPending = false;
                this._state.dragging = false;
            };
            tmp.on(Node.EventType.TOUCH_START, onTmpStart, this);
            tmp.on(Node.EventType.TOUCH_MOVE, onTmpMove, this);
            tmp.on(Node.EventType.TOUCH_END, onTapEnd, this);
            tmp.on(Node.EventType.TOUCH_END, onTmpEnd, this);
            tmp.on(Node.EventType.TOUCH_CANCEL, onTmpEnd, this);
        }

        const scaleNode = this.node.getChildByName('scaleNode');
        scaleNode?.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            e.propagationStopped = true;
            this._state.scaling = true;
            this._state.scaleLastDist = this._touchDistToCenter(e);
        }, this);
        scaleNode?.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (!this._state.scaling) {
                return;
            }
            e.propagationStopped = true;
            const d = this._touchDistToCenter(e);
            if (d <= 0 || this._state.scaleLastDist <= 0) {
                return;
            }
            const ratio = d / this._state.scaleLastDist;
            this._state.contentScale = Math.max(this._scaleMin, Math.min(this._scaleMax, this._state.contentScale * ratio));
            this._state.scaleLastDist = d;
            this._refreshLayout();
            this._clampToEditNodeRange();
        }, this);
        scaleNode?.on(Node.EventType.TOUCH_END, () => {
            this._state.scaling = false;
        }, this);
        scaleNode?.on(Node.EventType.TOUCH_CANCEL, () => {
            this._state.scaling = false;
        }, this);

        const rotationNode = this.node.getChildByName('rotationNode');
        rotationNode?.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            e.propagationStopped = true;
            this._state.rotating = true;
            this._state.rotLastRad = this._touchRadToCenter(e);
        }, this);
        rotationNode?.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (!this._state.rotating) {
                return;
            }
            e.propagationStopped = true;
            const cur = this._touchRadToCenter(e);
            let da = cur - this._state.rotLastRad;
            if (da > Math.PI) da -= Math.PI * 2;
            if (da < -Math.PI) da += Math.PI * 2;
            this.node.angle += (da * 180) / Math.PI;
            this._state.rotLastRad = cur;
            this._clampToEditNodeRange();
        }, this);
        rotationNode?.on(Node.EventType.TOUCH_END, () => {
            this._state.rotating = false;
        }, this);
        rotationNode?.on(Node.EventType.TOUCH_CANCEL, () => {
            this._state.rotating = false;
        }, this);

        (this.node as any).__editableHandlers = { onTapStart, onTapEnd, onDragStart, onDragMove, onDragEnd, onTmpStart, onTmpMove, onTmpEnd };
        this._bound = true;
    }

    private _unbind() {
        const bg = this.node.getChildByName('bg');
        const content = this._getContentNode();
        const tmp = this.node.getChildByName('tmpEditBox');
        const scaleNode = this.node.getChildByName('scaleNode');
        const rotationNode = this.node.getChildByName('rotationNode');
        const pack = (this.node as any).__editableHandlers;
        if (pack) {
            content?.off(Node.EventType.TOUCH_START, pack.onTapStart, this);
            content?.off(Node.EventType.TOUCH_START, pack.onDragStart, this);
            content?.off(Node.EventType.TOUCH_MOVE, pack.onDragMove, this);
            content?.off(Node.EventType.TOUCH_END, pack.onTapEnd, this);
            content?.off(Node.EventType.TOUCH_END, pack.onDragEnd, this);
            content?.off(Node.EventType.TOUCH_CANCEL, pack.onDragEnd, this);
            if (pack.onTmpStart) {
                tmp?.off(Node.EventType.TOUCH_START, pack.onTmpStart, this);
                tmp?.off(Node.EventType.TOUCH_MOVE, pack.onTmpMove, this);
                tmp?.off(Node.EventType.TOUCH_END, pack.onTapEnd, this);
                tmp?.off(Node.EventType.TOUCH_END, pack.onTmpEnd, this);
                tmp?.off(Node.EventType.TOUCH_CANCEL, pack.onTmpEnd, this);
            }
            delete (this.node as any).__editableHandlers;
        }
        scaleNode?.targetOff(this);
        rotationNode?.targetOff(this);
        const eb = tmp?.getComponent(EditBox);
        eb?.node.off(EditBox.EventType.TEXT_CHANGED, this._onTextChanged, this);
    }

    private _isControlNode(target: Node | null): boolean {
        let n: Node | null = target;
        while (n && n !== this.node) {
            if (n.name === 'scaleNode' || n.name === 'rotationNode' || n.name === 'close') {
                return true;
            }
            n = n.parent;
        }
        return false;
    }

    private _uiToParentLocal(ui: Vec2): Vec3 {
        const p = this.node.parent;
        const pUt = p?.getComponent(UITransform);
        if (!pUt) {
            return v3();
        }
        const out = new Vec3();
        pUt.convertToNodeSpaceAR(v3(ui.x, ui.y, 0), out);
        return out;
    }

    private _touchDistToCenter(e: EventTouch): number {
        const ui = new Vec2();
        e.getUILocation(ui);
        const lp = this._uiToParentLocal(ui);
        const c = this.node.position;
        const dx = lp.x - c.x;
        const dy = lp.y - c.y;
        return Math.sqrt(dx * dx + dy * dy) || 1;
    }

    private _touchRadToCenter(e: EventTouch): number {
        const ui = new Vec2();
        e.getUILocation(ui);
        const lp = this._uiToParentLocal(ui);
        const c = this.node.position;
        return Math.atan2(lp.y - c.y, lp.x - c.x);
    }

    private _clampToEditNodeRange() {
        const parent = this.node.parent;
        const parentUt = parent?.getComponent(UITransform);
        const bgUt = this.node.getChildByName('bg')?.getComponent(UITransform);
        const limit = this._getLimitNode();
        const limitUt = limit?.getComponent(UITransform);
        if (!parent || !parentUt || !bgUt || !limit || !limitUt) {
            return;
        }

        const lsize = limitUt.contentSize;
        const halfLW = lsize.width * 0.5;
        const halfLH = lsize.height * 0.5;

        const worldLB = limitUt.convertToWorldSpaceAR(v3(-halfLW, -halfLH, 0));
        const worldRT = limitUt.convertToWorldSpaceAR(v3(halfLW, halfLH, 0));
        const localLB = parentUt.convertToNodeSpaceAR(worldLB);
        const localRT = parentUt.convertToNodeSpaceAR(worldRT);
        const minX = Math.min(localLB.x, localRT.x);
        const maxX = Math.max(localLB.x, localRT.x);
        const minY = Math.min(localLB.y, localRT.y);
        const maxY = Math.max(localLB.y, localRT.y);

        const bsize = bgUt.contentSize;
        const halfBW = bsize.width * 0.5;
        const halfBH = bsize.height * 0.5;
        const rad = (this.node.angle * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        const extX = Math.abs(c) * halfBW + Math.abs(s) * halfBH;
        const extY = Math.abs(s) * halfBW + Math.abs(c) * halfBH;

        let x = this.node.position.x;
        let y = this.node.position.y;
        const lowX = minX + extX;
        const highX = maxX - extX;
        const lowY = minY + extY;
        const highY = maxY - extY;

        if (lowX > highX) {
            x = (minX + maxX) * 0.5;
        } else {
            x = Math.max(lowX, Math.min(highX, x));
        }
        if (lowY > highY) {
            y = (minY + maxY) * 0.5;
        } else {
            y = Math.max(lowY, Math.min(highY, y));
        }
        this.node.setPosition(x, y, this.node.position.z);
    }

    private _getLimitNode(): Node | null {
        if (this.dragLimitNode && this.dragLimitNode.isValid) {
            this._limitNode = this.dragLimitNode;
            return this._limitNode;
        }
        if (this._limitNode && this._limitNode.isValid) {
            return this._limitNode;
        }
        let cur: Node | null = this.node.parent;
        while (cur) {
            const direct = cur.getChildByName('editNode');
            if (direct) {
                this._limitNode = direct;
                return this._limitNode;
            }
            cur = cur.parent;
        }
        return null;
    }

    public onClickClose(){
        // this._setControlsVisible(false)
        this.node.destroy()
    }
}

