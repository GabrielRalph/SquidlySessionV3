import { AccessButton, AccessEvent } from "../../Utilities/access-buttons.js";
import { getSummary } from "./quizzes.js";
import { SvgPlus } from "../../SvgPlus/4.js";
import { MarkdownElement } from "./markdown.js";
import { Icon, isIconName } from "../../Utilities/Icons/icons.js";
import { PromiseChain } from "../../Utilities/usefull-funcs.js";

/**
 * @typedef {import("./quizzes.js").Answer} Answer
 * @typedef {import("./quizzes.js").Question} Question
 * @typedef {import("./quizzes.js").Quiz} Quiz
 * @typedef {import("./quizzes.js").Action} Action
 * @typedef {import("./quizzes.js").QuizResults} QuizResults
 * @typedef {import("./quizzes.js").AnswerResponse} AnswerResponse
 */


/**
 * @param {Array} choosen
 * @param {Array} correct
 * @param {number} total
 * 
 * @return {number}
 * 
 */
function computeScore(choosen, correct, total) {
    let score = 0;
    if (correct.length > 1) {
        let t_c = correct.length;
        let t_ic = total - t_c;

        
        correct = new Set(correct);
        let correctChoice = choosen.filter(i => correct.has(i));
        let c_c = correctChoice.length;
        let c_ic = choosen.length - c_c;


        score = c_c / t_c - (t_ic == 0 ? 0 : (c_ic / t_ic));
        if (score < 0) score = 0;
    } else if (correct.length == 0 || correct[0] == choosen[0]) {
        score = 1;
    } 
    return score
}


/** 
 * @param {Quiz} quiz 
 * @param {Array<number>[]} choosen
 * @param {Action[]} actions
 */
function createResults(quiz, choosen, actions) {
    let {questions} = quiz;
    let correct = questions.map(q => q.answers.map((...a) => a).filter(([a,i]) => a.correct).map(a=>a[1]));
    let answers = choosen.map((choosen, question) => {
        return {
            choosen, question,
            correct: correct[question],
            score: computeScore(choosen, correct[question], quiz.questions[question].answers.length)
        }
    })

    let cor = correct.map(a => a.length == 0 ? "-" : "[" + a + "]");
    let cho = choosen.map(a => a.length == 0 ? "-" : "[" + a + "]");
    let sel = actions.map(a => a.length == 0 ? "-" : "[" + a.answer + "]");

    let results_csv = cor.map((s, i) => `Q${i+1}, ${s}, ${cho[i]}`).join("\n");
    let actions_csv = actions.map((s,i) => `Q${s.question + 1}, ${s.type}, ${Math.round(s.duration / 10)/100}s, ${sel[i]}`).join("\n");
    let csv = `**Quiz Actions**\nquestion,action,response time (s), selected answers\n${actions_csv}\n\n**Quiz Results\nquestion, correct, choosen\n${results_csv}`;
    let total = answers.map(a=>a.score).reduce((a,b)=>a+b)
    return {actions, answers, csv, total};
}


const COLORS = [
    "light-red",
    "light-orange",
    "light-gold",
    "light-green",
    "light-teal",
    "light-blue",
    "light-indigo",
    "light-purple",
    "dark-red",
    "dark-orange",
    "dark-gold",
    "dark-green",
    "dark-teal",
    "dark-blue",
    "dark-indigo",
    "dark-purple"
]
let III = 0;
let Text2Speech = {speak: ()=>null, loadUtterances: () => null};

class QuizIcon extends AccessButton {
    /** @param {Answer} icon */
    constructor(icon, group, speakOnClick = true) {
        super("quiz-" + group);
        this.speakOnClick = speakOnClick;

        if (icon.color) this.setAttribute("color", icon.color)
        let {title, subtitle, image} = icon;
        this.toggleAttribute("quiz-icon", true);
        this.imageArea = this.createChild("div", {class: "img-area"})
        this.titleEl = this.createChild(MarkdownElement, {class: "title"}, "div", title);
        this.subtitleEl = this.createChild(MarkdownElement, {class: "subtitle"}, "div", subtitle, true);
        this.header = title;

        this.toggleAttribute("emphasize", icon.correct === true)
        this.toggleAttribute("action", icon.isAction === true)

        this.image = image;

        if (this.speakOnClick) {
            this.addEventListener("access-click", () => {
                Text2Speech.speak(this.headerText);
            })
        }
    }


    /** @param {?string} text*/
    set header(text){
        let shown = typeof text === "string" && text.length > 0
        this.titleEl.toggleAttribute("hide", !shown)
        this.titleEl.typeset(text, false);
        this.headerText = text;
        if (this.speakOnClick) Text2Speech.loadUtterances([text]);
    }

    /** @param {?string} text*/
    set subtitle(text){
        let shown = typeof text === "string" && text.length > 0
        this.subtitleEl.toggleAttribute("hide", !shown)
        this.subtitleEl.typeset(text, true);
        this._subtitle = text;
    }

