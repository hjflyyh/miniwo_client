import { Node } from 'cc';
/**
 * 目前只支持单行单列模式。
 * 
 */
import { _decorator, Component, Enum, instantiate, js, NodePool, Prefab, ScrollView, Size, UITransform, Vec2, Vec3, Widget } from "cc";
import { DEBUG, EDITOR } from "cc/env";
const { ccclass, property } = _decorator;
const ScrollModel = Enum({ Horizontal: 0, Vertical: 1 });
const ScrollType = Enum({ Single: 0, Multiple: 1 });

interface viewCell {
    getSize(index: number, data?: any): number;
}

interface tvCell extends Node {
    // 当前实际的下标
    tvIndex: number;
    // 将要转变的下标(用于增删操作)
    _tvIndex: number;
}

@ccclass("tableView")
export default class tableView extends ScrollView {
    // 重写
    @property({ visible: false, override: true })
    horizontal = false;
    @property({ visible: false, override: true })
    vertical = true;
    @property({ type: Component.EventHandler, visible: false, override: true })
    scrollEvents = [];

    // 新增
    @property(Prefab)
    _cell!: Prefab;
    @property({ type: Prefab, tooltip: '渲染节点' })
    get cell() { return this._cell; }
    set cell(value) {
        if (!EDITOR) {
            this.clear();
            this.cellPool.clear();
        }
        this._cell = value;
    }

    @property({ type: ScrollModel, tooltip: '滑动方向' })
    get scrollModel() { return this.horizontal ? ScrollModel.Horizontal : ScrollModel.Vertical; }
    set scrollModel(value) {
        if (!EDITOR) {
            console.error('[tableView] 不允许动态修改scrollModel');
            return;
        }
        if (value === ScrollModel.Horizontal) {
            this.horizontal = true;
            this.vertical = false;
        } else {
            this.horizontal = false;
            this.vertical = true;
        }
    }

    // @property({ type: ScrollType, tooltip: 'Single: 单行/单列\nMultiple: 多行/多列' })
    // scrollType: number = ScrollType.Single;

    // @property({ visible: function () { return this.scrollType == ScrollType.Multiple }, tooltip: 'Horizontal: 有几行\Vertical: 有几列' })
    // mulCount: number = 0;

    private cellPool: NodePool = new NodePool('viewCell');
    private cellData = null;
    private cellCount = 0;
    private childCount = 0;
    private viewCount = 0;

    private startIndex = 0;
    private maxStartIndex = 0;
    private endIndex = 0;

    private anchorCenterX = 0;
    private anchorCenterY = 0;
    private anchorLeftX = 0;
    private anchorTopY = 0;
    private cellAnchorX = 0;
    private cellAnchorY = 0;

    private customSize = false;
    private cellAccumSizes: number[] = [];
    private cellSizes: number[] = [];
    private cellSize: number = 0;

    private updateRefreshOnce = false;
    private updateRefreshForce = false;
    private updateCellsOn = false;
    private updateCellsOnce = false;

    onDestroy() {
        while (this.cellPool.size()) {
            this.cellPool.get()?.destroy();
        }
        if (super.onDestroy) {
            super.onDestroy();
        }
    }

    onEnable() {
        this.node.on('scroll-began', this.onScrollBegin, this);
        this.node.on('scroll-ended', this.onScrollEnd, this);

        super.onEnable();
    }

    onDisable() {
        this.node.off('scroll-began', this.onScrollBegin, this);
        this.node.off('scroll-ended', this.onScrollEnd, this);

        super.onDisable();
    }

    private onScrollBegin() {
        this.updateCellsOn = true;
    }

    private onScrollEnd() {
        this.updateCellsOn = false;
        this.updateCellsOnce = true;
    }

    getCellCount() {
        return this.cellCount;
    }

    setCellCount(num: number) {
        if (typeof num === 'number' && num >= 0) {
            this.cellCount = num;
        } else {
            console.error('[tableView] setCellCount 参数错误');
        }
    }

