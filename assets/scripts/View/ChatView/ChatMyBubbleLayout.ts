import { Label, Layout, Node, UITransform } from 'cc';

/** 与 my/Sprite/Label 一致 */
export const MY_BUBBLE_FONT_SIZE = 26;
export const MY_BUBBLE_LINE_HEIGHT = 30;
/** 单行最大文字宽，超出则换行 */
export const MY_BUBBLE_MAX_TEXT_WIDTH = 374;
export const MY_BUBBLE_PAD_LEFT = 16;
export const MY_BUBBLE_PAD_RIGHT = 8;
export const MY_BUBBLE_PAD_TOP = 17;
export const MY_BUBBLE_PAD_BOTTOM = 6;
/** 底图相对文字区左右/上下各额外外扩像素 */
export const MY_BUBBLE_EDGE_EXTRA = 5;
export const MY_BUBBLE_MIN_WIDTH = 80;
/** 气泡右缘与头像左缘间距 */
export const MY_BUBBLE_AVATAR_GAP = 12;
/** GetCellSize 里除气泡外的预留高度（头像区等） */
export const MY_BUBBLE_ROW_EXTRA = 90;

export interface MyBubbleMeasure {
    textWidth: number;
    textHeight: number;
    bubbleWidth: number;
    bubbleHeight: number;
}

type LabelSnapshot = {
    string: string;
    overflow: number;
    enableWrapText: boolean;
    width: number;
    height: number;
    fontSize: number;
    lineHeight: number;
};

function snapshotLabel(label: Label, labelUt: UITransform): LabelSnapshot {
    return {
        string: label.string,
        overflow: label.overflow,
        enableWrapText: label.enableWrapText,
        width: labelUt.width,
        height: labelUt.height,
        fontSize: label.fontSize,
        lineHeight: label.lineHeight,
    };
}

function restoreLabel(label: Label, labelUt: UITransform, snap: LabelSnapshot): void {
    label.string = snap.string;
    label.overflow = snap.overflow;
    label.enableWrapText = snap.enableWrapText;
    label.fontSize = snap.fontSize;
    label.lineHeight = snap.lineHeight;
    labelUt.setContentSize(snap.width, snap.height);
    label.updateRenderData(true);
}

function measureTextSize(label: Label, labelUt: UITransform, text: string): { textW: number; textH: number } {
    label.fontSize = MY_BUBBLE_FONT_SIZE;
    label.lineHeight = MY_BUBBLE_LINE_HEIGHT;
    label.string = text || ' ';

    label.enableWrapText = false;
    label.overflow = Label.Overflow.NONE;
    label.updateRenderData(true);

    let textW = Math.ceil(labelUt.contentSize.width);
    let textH = Math.ceil(labelUt.contentSize.height);

    if (textW > MY_BUBBLE_MAX_TEXT_WIDTH) {
        label.enableWrapText = true;
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        labelUt.width = MY_BUBBLE_MAX_TEXT_WIDTH;
        label.updateRenderData(true);
        textW = MY_BUBBLE_MAX_TEXT_WIDTH;
        textH = Math.ceil(labelUt.contentSize.height);
    }

    return { textW, textH };
}

function toBubbleSize(textW: number, textH: number): { bubbleWidth: number; bubbleHeight: number } {
    const edge = MY_BUBBLE_EDGE_EXTRA;
    return {
        bubbleWidth: Math.max(
            MY_BUBBLE_MIN_WIDTH,
            textW + MY_BUBBLE_PAD_LEFT + MY_BUBBLE_PAD_RIGHT + edge * 2,
        ),
        bubbleHeight: textH + MY_BUBBLE_PAD_TOP + MY_BUBBLE_PAD_BOTTOM + edge * 2,
    };
}

/** 气泡右上锚点：贴在头像左侧 */
function resolveMyBubbleAnchor(myNode: Node, bubbleNode: Node): { x: number; y: number } {
    const mask = myNode.getChildByName('Mask');
    if (mask) {
        const maskUt = mask.getComponent(UITransform);
        const maskW = (maskUt?.width ?? 170) * Math.abs(mask.scale.x);
        const avatarLeft = mask.position.x - maskW * 0.5;
        return {
            x: avatarLeft - MY_BUBBLE_AVATAR_GAP,
            y: bubbleNode.position.y,
        };
    }
    return { x: bubbleNode.position.x, y: bubbleNode.position.y };
}

/** 测量自己气泡内容尺寸 */
export function measureMyBubbleText(label: Label, text: string): MyBubbleMeasure {
    const labelUt = label.node.getComponent(UITransform);
    if (!labelUt) {
        return { textWidth: 0, textHeight: 0, bubbleWidth: MY_BUBBLE_MIN_WIDTH, bubbleHeight: 0 };
    }

    const snap = snapshotLabel(label, labelUt);
    const { textW, textH } = measureTextSize(label, labelUt, text);
    const { bubbleWidth, bubbleHeight } = toBubbleSize(textW, textH);
    restoreLabel(label, labelUt, snap);
    return { textWidth: textW, textHeight: textH, bubbleWidth, bubbleHeight };
}

/**
 * 应用到自己消息气泡：手动布局，不依赖 Layout（避免与 prefab 旧坐标冲突）。
 * 气泡锚点 (1,1) 右缘对齐头像左侧；Label 锚点 (0,1) 在气泡内 padding 处。
 */
export function applyMyBubbleLayout(
    myNode: Node,
    bubbleNode: Node,
    label: Label,
    text: string,
): MyBubbleMeasure {
    const bubbleUt = bubbleNode.getComponent(UITransform);
    const labelUt = label.node.getComponent(UITransform);
    if (!bubbleUt || !labelUt) {
        return { textWidth: 0, textHeight: 0, bubbleWidth: MY_BUBBLE_MIN_WIDTH, bubbleHeight: 0 };
    }

    const layout = bubbleNode.getComponent(Layout);
    if (layout) {
        layout.enabled = false;
    }

    const { textW, textH } = measureTextSize(label, labelUt, text);
    labelUt.width = textW;
    label.updateRenderData(true);

    const { bubbleWidth, bubbleHeight } = toBubbleSize(textW, textH);
    const anchorPos = resolveMyBubbleAnchor(myNode, bubbleNode);

    bubbleUt.setAnchorPoint(1, 1);
    bubbleUt.setContentSize(bubbleWidth, bubbleHeight);
    bubbleNode.setPosition(anchorPos.x, anchorPos.y + MY_BUBBLE_EDGE_EXTRA, bubbleNode.position.z);

    labelUt.setAnchorPoint(0, 1);
    label.node.setPosition(
        -bubbleWidth + MY_BUBBLE_PAD_LEFT + MY_BUBBLE_EDGE_EXTRA,
        -(MY_BUBBLE_PAD_TOP + MY_BUBBLE_EDGE_EXTRA),
        0,
    );

    return { textWidth: textW, textHeight: textH, bubbleWidth, bubbleHeight };
}