    /** @param {?string} img*/
    set image(img){
        this.imageArea.innerHTML = ""
        if (typeof img === "string" && img.length > 0) {
            if (isIconName(img)) {
                this.imageArea.createChild(Icon, {}, img)
            } else {
                this.imageArea.createChild("img", {src: img});
            }
        }
    }
}

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
        [...this.children].map((c, i) => c.toggleAttribute("selected", false))
        for (let i of selected) this.selectAnswer(i);
    }

    /** 
     * @param {number} j answer to select 
     * @param {boolean} isMulti whether to allow multiple selections
     * */
    selectAnswer(j, isMulti = this.isMulti) {

        if (this.selectedAnswers.has(j)) {
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

class QuestionInfo extends SvgPlus {
    titlePrefix = "Page";
    max = 0;
    _progress = 0;

    constructor() {
        super("div");
        this.class = "question-info";
        
        this.titleEl = this.createChild("div", {class: "title"});
        this.main = this.createChild("div", {class: "main"});
        this.bar = this.createChild("div", {class: "progress", hide: true, style: {"--progress": 0}})
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
            main.createChild(MarkdownElement, {class: "content"}, "div", value, true)
        } else if (typeof value === "object" && value !== null) {
            if (typeof value.image === "string") {
                main.createChild("div", {
                    class: "img-container", 
                    style: {
                        "background-image": `url("${value.image}")`
                    }
                })
            }
            main.createChild(MarkdownElement, {class: "content"}, "div", value.question, true)
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
    transitionBuffer = new PromiseChain();

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
            colorf: "red",
            events: {
                "access-click": (e) => {
                    if (this.onInteraction instanceof Function) this.onInteraction("close", null, e);
            }
        }}, {title: "Close", image: "close"}, "controls", false);

        this.back = this.createChild(QuizIcon, {
            colorf: "light-blue",
            events: {
                "access-click": (e) => {
                    if (this.onInteraction instanceof Function) this.onInteraction("back", null, e);
            }
        }}, {title: "Back", image: "back"}, "controls", false)

        this.info = this.createChild("div", {class: "quiz-info"}).createChild(QuestionInfo);

        this.next = this.createChild(QuizIcon, {
            colorf: "light-blue",
            events: {
                "access-click": () => {
                    if (this.onInteraction instanceof Function) this.onInteraction("next", null, e);
            }
        }}, {title: "Next", image: "next"}, "controls", false)


        this.main = this.createChild("div", {class: "main-quiz", events: {
            "answer": (e) => {
                if (this.onInteraction instanceof Function) this.onInteraction("answer", e.answerIndex, e);
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

    get selectedAnswers(){
        return this.answerBoard.selected;
    }

    set selectedAnswers(selected){
        return this.answerBoard.selected = selected;
    }


    /** @param {Answer[]} answers*/
    set answers(answers){
        this.main.innerHTML = "";
        if (SvgPlus.is(answers, Answers)) {
            this.answerBoard = answers;
            this.main.appendChild(answers);
        } else {
            this.answerBoard = this.main.createChild(Answers, {}, answers);
        }
    }

    async transitionAnswers(answers, direction = false, correct){
        let next = async () => {
            let isHidden = document.hidden || document.msHidden || document.webkitHidden || document.mozHidden
            let time = this.transitionTime;

            let oldAnswers = this.answerBoard;
            let newAnswers = answers;
            if (!SvgPlus.is(answers, Answers)) {
                newAnswers = new Answers(answers);
                if (correct instanceof Array) {
                    for (let item of correct) newAnswers.selectAnswer(item);
                }
            }

            // Add the new answer board to main
            let dir = direction ? -1 : 1;
            newAnswers.styles = {"--offset": dir}
            this.main.appendChild(newAnswers);
            this.answerBoard = newAnswers;


            // Transisition animation
            let setter = (t) => {
                newAnswers.styles = {"--offset": -1 * dir * (1 - t)}
                if (oldAnswers instanceof Element) 
                    oldAnswers.styles = {"--offset": dir * t}
            }

            if (isHidden) {
                setter(1);
            } else {
                await this.waveTransition(setter, time * 1000, true)
            }

    
            if (oldAnswers) oldAnswers.remove();
        }

        let run = async (func) => {
            this._transition = func();
            await this._transition;
            this._transition = null;
            if (this.transitionQueue instanceof Function) {
                let newFunc = this.transitionQueue;
                this.transitionQueue = null;
                await run(newFunc);
            }
        }
        

        if (this._transition instanceof Promise) {
            console.log("setting cue");
            
            this.transitionQueue = next;
        } else {
            await run(next);
        }
    }
}

export function setSpeech2TextModule(text2speech) {
    Text2Speech = text2speech;
}