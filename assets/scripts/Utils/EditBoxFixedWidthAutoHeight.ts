import { _decorator, Component, EditBox, UITransform, Label, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('EditBoxFixedWidthAutoHeight')
export class EditBoxFixedWidthAutoHeight extends Component {
  @property(EditBox)
  editBox: EditBox = null!;

  /** 背景节点（你的 EditBoxBg） */
  @property(Node)
  bgNode: Node = null!;

  /** 内容区固定宽度（与背景可视宽度一致，已含左右内边距时这里填「文字区域宽」） */
  @property
  fixedContentWidth = 400;

  /** 上下各留多少像素（总高度 = 文字高 + paddingTop + paddingBottom） */
  @property
  paddingTop = 12;

  @property
  paddingBottom = 12;

  @property
  minHeight = 48;

  @property
  maxHeight = 800;

  @property(Label)
  showText : Label = null
  
  otherTextStr = ""

  onLoad() {
    this.editBox.node.on(EditBox.EventType.TEXT_CHANGED, this._sync, this);
    // 首次对齐（含占位为空时）
    this._sync();
  }

  onDestroy() {
    // this.editBox.node.off(EditBox.EventType.TEXT_CHANGED, this._sync, this);
  }

  private _sync() {
    const label = this.editBox.textLabel;
    if (!label) return;

    // const labelUt = label.node.getComponent(UITransform)!;

    // // 宽固定 → 多行换行 → 高由引擎排版决定
    // labelUt.width = this.fixedContentWidth;
    // label.overflow = Label.Overflow.RESIZE_HEIGHT;
    // label.updateRenderData(true);

    // const textH = labelUt.contentSize.height;
    // let h = textH + this.paddingTop + this.paddingBottom;
    // h = Math.max(this.minHeight, Math.min(this.maxHeight, h));

    // // 背景：宽用你设计上的「外框宽」，若与内容同宽就一致；这里假设外框宽 = 内容宽 + 左右边可自己在 prefab 里定一个常量
    // const bgUt = this.bgNode.getComponent(UITransform)!;
    // const bgW = bgUt.width; // 保持 prefab 里设的固定宽度；若要和 fixedContentWidth 一致可改成 this.fixedContentWidth
    // bgUt.setContentSize(bgW, h);

    // // EditBox 根节点高度也要改，否则点击区域/裁剪可能不对
    // const rootUt = this.editBox.node.getComponent(UITransform)!;
    // rootUt.setContentSize(rootUt.width, h);

    if(this.showText != null){
        this.showText.string = this.otherTextStr + this.editBox.string
    }
  }
}