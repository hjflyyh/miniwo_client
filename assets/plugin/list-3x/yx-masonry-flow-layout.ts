import { _decorator, math, UITransform } from 'cc';
import { YXBinaryLayout, YXCollectionView, YXEdgeInsets, YXIndexPath, YXLayoutAttributes } from './yx-collection-view';
// import { YXBinaryLayout, YXCollectionView, YXEdgeInsets, YXIndexPath, YXLayoutAttributes } from '../lib/yx-collection-view';

/**
 * 瀑布流布局方案
 */
export class YXMasonryFlowLayout extends YXBinaryLayout {
    public topLay = 0
    /**
     * 分几行(水平滚动模式下)或者几列(垂直滚动模式下)展示
     */
    divide: number | ((section: number, layout: YXMasonryFlowLayout, collectionView: YXCollectionView) => number) = 1

    /**
     * 水平滚动模式下，仅宽度生效
     * 垂直滚动模式下，仅高度生效
     */
    itemSize: math.Size | ((indexPath: YXIndexPath, layout: YXMasonryFlowLayout, collectionView: YXCollectionView) => math.Size) = new math.Size(100, 100);
    getItemSize(): math.Size {
        if (this.itemSize instanceof Function == false) {
            return this.itemSize
        }
        throw new Error("YXMasonryFlowLayout: 动态配置的布局参数不支持直接获取，请检查自己的布局逻辑并谨慎的通过动态配置自己获取，注意避免死循环");
    }

    /**
     * 元素之间垂直间距
     */
    verticalSpacing: number | ((section: number, layout: YXMasonryFlowLayout, collectionView: YXCollectionView) => number) = 0
    getVerticalSpacing(): number {
        if (this.verticalSpacing instanceof Function == false) {
            return this.verticalSpacing
        }
        throw new Error("YXMasonryFlowLayout: 动态配置的布局参数不支持直接获取，请检查自己的布局逻辑并谨慎的通过动态配置自己获取，注意避免死循环");
    }

    /**
     * 元素之间水平间距
     */
    horizontalSpacing: number | ((section: number, layout: YXMasonryFlowLayout, collectionView: YXCollectionView) => number) = 0
    getHorizontalSpacing(): number {
        if (this.horizontalSpacing instanceof Function == false) {
            return this.horizontalSpacing
        }
        throw new Error("YXMasonryFlowLayout: 动态配置的布局参数不支持直接获取，请检查自己的布局逻辑并谨慎的通过动态配置自己获取，注意避免死循环");
    }

    /**
     * 边距
     */
    sectionInset: YXEdgeInsets | ((section: number, layout: YXMasonryFlowLayout, collectionView: YXCollectionView) => YXEdgeInsets) = YXEdgeInsets.ZERO
    getSectionInset(): YXEdgeInsets {
        if (this.sectionInset instanceof Function == false) {
            return this.sectionInset
        }
        throw new Error("YXMasonryFlowLayout: 动态配置的布局参数不支持直接获取，请检查自己的布局逻辑并谨慎的通过动态配置自己获取，注意避免死循环");
    }

    prepare(collectionView: YXCollectionView): void {
        if (collectionView.scrollDirection == YXCollectionView.ScrollDirection.HORIZONTAL) {
            this._masonry_horizontal(collectionView)
            return
        }
        if (collectionView.scrollDirection == YXCollectionView.ScrollDirection.VERTICAL) {
            this._masonry_vertical(collectionView)
            return
        }
    }