    getCellData() {
        return this.cellData;
    }

    setCellData(data: any) {
        if (typeof data !== 'undefined') {
            this.cellData = data;
        }
    }

    getCellRange() {
        const children: tvCell[] = <tvCell[]><unknown>this.content?.children;
        if (children.length == 0) {
            return { min: -1, max: -1 };
        }
        return { min: children[0].tvIndex, max: children[children.length - 1].tvIndex };
    }

    /**
     * [实时操作] 如果动态修改scrollBar的大小了，则需要调用此方法更新
     */
    refreshScrollBar() {
        // @ts-ignore
        this._updateScrollBar(this._getHowMuchOutOfBoundary());
    }

    /**
     * [延时操作] 刷新
     * 1、cell大小改变需要刷新cell位置时调用
     * 2、content大小、锚点发生改变后，需要刷新cell位置时调用
     * 3、cellCount改变，需要刷新cell时调用
     * 
     * 调用refresh并不代表会执行cell的init或uninit方法
     * 只有当cell的index因插入、删除、滚屏、初始化等原因需要发生变化时，才会触发init或uninit方法
     */
    refresh(force = true) {
        this.updateRefreshOnce = true;
        if (force) {
            this.updateRefreshForce = true;
        }
    }

    /**
     * [实时操作] 刷新
     */
    refreshSync(force = true) {
        this.stopRefresh();
        this.initData();
        this.updateCells(force);
    }

    /**
     * 停止refresh
     */
    private stopRefresh() {
        this.updateRefreshOnce = false;
        this.updateRefreshForce = false;
    }

    /**
     * [实时操作] 初始化
     */
    init(num: number, data?: any) {
        if (DEBUG) {
            if (!this.content) {
                return console.error('[tableView] 请指定content');
            }
            if (!this.cell) {
                return console.error('[tableView] 请指定cell');
            }
            if (!this.getViewCell()) {
                return console.error('[tableView] 请在cell中添加继承自<viewCell>的自定义组件');
            }
        }
        this.clear();

        this.setCellData(data || null);
        this.setCellCount(num);

        this.initData();

        this.stopAutoScroll();
        this.scrollToOrigin();

        this.updateCells(true);
    }

    /**
     * [实时操作] 清空
     */
    clear() {
        this.cellCount = 0;
        this.childCount = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        this.maxStartIndex = 0;
        // this.content[this.horizontal ? 'width' : 'height'] = 0;
        let uitComp = this.content?.getComponent(UITransform) as UITransform;
        uitComp.contentSize = new Size( uitComp.width, 0 );
        if ( this.horizontal ) uitComp.contentSize = new Size( 0, uitComp.height );

        this.stopRefresh();
        this.updateCellCount();
    }

    /**
     * [实时操作] 重载
     */
    reload(start = 0, num?: number) {
        if (typeof num === 'undefined') {
            let childs = this.content?.children as tvCell[];
            for ( let i=0; i<childs.length; ++i ) {
                if (childs[i].tvIndex >= start) {
                    this.reloadCell(childs[i]);
                }
            }
            // this.content?.children.forEach((cell: tvCell, idx: number, n: Node[]) => {
            //     if (cell.tvIndex >= start) {
            //         this.reloadCell(cell);
            //     }
            // })
        } else {
            if (num <= 0) return;

            if (start < 0) start = start + this.cellCount;

            if (start + num < 0) return;

            let childs = this.content?.children as tvCell[];
            for ( let i=0; i<childs.length; ++i ) {
                if (childs[i].tvIndex >= start && childs[i].tvIndex < start + num) {
                        this.reloadCell(childs[i]);
                }
            }

            // this.content?.children.forEach((cell: tvCell) => {
            //     if (cell.tvIndex >= start && cell.tvIndex < start + num) {
            //         this.reloadCell(cell);
            //     }
            // })
        }
    }

