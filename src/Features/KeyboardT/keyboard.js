import { AccessTextArea } from "../../Utilities/access-textarea.js";
import {  GridIcon } from "../../Utilities/Buttons/grid-icon.js";
import { HideShowTransition } from "../../Utilities/hide-show.js";
import { Rotater, Slider } from "../../Utilities/rotater.js";
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { PromiseChain, relURL } from "../../Utilities/usefull-funcs.js";
import { Features } from "../features-interface.js";
import { FolderKeyboard } from "./folder-keyboard.js";
import { QwertyKeyboard } from "./qwerty-keyboard.js";

/**
 * @extends {ShadowElement<HideShowTransition>}
 */
class Keyboard extends ShadowElement {

    /**
     * @param {import("../features-interface.js").SquidlySession} session
     */
    constructor(session) {
        let root = new HideShowTransition("keyboard-window", "up")
        super("keyboard-window", root);
        this.session = session;
        this.promiseQueue = new PromiseChain();

        this.slider = this.createChild(Slider, {}, "horizontal");

        this.keyboards = [
            new FolderKeyboard(),
            new QwertyKeyboard()
        ]
        this._currentKeyboard = 0;
        this.slider.setContent(this.keyboards[this._currentKeyboard], true);

        this.events = {
            "keydown": (e) => {
                this.currentKeyboard.handleKeyEvent(e);
            }
        }

        this.root.events = {
            "new-word": e => {
                this.speakWord(e.word);
            },
            "switch-keyboard": e => e.waitFor(this.setCurrentKeyboard(this.kIndex + 1))
        }
    }

    get value() {
        return this.currentKeyboard.value;
    }

    set value(val) {
        this.currentKeyboard.value = val;
    }

    get currentKeyboard() {
        return this.keyboards[this._currentKeyboard];
    }

    get kIndex() {
        return this._currentKeyboard;
    }

    async setCurrentKeyboard(index) {
        if (typeof index === "number" && !Number.isNaN(index)) {
            index = Math.max(index % this.keyboards.length, 0);
            if (index !== this._currentKeyboard) {
                let dir = Math.sign(index - this._currentKeyboard);
                const nextKeyboard = this.keyboards[index];
                nextKeyboard.value = this.currentKeyboard.value;
                nextKeyboard.textArea.caret = this.currentKeyboard.textArea.caret;
                this._currentKeyboard = index;
                await this.slider.setContent(nextKeyboard, dir);
            }
        }
    }

    async speakWord(word) {
        this.promiseQueue.addPromise(async () => {
            await this.session.text2speech.loadUtterances([word]);
            await session.text2speech.speak(word);
        })
    }


    static get usedStyleSheets() {
        return [
            GridIcon.styleSheet,
            Rotater.styleSheet,
            AccessTextArea.styleSheet,
            relURL("./styles.css", import.meta),
        ]
    }
}

export default class KeyboardFeature extends Features {

    /**
     * @param {import("../features-interface.js").SquidlySession} session
     * @param {import("../features-interface.js").SessionDataFrame} sdata
     */
    constructor(session, sdata){
        super(session, sdata)
        this.keyboard = new Keyboard(session);
        this.keyboard.root.addEventListener("close", e => e.waitFor(this.close()));
    }

    /**
     * Set the value of the keyboard.
     * @param {string} val the value to set the keyboard to.
     */
    set value(val) {
        this.keyboard.value = val || "";
    }

    /**
     * Get the value of the keyboard.
      * @returns {string} the current value of the keyboard.
     */
    get value() {
        return this.keyboard.value;
    }

    /**
     * Bring up the keyboard window and sets its va;ue.
     * @param {string} value the value to set the keyboard to when it is opened.
     */
    async bringUpKeyboard(value = "") {
        this.value = value;
        await this.keyboard.root.show();
    }

    /**
     * Bring up the keyboard window and sets its va;ue.
     * @param {string} value the value to set the keyboard to when it is opened.
     */
    async open(value = "") {
        this.value = value;
        await this.keyboard.root.show()
    }

    /**
     * Close the keyboard window and clear its value.
     */
    async close() {
        this.dispatchEvent(new CustomEvent("close"));
        await this.keyboard.root.hide();
    }


    async initialise() {
        this.session.toolBar.addMenuItem("share", {
            name: "keyboard",
            displayValue: "Keyboard",
            onSelect: () => {
                this.open();
            }
        })
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    static async loadResources() {
        //load any resources required for this feature
        await Keyboard.loadStyleSheets();
    }

    /* Must have name static getter 
       for feature to be recognised 
    */

    static get name() {
        return "keyboard"
    }

    static get layers() {
        return {
            keyboard: {
                type: "area",
                area: "fullAspectArea",
                index: 250,
            }
        }
    }

    static get firebaseName(){
        return "some-name";
    }
}