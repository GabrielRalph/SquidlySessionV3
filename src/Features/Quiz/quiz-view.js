import { AccessButton, AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { SvgPlus } from "../../SvgPlus/4.js";
import { GridIcon } from "../../Utilities/Buttons/grid-icon.js";
import { MarkdownElement } from "../../Utilities/markdown.js";

/**
 * @typedef {import("./quizzes.js").Answer} Answer
 * @typedef {import("./quizzes.js").Question} Question
 * @typedef {import("./quizzes.js").Quiz} Quiz
 * @typedef {import("./quizzes.js").Action} Action
 * @typedef {import("./quizzes.js").QuizResults} QuizResults
 * @typedef {import("./quizzes.js").AnswerResponse} AnswerResponse
 */

const answers_templates = [
    [],["1fr", "1fr"],
    [ "repeat(2, 1fr)", "calc(100%)" ],
    [ "repeat(3, 1fr)", "calc(100%)" ],
    [ "repeat(2, 1fr)", "repeat(2, calc((100% - 0.5em) / 2))" ],
    [ "repeat(5, 1fr)", "1fr" ],
    [ "repeat(3, 1fr)", "repeat(2, calc((100% - 0.5em) / 2))" ],
    [ "repeat(4, 1fr)", "repeat(2, calc((100% - 0.5em) / 2))" ],
    [ "repeat(4, 1fr)", "repeat(2, calc((100% - 0.5em) / 2))" ],
    [ "repeat(3, 1fr)", "repeat(3, calc((100% - 2 * 0.5em) / 3))" ],
    [ "repeat(5, 1fr)", "repeat(2, calc((100% - 0.5em) / 2))" ],
];
const special_layout = {
    // 5: [[[1,4],1], [[4,7],1], [[1,3],2], [[3,5],2], [[5,7],2]],
    // 7: [[[1,5],1], [[5,9],1], [[9,13],1], [[1,4],2], [[4,7],2], [[7,10],2], [[10,13],2]],
    // 8: [[[1,4],1], [[4,7],1], [[1,3],2], [[3,5],2], [[5,7],2], [[1,3],3], [[3,5],3], [[5,7],3]],
}
const index_2_group = {
    4: (i) => Math.floor(i/2),
    6: (i) => Math.floor(i/3),
    7: (i) => Math.floor(i/4),
    8: (i) => Math.floor(i/4),
    9: (i) => Math.floor(i/3),
    10: (i) => Math.floor(i/5),
}


class QuizIcon extends GridIcon {
    /** @param {Answer} icon */
    constructor(icon, group, speakOnClick = true) {
        let colorName = (icon.color || "").replace(/[a-z]-[a-z]/g, (match) => {
            return match.charAt(0).toLowerCase() + match.charAt(2).toUpperCase();
        });
        super({
            displayValue: icon.displayValue,
            subtitle: icon.subtitle,
            type: icon.type || colorName, 
            symbol: icon.image || null
        }, "quiz-" + group);
        this.header = icon.title;
        this.toggleAttribute("quiz-icon", true);
        this.toggleAttribute("emphasize", icon.correct === true)
        this.toggleAttribute("action", icon.isAction === true)

        if (speakOnClick) {
            this.utterance = icon.utterance || icon.title;
            this.addEventListener("access-click", this.speak.bind(this));
        }
    }

    makeDisplayValueElement(){
        let el = super.makeDisplayValueElement();
        el.markdownMode = true;
        return el;
    }

    makeSubtitleElement(){
        let el = super.makeSubtitleElement();
        el.markdownMode = "both-multi";
        return el;
    }

    /** @param {?string} text*/
    set header(text){
        this.headerText = text.toLowerCase().trim();
        this.displayValue = text;
    }

    /** @param {?string} img*/
    set image(img){
        this.symbol = img;
    }
}

export class Answers extends SvgPlus {
    selectedAnswers = new Set();

    /** @param {Answer[]} answers*/
    constructor(answers){
        super("div");
        this.class = "answers";

        let n = answers.length;
        this.styles = {
            "grid-template-rows": answers_templates[n][1],
            "grid-template-columns": answers_templates[n][0],
        }
        let slayout = special_layout[n];
        let i = 0;
        this.isMulti = answers.filter(a => a.correct).length > 1;
        for (let answer of answers) {
            let j = i;
            let groudIndex = n in index_2_group ? index_2_group[n](i) : i;
            let el = this.createChild(QuizIcon, {events: {
                "access-click": (e) => {
                    this.selectAnswer(j);
                    const event = new AccessEvent("answer", e, {bubbles: true});
                    event.answer = answer;
                    event.answerIndex = j;
                    this.dispatchEvent(event);
                }
            }}, answer, "A"+groudIndex);
            el.toggleAttribute("correct", answer.correct)
            if (slayout) {
                let [cols, rows] = slayout[i];
                
                for (let [k,l] of [["column", cols], ["row", rows]]) {
                    let s;
                    if (Array.isArray(l)) s = {[`grid-${k}-start`]:l[0], [`grid-${k}-end`]:l[1]};
                    else s = {[`grid-${k}`]:l};
                    el.styles = s;
                    
                }
            }
            i++;
        }
    }

    /**  Returns selected answers
     * @returns {number[]} 
     * */
    get selected(){
        return [...this.selectedAnswers];
    }

    /** 
     * @param {number[]} selected answers to select
     * */
    set selected(selected){
        this.selectedAnswers = new Set();
        for (let i of selected) this.selectAnswer(i);
    }

    /** 
     * @param {number} j answer to select 
     * @param {boolean} isMulti whether to allow multiple selections
     * */
    selectAnswer(j, isMulti = this.isMulti) {
        if (this.selectedAnswers.has(j) && isMulti) {
            this.selectedAnswers.delete(j);
        } else {
            if (!isMulti && this.selectedAnswers.size > 0) {
                this.selectedAnswers = new Set();
            }
            this.selectedAnswers.add(j);
        }


        [...this.children].map((c, i) => c.toggleAttribute("selected", this.selectedAnswers.has(i)))
    }
}

class QuestionInfo extends AccessButton {
    titlePrefix = "Page";
    max = 0;
    _progress = 0;

    constructor() {
        super("quiz-controls");
        this.class = "question-info";
        this.titleEl = this.createChild("div", {class: "title"});
        this.main = this.createChild("div", {class: "main"});
        this.bar = this.createChild("div", {class: "progress", hide: true, style: {"--progress": 0}})
        this.addEventListener("access-click", this.speak.bind(this));
    }

    async createMarkdown(content) {
        let m = this.main.createChild(MarkdownElement, {class: "content"}, "div", "both-multi")
        await m.set(content);
        m.adjustFS();
    }

    /**
     * @param {("input"|string|Question)} value
     */
    set content(value){
        let {main} = this;
        this.input = null;
        main.innerHTML = "";

        if (value === "input") {
            this.input = main.createChild("input")
        } else if (typeof value === "string") {
            this.createMarkdown(value);
        } else if (typeof value === "object" && value !== null) {
            if (typeof value.image === "string") {
                main.createChild("div", {
                    class: "img-container", 
                    style: {
                        "background-image": `url("${value.image}")`
                    }
                })
            }

            this.utterance = value.utterance || value.question;
            this.createMarkdown(value.question);
        }
    }

    /** @param {string} title */
    set titleValue(title) {
        this.titleEl.innerHTML = title;
    }


    /** @param {number} i */
    set progress(i) {
        let {max, bar, titleEl, titlePrefix} = this;
        bar.toggleAttribute("hide", i==null);
        bar.styles = {"--progress": (i+1)/max};
        titleEl.innerHTML =  i==null ? "" : titlePrefix + ` ${i+1}/${max}`;
        this._progress = i;
    }
}

export class QuizView extends SvgPlus {
    transitionTime = 0.4;
    transitionsQueue = [];

    /** @type {QuestionInfo} */
    info = null;

    /** @type {QuizIcon} */
    close = null;

    /** @type {QuizIcon} */
    next = null;

    /** @type {QuizIcon} */
    back = null;

    constructor() {
        super("quiz-view");
        this.close = this.createChild(QuizIcon, {
            events: {
                "access-click": (aEvent) => {
                    if (this.onInteraction instanceof Function) this.onInteraction("close", null, aEvent);
            }
        }}, {title: "Close", image: "close", type: "action"}, "controls", false);

        this.back = this.createChild(QuizIcon, {
            events: {
                "access-click": (aEvent) => {
                    if (this.onInteraction instanceof Function) this.onInteraction("back", null, aEvent);
            }
        }}, {type: "verb", title: "Back", image: "back"}, "controls", false)

        this.info = this.createChild("div", {class: "quiz-info"}).createChild(QuestionInfo);

        this.next = this.createChild(QuizIcon, {
            events: {
                "access-click": (aEvent) => {
                    if (this.onInteraction instanceof Function) this.onInteraction("next", null, aEvent);
            }
        }}, {type: "starter", title: "Next", image: "next"}, "controls", false)


        this.main = this.createChild("div", {class: "main-quiz", events: {
            "answer": (aEvent) => {
                if (this.onInteraction instanceof Function) this.onInteraction("answer", aEvent.answerIndex, aEvent);
            }
        }})
    }

    async promt(text, true_text = "exit", false_text = "cancel") {
        let p = this.createChild("div", {class: "popup-prompt"});
        let d = p.createChild("div", {content: text});
        let r = p.createChild("div", {class: "row"})
        let result = await new Promise((resolve, reject) => {
            r.createChild(QuizIcon, {events: {
                "access-click": () => {
                    resolve(true)
                }
            }}, {title: true_text, color:"white"}, "prompt", false);
            r.createChild(QuizIcon, {events: {
                "access-click": () => {
                    resolve(false)
                }
            }}, {title: false_text, color:"white"}, "prompt", false);
        })

        p.remove();
        return result;
    }

    /** @param {boolean} bool */
    set disabled(bool) {
        this.styles = {
            filter: bool === true ? "blur(5px)" : null,
            "pointer-events": bool ? "none" : null
        }
    }

    /** @returns {number[]} selected answer indecies  */
    get selectedAnswers(){
        return this.answerBoard.selected;
    }

    /** Sets the selected answers to the given array of indices.
     *  @param {number[]} selected the indecies of the answers to select
     */
    set selectedAnswers(selected){
        return this.answerBoard.selected = selected;
    }
    
    /**
     * Imediately displays the answers to the given array of answers, or answers element.
     *  @param {Answer[]|Answers} answers either an array of answers or an instance of Answers
    */
    set answers(answers){
        this.main.innerHTML = "";
        if (SvgPlus.is(answers, SvgPlus)) {
            this.answerBoard = answers;
            this.main.appendChild(answers);
        } else {
            this.answerBoard = this.main.createChild(Answers, {}, answers);
        }
    }

    /** Displays set of answers or answers element with a transition animation.
     * @param {Answers|Answer[]} answers the answers to transition to
     * @param {boolean} [direction=false] true for next, false for previous
     * @param {?number[]} [selected] indices of selected answers
     */
    async transitionAnswers(answers, direction = false, selected = null) {
        if (this._isTransitioning) {
            this.transitionsQueue.push([answers, direction, selected]);
        } else { 

            this._isTransitioning = true;
            // Check whether the document is hidden, if so, skip the transition
            let isHidden = document.hidden || document.msHidden || document.webkitHidden || document.mozHidden
            let time = this.transitionTime;
            let oldAnswers = this.answerBoard;

            let newAnswers = answers;

            // If the answers are not an instance of Answers element, create a new one
            if (!SvgPlus.is(answers, SvgPlus)) {
                newAnswers = new Answers(answers);
            }

            // Is a selection is given, set the selected answers
            if (selected && Array.isArray(selected)) {
                newAnswers.selected = selected;
            }

            // Add the new answer board to main
            let dir = direction ? -1 : 1;
            newAnswers.styles = {"--offset": dir}
            this.main.appendChild(newAnswers);
            this.answerBoard = newAnswers;

            // Transisition animation setter
            let setter = (t) => {
                newAnswers.styles = {"--offset": -1 * dir * (1 - t)}
                if (oldAnswers instanceof Element) 
                    oldAnswers.styles = {"--offset": dir * t}
            }

            // If the document is hidden, skip the transition
            if (isHidden) {
                setter(1);
            } else {
                await this.waveTransition(setter, time * 1000, true)
            }

            // Remove the old answer board
            if (oldAnswers) oldAnswers.remove();

            this._isTransitioning = false;
            
            // If there are transitions in the queue, start the next one
            if (this.transitionsQueue.length > 0) {
                let nextTransition = this.transitionsQueue.pop();
                this.transitionAnswers(...nextTransition);
            }
        }
    }
}