    /**
     * [延时操作] 插入
     */
    insert(start = -1, num = 1, data?: any) {
        if (num <= 0) return;

        if (start < 0) start = start + this.cellCount + 1;
        if (start < 0) start = 0;

        this.setCellData(data);

        const children = this.content?.children as Node[];
        for (let index = children.length - 1; index >= 0; index--) {
            const node: tvCell = <tvCell>children[index];
            if (node._tvIndex >= start) {
                node._tvIndex += num;
            }
        }

        this.setCellCount(this.cellCount + num);
        this.refresh();
    }

    /**
     * [延时操作] 删除
     */
    remove(start = -1, num = 1, data?: any) {
        if (num <= 0) return;

        if (start < 0) start = start + this.cellCount;
        let end = start + num;

        if (start < 0) {
            start = 0;
        }
        if (end > this.cellCount) {
            end = this.cellCount;
        }

        num = end - start;

        if (start >= this.cellCount || end <= 0 || num < 0 || start >= end) return;

        this.setCellData(data);

        const children = this.content?.children as Node[];
        for (let index = children.length - 1; index >= 0; index--) {
            const node: tvCell = <tvCell>children[index];
            if (node._tvIndex >= start) {
                if (node._tvIndex < end) {
                    node._tvIndex = -1;
                } else {
                    node._tvIndex -= num;
                }
            }
        }

        this.setCellCount(this.cellCount - num);
        this.refresh();
    }

    private getCell(): tvCell {
        let node: tvCell;
        if (this.cellPool.size()) {
            node = <tvCell>this.cellPool.get();
        } else {
            node = <tvCell>instantiate(this.cell);
        }
        node.tvIndex = -1;
        node._tvIndex = -1;
        return node;
    }

    private putCell(node: tvCell) {
        this.cellPool.put(node);
    }

    private initCell(cell: tvCell, index: number) {
        if (index >= 0) {
            if (cell.tvIndex != index || cell.tvIndex != cell._tvIndex) {
                const com: any = cell.getComponent("viewCell");
                if (cell.tvIndex >= 0) com.uninit();
                com.init(index, this.cellData, this);   
            }
            cell.tvIndex = index;
            cell._tvIndex = index;
        }
    }

    private uninitCell(cell: tvCell) {
        if (cell.tvIndex >= 0) {
            const com: any = cell.getComponent("viewCell");
            com.uninit();
            cell.tvIndex = -1;
            cell._tvIndex = -1;
        }
    }

    private reloadCell(cell: tvCell) {
        const com: any = cell.getComponent("viewCell");
        com.reload(this.cellData);
    }

    private getViewCell(): viewCell | null{
        if (this.cell) {
            const com = this.cell.data.getComponent('viewCell');
            if (com) {
                // return <typeof viewCell>cc.js.getClassByName(cc.js.getClassName(com));
                return com.constructor || js.getClassByName(js.getClassName(com));
            }
        }
        return null;
    }

    /**
     * 获取默认cell大小
     */
    private getDefaultCellSize() {
        if (this.cell) {
            if (DEBUG && this.cell.data.getComponent(Widget)) {
                console.warn('[tableView] cell根节点中存在cc.Widget，可能无法正确获取Size');
            }
            let utCmp: UITransform = this.cell.data.getComponent( UITransform );
            return utCmp.contentSize;
            // return this.cell.data.getContentSize();
        }
        return Size.ZERO;
    }

    /**
     * 获取默认cell锚点
     */
    private getDefaultCellAnchor() {
        if (this.cell) {
            let utCmp: UITransform = this.cell.data.getComponent( UITransform );
            return utCmp.anchorPoint;
            // return this.cell.data.getAnchorPoint();
        }
        return Vec2.ZERO;
    }

