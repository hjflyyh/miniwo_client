import { _decorator, Component, Label, Node } from 'cc';
import InfiniteCell from 'db://assets/plugin/InfiniteList/InfiniteCell';
const { ccclass, property } = _decorator;

@ccclass('MailCell')
export class MailCell extends InfiniteCell {
    @property(Label)
    public title : Label

    @property(Label)
    public content : Label

    @property(Node)
    public isRead : Node

    data
    UpdateContent(data: any): void {
        console.log(data)
        this.data = data
        this.isRead.active = !data.is_read
        this.title.string = data.title
        this.content.string = data.created_at
    }
    start() {

    }

    onClick(){
        EventSystem.send("OnClickMailCell" , this.data)
    }
}