    private _masonry_horizontal(collectionView: YXCollectionView) {
        collectionView.scrollView.horizontal = true
        collectionView.scrollView.vertical = false
        let contentSize = collectionView.node.getComponent(UITransform).contentSize.clone()
        let allAttributes: YXLayoutAttributes[] = []

        let numberOfSections = collectionView.getNumberOfSections()

        let sectionMaxX = 0
        for (let section = 0; section < numberOfSections; section++) {
            let numberOfItems = collectionView.getNumberOfItems(section)
            let verticalSpacing = this.verticalSpacing instanceof Function ? this.verticalSpacing(section, this, collectionView) : this.verticalSpacing
            let horizontalSpacing = this.horizontalSpacing instanceof Function ? this.horizontalSpacing(section, this, collectionView) : this.horizontalSpacing
            let sectionInset = this.sectionInset instanceof Function ? this.sectionInset(section, this, collectionView) : this.sectionInset
            let divide = this.divide instanceof Function ? this.divide(section, this, collectionView) : this.divide
            let itemHeight = (contentSize.height - sectionInset.top - sectionInset.bottom - (divide - 1) * verticalSpacing) / divide

            sectionMaxX += sectionInset.left
            // 初始化区布局信息，key=行，value=目前此行最右边的位置
            let sectionInfos = {}
            for (let divideIdx = 0; divideIdx < divide; divideIdx++) {
                sectionInfos[`${divideIdx}`] = sectionMaxX
            }

            for (let item = 0; item < numberOfItems; item++) {
                let indexPath = new YXIndexPath(section, item)
                let itemSize = this.itemSize instanceof Function ? this.itemSize(indexPath, this, collectionView) : this.itemSize
                itemSize.height = itemHeight

                // 查找目前最短的行，在最短的行后面插入节点
                let x = null
                let y = null
                let idx = null
                for (let divideIdx = 0; divideIdx < divide; divideIdx++) {
                    let max = sectionInfos[`${divideIdx}`]
                    if (x == null || max < x) {
                        idx = divideIdx
                        x = max
                        y = sectionInset.top + (itemHeight + verticalSpacing) * divideIdx
                    }
                }

                let attributes = YXLayoutAttributes.layoutAttributesForCell(indexPath)
                attributes.frame.set(x + horizontalSpacing, y, itemSize.width, itemSize.height)
                allAttributes.push(attributes)

                sectionInfos[`${idx}`] = attributes.frame.xMax
                sectionMaxX = Math.max(sectionMaxX, attributes.frame.xMax)
            }
            sectionMaxX += sectionInset.right
        }

        this.attributes = allAttributes
        contentSize.width = Math.max(contentSize.width, sectionMaxX)
        this.contentSize = contentSize
    }

    private _masonry_vertical(collectionView: YXCollectionView) {
        collectionView.scrollView.horizontal = false
        collectionView.scrollView.vertical = true
        let contentSize = collectionView.node.getComponent(UITransform).contentSize.clone()
        let allAttributes: YXLayoutAttributes[] = []

        let numberOfSections = collectionView.getNumberOfSections()

        let sectionMaxY = 0
        for (let section = 0; section < numberOfSections; section++) {
            let numberOfItems = collectionView.getNumberOfItems(section)
            let verticalSpacing = this.verticalSpacing instanceof Function ? this.verticalSpacing(section, this, collectionView) : this.verticalSpacing
            let horizontalSpacing = this.horizontalSpacing instanceof Function ? this.horizontalSpacing(section, this, collectionView) : this.horizontalSpacing
            let sectionInset = this.sectionInset instanceof Function ? this.sectionInset(section, this, collectionView) : this.sectionInset
            let divide = this.divide instanceof Function ? this.divide(section, this, collectionView) : this.divide
            let itemWidth = (contentSize.width - sectionInset.left - sectionInset.right - (divide - 1) * horizontalSpacing) / divide

            sectionMaxY += sectionInset.top + this.topLay
            // 初始化区布局信息，key=列，value=目前此列最底部的位置
            let sectionInfos = {}
            for (let divideIdx = 0; divideIdx < divide; divideIdx++) {
                sectionInfos[`${divideIdx}`] = sectionMaxY
            }

            for (let item = 0; item < numberOfItems; item++) {
                let indexPath = new YXIndexPath(section, item)
                let itemSize = this.itemSize instanceof Function ? this.itemSize(indexPath, this, collectionView) : this.itemSize
                itemSize.width = itemWidth

                // 查找目前最短的列，在最短的列下面插入节点
                let x = null
                let y = null
                let idx = null
                for (let divideIdx = 0; divideIdx < divide; divideIdx++) {
                    let max = sectionInfos[`${divideIdx}`]
                    if (y == null || max < y) {
                        idx = divideIdx
                        y = max
                        x = sectionInset.left + (itemWidth + horizontalSpacing) * divideIdx
                    }
                }

                let attributes = YXLayoutAttributes.layoutAttributesForCell(indexPath)
                attributes.frame.set(x, y + verticalSpacing, itemSize.width, itemSize.height)
                allAttributes.push(attributes)

                sectionInfos[`${idx}`] = attributes.frame.yMax
                sectionMaxY = Math.max(sectionMaxY, attributes.frame.yMax)
            }
            sectionMaxY += sectionInset.bottom
        }

        this.attributes = allAttributes
        contentSize.height = Math.max(contentSize.height, sectionMaxY)
        this.contentSize = contentSize
    }

    initOffset(collectionView: YXCollectionView): void {
        if (collectionView.scrollDirection == YXCollectionView.ScrollDirection.HORIZONTAL) {
            collectionView.scrollView.scrollToLeft(0)
            return
        }
        if (collectionView.scrollDirection == YXCollectionView.ScrollDirection.VERTICAL) {
            collectionView.scrollView.scrollToTop(0)
            return
        }
    }
}