    getScrollLength() {
        const offset = this.getScrollOffset();
        const scrollLen = this.horizontal ? -offset.x : offset.y;

        if (scrollLen < 0) {
            return 0;
        }

        // 有maxStartIndex作为限制，这里可以不做限制
        // const maxOffset = this.getMaxScrollOffset();
        // const maxScrollLen = this.horizontal ? -maxOffset.x : maxOffset.y;
        // if (scrollLen > maxScrollLen) {
        //     return maxScrollLen;
        // }
        return scrollLen;
    }

    /**
     * 初始化数值
     */
    private initData() {
        const view = this.getViewCell();
        const defaultCellSize = this.getDefaultCellSize();
        let uitComp = this.content?.parent?.getComponent(UITransform) as UITransform;
        let viewLen = uitComp.contentSize.height;
        if ( this.horizontal ) viewLen = uitComp.contentSize.width;

        const prop = this.horizontal ? 'width' : 'height';
        // let viewLen = this.content.parent[prop];

        // 是否自定义大小
        this.customSize = !!view && !!view.hasOwnProperty('getSize');

        // 初始默认数据
        this.cellSize = defaultCellSize[prop];
        this.cellAccumSizes.length = 0;
        this.cellSizes.length = 0;
        this.maxStartIndex = 0;
        this.startIndex = 0;
        this.endIndex = 0;
        this.viewCount = this.cellCount;
        this.childCount = this.cellCount;

        // 填充cell数据
        if (this.customSize) {
            /**
             * [性能问题] 这里有可能会出现性能问题, 原因可能有：
             * 1、view.getSize的复杂度过高
             * 2、数据量极大
             */
            for (let index = 0, accumSize = 0, size = 0; index < this.cellCount; index++) {
                size = view?.getSize(index, this.cellData) as number;
                if (!size || size < 0) size = this.cellSize;
                this.cellSizes.push(size);

                accumSize += size;
                this.cellAccumSizes.push(accumSize);
            }
        }

        // 计算childCount
        if (this.customSize) {
            // 自定义cell大小时，childCount需要实时动态计算，这里计算一下滑到最底部时的childCount(因为后面正好用上)
            const accumIndex = this.cellAccumSizes.length - 1;
            const accumSize = this.cellAccumSizes[accumIndex];
            for (let index = 1, size = 0; index <= accumIndex; index++) {
                size = this.cellAccumSizes[accumIndex - index];

                if (accumSize - size >= viewLen) {
                    this.childCount = index + 1;
                    this.viewCount = index;
                    break;
                }
            }
        } else {
            if (this.cellSize*this.cellCount > viewLen) {
                this.viewCount = Math.ceil(viewLen / this.cellSize);
                this.childCount = this.viewCount + 1;
            }
        }

        // 计算最大的开始下标
        if (this.cellCount > this.viewCount) {
            this.maxStartIndex = this.cellCount - this.viewCount;
        } else {
            this.maxStartIndex = 0;
        }

        // 计算content大小 -- ykl
        // const prop = this.horizontal ? 'width' : 'height';
        let utcmp = this.content?.getComponent( UITransform ) as UITransform;
        let len = 0;
        if (this.customSize) {
            len = this.cellAccumSizes[this.cellAccumSizes.length - 1] || 0;
        } else {
            len = this.cellSize * this.cellCount;
        }
        if ( this.horizontal ) utcmp.contentSize = new Size( len, utcmp.contentSize.height);
        else utcmp.contentSize = new Size( utcmp.contentSize.width, len );

        // 计算基础定位数值
        const cellAnchor = this.getDefaultCellAnchor();
        this.anchorCenterX = (0.5 - utcmp.anchorX) * utcmp.width;
        this.anchorCenterY = (0.5 - utcmp.anchorY) * utcmp.height;
        this.anchorLeftX = (0 - utcmp.anchorX) * utcmp.width;
        this.anchorTopY = (1 - utcmp.anchorY) * utcmp.height;
        this.cellAnchorX = cellAnchor.x;
        this.cellAnchorY = 1 - cellAnchor.y;
    }

