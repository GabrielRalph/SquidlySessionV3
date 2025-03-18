import * as Topics from "./topics.js"
/** @type {?SpeachRequest} */
let head = null;
/** @type {?SpeachRequest} */
let tail = null;

class SpeachRequest {
    /**@type {?Promise} */
    promise = null;
    /**@type {?SpeachRequest} */
    next = null;

    constructor(item) {
        this.item = item;
        if (head == null) {
            head = this;
            tail = this;
        } else {
            tail.next = this;
            tail = this;
        }
    }

    async speak(){
        let f = async () => {
            let url = await Topics.getUtterance(this.item);
            if (url != null) {
                let audio = new Audio(url);
                audio.play();
                await new Promise((r) => audio.onended = r) 
            }
            head = this.next;
        }
        this.promise = f();
        await this.promise;
    }

    get running(){return this.promise instanceof Promise}
}

function logList(){
    let str = [];
    let node = head;
    while(node != null) {
        str.push(node.item.displayValue);
        node = node.next;
    }
    console.log(str.join(" -> "));
}


/**
 * @param {GItem} item
 * @return {Promise}
 **/
async function speakUtterance(item) {
    new SpeachRequest(item);
    logList()
    while(head.running) {
        await head.promise;
    }
    await head.speak();
}

export {speakUtterance}