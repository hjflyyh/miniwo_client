import { _decorator, log, math, UITransform } from 'cc';
import { YXCollectionView, YXIndexPath, YXLayout, YXLayoutAttributes } from './yx-collection-view';

/**
 * 需求: 垂直多列布局，当最后一排节点排列不满一行的时候居中排列  
 * @deprecated 使用 YXFlowLayout 实现
 */
export class CustomGridFlowLayout extends YXLayout {
    itemSize: math.Size = new math.Size(100, 100)
    verticalSpacing: number = 0
    horizontalSpacing: number = 0
    alignment: number = 1 // 0靠左 1居中 2靠右

    prepare(collectionView: YXCollectionView): void {
        this._vertical(collectionView)
    }

    protected _vertical(collectionView: YXCollectionView) {
        collectionView.scrollView.horizontal = false
        collectionView.scrollView.vertical = true

        let attrs: YXLayoutAttributes[] = []
        let contentSize = collectionView.node.getComponent(UITransform).contentSize.clone()

        // 计算每行最多可以放多少个节点
        const top = 0 // 上边距
        const width = collectionView.node.getComponent(UITransform).width
        let num = 1
        while ((num * this.itemSize.width + (num - 1) * this.horizontalSpacing) <= width) { num++ }
        num = Math.max(1, num - 1)

        // 根据设置的对齐方式计算左边距
        let left = 0
        if (this.alignment == 1) {
            let maxWidth = (num * this.itemSize.width + (num - 1) * this.horizontalSpacing) // 每行节点宽度
            left = (width - maxWidth) * 0.5
        }
        if (this.alignment == 2) {
            let maxWidth = (num * this.itemSize.width + (num - 1) * this.horizontalSpacing) // 每行节点宽度
            left = width - maxWidth
        }

        let rowAttrs: YXLayoutAttributes[][] = [] // 保存每行的节点布局属性

        const total = collectionView.getNumberOfItems(0)
        for (let index = 0; index < total; index++) {

            // 计算这个节点是第几行
            let row = Math.floor(index / num)

            // 计算这个节点是第几列
            let column = index % num

            // 计算节点 origin
            let x = left + (this.itemSize.width + this.horizontalSpacing) * column
            let y = top + (this.itemSize.height + this.verticalSpacing) * row

            let attr = YXLayoutAttributes.layoutAttributesForCell(new YXIndexPath(0, index))
            attr.frame.x = x
            attr.frame.y = y
            attr.frame.width = this.itemSize.width
            attr.frame.height = this.itemSize.height
            attrs.push(attr)

            let tmpArray = rowAttrs[row]
            if (tmpArray == null) {
                tmpArray = []
                rowAttrs[row] = tmpArray
            }
            tmpArray.push(attr)

            contentSize.height = Math.max(contentSize.height, attr.frame.yMax)
        }

        if (rowAttrs.length > 0) {
            // 检查最后一行节点数量，调整对齐逻辑
            const lastRowAttrs = rowAttrs[rowAttrs.length - 1]
            if (lastRowAttrs.length < num) {
                let left = 0
                if (this.alignment == 1) {
                    let maxWidth = (lastRowAttrs.length * this.itemSize.width + (lastRowAttrs.length - 1) * this.horizontalSpacing) // 最后这行节点宽度
                    left = (width - maxWidth) * 0.5
                }
                if (this.alignment == 2) {
                    let maxWidth = (lastRowAttrs.length * this.itemSize.width + (lastRowAttrs.length - 1) * this.horizontalSpacing) // 最后这行节点宽度
                    left = width - maxWidth
                }
                for (let index = 0; index < lastRowAttrs.length; index++) {
                    const element = lastRowAttrs[index];
                    element.frame.x = left + (this.itemSize.width + this.horizontalSpacing) * index
                }
            }
        }

        this.attributes = attrs
        this.contentSize = contentSize

        rowAttrs = []
    }

    initOffset(collectionView: YXCollectionView): void {
        collectionView.scrollView.scrollToTop()
    }
}