    /**
     * 更新cell的数量，不够添加，多了删除
     */
    private updateCellCount() {
        const children: tvCell[] = <tvCell[]>this.content?.children;

        if (children.length == this.childCount) {
            return;
        } else if (children.length > this.childCount) {
            let cell: tvCell;

            // 优先删除即将要废弃的cell
            for (let index = children.length - 1; index >= this.childCount; index--) {
                cell = children[index];

                if (cell._tvIndex < this.startIndex || cell._tvIndex > this.endIndex) {
                    this.uninitCell(cell);
                    this.putCell(cell);
                }
            }

            // 从后往前删除
            for (let index = children.length - 1; index >= this.childCount; index--) {
                cell = children[index];

                this.uninitCell(cell);
                this.putCell(cell);
            }
        } else {
            for (let index = children.length; index < this.childCount; index++) {
                this.content?.addChild(this.getCell())
            }
        }
    }

    /**
     * 根据滑动距离，获得startIndex
     */
    getStartIndex(scrollLen?: number) {
        scrollLen = scrollLen ?? this.getScrollLength();
        let startIndex = 0;
        const maxStartIndex = this.maxStartIndex;

        if (this.customSize) {
            const cellAccumSizes = this.cellAccumSizes;
            if (cellAccumSizes.length < 5) {
                // 普通循环
                for (; startIndex < maxStartIndex; startIndex++) {
                    if (cellAccumSizes[startIndex] > scrollLen) {
                        break;
                    }
                }
            } else {
                // 二分查找
                let min = 0, max = maxStartIndex, value = 0;
                while (max >= min) {
                    startIndex = Math.floor((max + min) / 2);
                    value = cellAccumSizes[startIndex];

                    if (scrollLen == value) {
                        if (startIndex < maxStartIndex) startIndex += 1;
                        break;
                    } else if (scrollLen < value && (startIndex == 0 || scrollLen >= cellAccumSizes[startIndex - 1])) {
                        break;
                    } else if (scrollLen > value) {
                        min = startIndex + 1;
                    } else {
                        max = startIndex - 1;
                    }
                }
            }
        } else {
            startIndex = Math.floor(scrollLen / this.cellSize);
            if (startIndex < 0) { startIndex = 0 }
            else if (startIndex > maxStartIndex) { startIndex = maxStartIndex }
        }

        return startIndex;
    }

    /**
     * 更新开始下标、结束下标、childNum(只有自定义cell大小才会更新)
     */
    private updateCellRange() {
        // 滚动距离
        const scrollLen = this.getScrollLength();

        // 当前滚动距离对应的起始cell下标
        this.startIndex = this.getStartIndex(scrollLen);

        // 自定义cell大小需要更新childCount
        // if (this.customSize) {
        //     // const viewLen = this.content.parent[this.horizontal ? 'width' : 'height'];
        //     let uitComp = this.content?.parent?.getComponent(UITransform) as UITransform;
        //     let viewLen = uitComp.contentSize.height;
        //     if ( this.horizontal ) viewLen = uitComp.contentSize.width;
        //     const cellAccumLen = this.cellAccumSizes.length;

        //     // 这里小数比较大小的做法，会出现0.1+0.2!=0.3的情况么?
        //     if (this.cellAccumSizes[cellAccumLen - 1] - viewLen <= scrollLen) {
        //         this.childCount = cellAccumLen - this.startIndex;
        //     } else {
        //         const startSize = this.cellAccumSizes[this.startIndex];

        //         for (let endIndex = this.startIndex + 1, accumSize = 0; endIndex < cellAccumLen; endIndex++) {
        //             accumSize = this.cellAccumSizes[endIndex];

        //             // 这里小数比较大小的做法，会出现0.1+0.2!=0.3的情况么?
        //             if (accumSize - viewLen >= scrollLen) {
        //                 if (accumSize - startSize >= viewLen) {
        //                     this.childCount = endIndex - this.startIndex + 1;
        //                 } else {
        //                     this.childCount = endIndex - this.startIndex + 2;
        //                 }
        //                 break;
        //             }
        //         }
        //     }
        // }

        // 当前滚动距离对应的终止cell下标
        this.endIndex = this.startIndex + this.viewCount - 1;
    }

    /**
     * 更新cell状态
     */
    private updateCell(cell: tvCell, index?: number) {
        if (typeof index === 'number') {
            this.initCell(cell, index);
        } else {
            this.initCell(cell, cell._tvIndex);
            index = cell.tvIndex;
        }

        let x=0, y=0;
        if (this.horizontal) {
            if (this.customSize) {
                x = this.anchorLeftX - this.cellSizes[index] * this.cellAnchorX + this.cellAccumSizes[index];
            } else {
                x = this.anchorLeftX - this.cellSize * this.cellAnchorX + this.cellSize * (index + 1);
            }
            y = this.anchorCenterY;
        } else {
            if (this.customSize) {
                y = this.anchorTopY + this.cellSizes[index] * this.cellAnchorY - this.cellAccumSizes[index];
            } else {
                y = this.anchorTopY + this.cellSize * this.cellAnchorY - this.cellSize * (index + 1);
            }
            x = this.anchorCenterX;
        }
        cell.position = new Vec3( x,y,0);
    }

    /**
     * 更新cells状态
     * 
     * 根据startIndex和endIndex，将content下的节点分成keepCells和changeCells
     * 1、统一更新keepCells和changeCells里cell的坐标
     * 2、changeCells里的cell会进行init
     */
    private updateCells(force = false) {
        this.updateCellsOnce = false;

        this.updateCellRange();
        this.updateCellCount();

        if (!this.childCount) {
            return;
        }

        const startIndex = this.startIndex;
        const endIndex = this.endIndex;

        const children: tvCell[] = <tvCell[]>this.content?.children;

        // 正常滑动下，只要第一个cell的_tvIndex与startIndex相等最后一个cell的_tvIndex与endIndex相等, 就没必要进行下一步计算
        // 如果是其它情况一定要进行接下来的计算，可以通过force进行控制
        if (!force && children[0]._tvIndex == startIndex && children[children.length - 1]._tvIndex == endIndex) {
            return;
        }

        let keepsIndexs = new Map<number,boolean>();
        const keepCells: tvCell[] = [];
        const changeCells: tvCell[] = [];
        children.forEach((cell) => {
            
            if (cell._tvIndex < startIndex || cell._tvIndex > endIndex || cell._tvIndex != cell.tvIndex) {
                this.uninitCell(cell);
                changeCells.push(cell);
            } else {
                keepsIndexs.set( cell._tvIndex, true );
                keepCells.push(cell);
            }
        });

        // 没有可刷新的
        if (changeCells.length == 0) {
            if (force) children.forEach((cell) => this.updateCell(cell));
        }
        
        // 全部cell都需要刷新
        else if (keepCells.length == 0) {
            children.forEach((cell, index) => this.updateCell(cell, startIndex + index));
        }
        // 只有部分cell需要刷新
        else {
            for (let index = startIndex, keepPoint = 0, changePoint = 0; index <= endIndex; index++) {
                if (keepPoint < keepCells.length && keepsIndexs.get(index) ) {
                    this.updateCell(keepCells[keepPoint]);
                    keepPoint++;
                } else {
                    this.updateCell(changeCells[changePoint], index);
                    changePoint++;
                }
            }
        }

        // 排序
        children.forEach(function (node) {
            node.setSiblingIndex( node.tvIndex - startIndex );
        })
        // this.content.sortAllChildren();
    }

     scrollToIndex(index?: number, timeInSecond?: number, attenuated?: boolean) {
            if (index) {
                let offset = this.getOffsetByIndex(index);
                this.scrollToOffset(offset, timeInSecond, attenuated);
            }
        }
    
    getOffsetByIndex(index:number=0):Vec2 {
        if (index > this.maxStartIndex) index = this.maxStartIndex;
        let len = 0;
        if (this.customSize) {
            len = this.cellAccumSizes[index-1] ?? 0;
        } else {
            len = index*this.cellSize;
        }
        
        let contentLen = this.getContentLen();
        len = Math.min(len, contentLen);
        let offset = new Vec2(0,0);
        if ( this.horizontal ) {
            offset = new Vec2(len, 0);
        } else {
            offset = new Vec2(0, len);
        }
        // console.log("-------------getOffsetByIndex-----", index, offset);
        return offset;
    }

    getContentLen() {
        let uitComp = this.content?.getComponent(UITransform) as UITransform;
        let contentLen = uitComp.contentSize.height;
        if ( this.horizontal ) {
            contentLen = uitComp.contentSize.width;
        }
        return contentLen;
    }

    getCellLen(idx=0) {
        let cellLen = this.cellSize;
        if ( this.customSize ) {
            cellLen = this.cellSizes[idx];
        }
        return cellLen;
    }

    getPerScrollOffset() {
        if (this.horizontal) {
            return new Vec2(this.getScrollOffset().x / this.getMaxScrollOffset().x, 0);
        } else {
            return new Vec2(0, this.getScrollOffset().y / this.getMaxScrollOffset().y);
        }
    }

    scrollToPerOffset(offset: Vec2, timeInSecond?: number, attenuated?: boolean) {
        if (this.horizontal) {
            offset.x *= this.getMaxScrollOffset().x;
        } else {
            offset.y *= this.getMaxScrollOffset().y;
        }
        this.scrollToOffset(offset, timeInSecond, attenuated);
    }

    scrollToOrigin(timeInSecond?: number, attenuated?: boolean) {
        if (this.horizontal) {
            this.scrollToLeft(timeInSecond, attenuated)
        } else {
            this.scrollToTop(timeInSecond, attenuated)
        }
    }

    stopAutoScroll() {
        if (!this.updateCellsOnce && this.updateCellsOn) {
            this.updateCellsOn = false;
            this.updateCellsOnce = true;
        }
        super.stopAutoScroll();
    }

    scrollToBottom(timeInSecond?: number, attenuated?: boolean) {
        if (timeInSecond) {
            this.updateCellsOn = true;
        } else {
            this.updateCellsOnce = true;
        }
        super.scrollToBottom(timeInSecond, attenuated);
    }

    scrollToTop(timeInSecond?: number, attenuated?: boolean) {
        if (timeInSecond) {
            this.updateCellsOn = true;
        } else {
            this.updateCellsOnce = true;
        }
        super.scrollToTop(timeInSecond, attenuated);
    }

    scrollToLeft(timeInSecond?: number, attenuated?: boolean) {
        if (timeInSecond) {
            this.updateCellsOn = true;
        } else {
            this.updateCellsOnce = true;
        }
        super.scrollToLeft(timeInSecond, attenuated);
    }

    scrollToRight(timeInSecond?: number, attenuated?: boolean) {
        if (timeInSecond) {
            this.updateCellsOn = true;
        } else {
            this.updateCellsOnce = true;
        }
        super.scrollToRight(timeInSecond, attenuated);
    }

    scrollToOffset(offset: Vec2, timeInSecond?: number, attenuated?: boolean) {
        if (timeInSecond) {
            this.updateCellsOn = true;
        } else {
            this.updateCellsOnce = true;
        }
        super.scrollToOffset(offset, timeInSecond, attenuated);
    }

    update(dt) {
        super.update(dt);
        if (this.updateRefreshOnce) this.refreshSync(this.updateRefreshForce);
        if (this.updateCellsOn || this.updateCellsOnce) this.updateCells();
    }

    getCells() {
        const children: tvCell[] = <tvCell[]>this.content?.children;
        return children;
    }
}