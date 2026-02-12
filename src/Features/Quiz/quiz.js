
import {Answers, QuizView} from "./quiz-view.js"
import { Features, OccupiableWindow } from "../features-interface.js";
import { getAllQuizes, getSummary, watchQuizes } from "./quizzes.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { filterAndSort, SearchWindow } from "../../Utilities/search.js";
import { Action, ActionHistory } from "./actions.js";
import { formatReport } from "./results.js";
import { GridCard, GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { Heatmap } from "../EyeGaze/heatmap.js";

/**
 * @typedef {import("./quizzes.js").Question} Question
 * @typedef {import("./quizzes.js").Quiz} Quiz
 * @typedef {import("./quizzes.js").Answer} Answer
 */

/**
 * @typedef {Object} QuizFeatureState
 * @property {number} index
 * @property {Quiz} quiz
 * @property {string} quizID
 * @property {import("./quizzes.js").Action[]} actions
 */

function savePDF(base64) {
    let a = document.createElement("a");
    a.href = "data:application/pdf;base64," + base64;
    a.download = "quiz-results.pdf";
    a.click();
}



class QuizResults extends GridLayout {
    constructor() {
        super(2, 4, "quiz-results");
        this.selected = [];
        this.class = "answers";
        let title = new GridCard("div", "adjective");
        this.mainTitle = title.content.createChild("div", {
            class: "display-value",
        });
        this.subtitle = title.content.createChild("div", {
            class: "subtitle",
            
        });

        this.downloadPDFIcon = new GridIcon({
            symbol: "downloadPDF",
            displayValue: "PDF Report",
            type: "action",
            subtitle: "Click here to download the comprehensive pdf report.",
            events: {
                "access-click": (e) => {
                    this.downloadPDF();
                }
            }
        }, "download");

        this.downloadLatexIcon = new GridIcon({
            symbol: "downloadLatex",
            displayValue: "Latex Report",
            type: "action",
            subtitle: "Click here to download the comprehensive latex report.",
            events: {
                "access-click": (e) => {
                   this.downloadLatex()
                }
            }
        }, "download");

        this.add(title, 0, 0, 1, 2);
        this.add(this.downloadPDFIcon, 0, 3);
        this.add(this.downloadLatexIcon, 1, 3);
    } 

    async downloadLatex() {
        let results = this.results;
        if (this.sid) {
            this.downloadLatexIcon.disabled = true;
            this.downloadPDFIcon.disabled = true;
            let {summary} = await getSummary(this.sid, (status) => {
                this.subtitle.innerHTML = status;
            });
            if (summary) {
                results.summary = summary
            }
            this.downloadLatexIcon.disabled = false;
            this.downloadPDFIcon.disabled = false;
        }
        let tex = formatReport(results);

        // create a blob from the tex string
        let blob = new Blob([tex], {type: "text/plain"});
        // create a link to download the blob
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "quiz-results.tex";
        a.click();
        // clean up the URL
        URL.revokeObjectURL(a.href);
    }

    async downloadPDF() {
        if (this.sid) {
            this.downloadPDFIcon.disabled = true;
            this.downloadLatexIcon.disabled = true;
            let results = await getSummary(this.sid, (status) => {
                this.subtitle.innerHTML = status;
            });
            if (results?.pdf) {
                savePDF(results.pdf);
            } else {
                this.subtitle.innerHTML = "No PDF available, please try again later.";
            }
            this.downloadPDFIcon.disabled = false;
            this.downloadLatexIcon.disabled = false;
        }
    }

    set results(results) {
        this._results = results;
        this.mainTitle.innerHTML = `You scored <b>${results.total_score}</b> out of <b>${results.total_questions}</b> questions. <br><b>${Math.round(100 * results.total_score / results.total_questions)}%</b>`;
    }
    get results() {
        return this._results;       
    }

}


class SQuizView extends QuizView {
    _locked = false;
    _index = null;
    quiz = null;
    quizID = null;
    actions = new ActionHistory;
    forceUpdate = false;
    userName = "-";
    
    constructor() {
        super();
        this.close.header = "Close";
        this.resultsPage = new QuizResults();
    }
    
    async onInteraction(type, value, aEvent) {
        
        value = typeof value === "number" ? value : null;
        
        const action = new Action(type, value, this.index, this.selectedAnswers, aEvent.clickMode, this.userName);
        const event = new AccessEvent("interaction", aEvent, {cancelable: true});
        event.data = action

        // push action if the quiz has not been locked
        this.actions.push(action)

        // Navigate through the quiz if interaction with next, back icons
        if ((type == "back" || type == "next") && !(type == "back" && this.index == 0)) {
            this.index += type == "next" ? 1 : -1;
        } else if (type == "answer") {
            // If the quiz is in the start state, start the quiz
            if (this.index == -1) {
                this.index += 1;

            // If the quiz is in the results state, download results
            } 
            // else if (this.index == this.max) {
            //     aEvent.waitFor(this.downloadResults());
            // }

        } else if (type == "close") {
            this.promtClose(aEvent);
        }

        if (aEvent instanceof AccessEvent) {
            aEvent.waitFor(this.transitionPromise);
        }

        this.dispatchEvent(event);
    }

    async promtClose(aEvent) {
        if (await this.promt("Are you sure you want to close?", "Close", "Cancel")) {
            this.state = null;
            this.dispatchEvent(new AccessEvent("close", aEvent, {bubbles: true}));
        }
    }

    async showQuizResults(forceUpdate){
        let {results, resultsPage} = this;
        let {total_score, total_questions} = results;
        
        this.info.titleValue = "Congratulations!";
        this.info.content = `${Math.round(100 * total_score / total_questions)}%`;
        resultsPage.results = results;
        this.locked = true;
        if (!forceUpdate) {
            await this.transitionAnswers(resultsPage, true)
        } else {
            this.answers = resultsPage;
        }
    }

    showQuizStart(){
        this.actions = new ActionHistory();
        this.answers = [{title: this.quiz.name, subtitle: "Click here to begin", color: "white"}];
        this.info.progress = -1;
        this.info.titleValue = `${this.max} Questions`
        this.info.content = "Get ready to begin";
    }

    createRender(heatmap){
        if (heatmap) {

            let width = heatmap.length;
            let height = heatmap[0].length;
            let canvas = new SvgPlus("canvas");
            canvas.width = width;
            canvas.height = height;
            let c = canvas.getContext("2d");
    
            let [quizPos, quizSize] = this.bbox;
            let screenSize = new Vector(window.innerWidth, window.innerHeight);
            let renderSize = new Vector(width, height);
            
            let relQuizPos = quizPos.div(screenSize);
            let relQuizSize = quizSize.div(screenSize);
    
            let rqPos = relQuizPos.mul(renderSize);
            let rqSize = relQuizSize.mul(renderSize);
    
            let drawRR = (pos, size, col, rad) => {
                if (rad) {
                    c.fillStyle = col;
                    c.beginPath();
                    c.roundRect(pos.x, pos.y, size.x, size.y, rad);
                    c.fill();
                } else {
                    c.fillStyle = col;
                    c.fillRect(pos.x, pos.y, size.x, size.y);
                }
            }
            
            let space = 0.015 * Math.min(renderSize.x, renderSize.y);
    
            let topCellSpaceX = (rqSize.x - 6 * space) / 5;
            let topCellSpaceY = (rqSize.y - 4 * space) / 3;
            let topCellSize = new Vector(topCellSpaceX, topCellSpaceY);
            let p0 = rqPos.add(space);
    
            let p1 = p0.addV(topCellSpaceY + space);
    
            drawRR(new Vector(0, 0), renderSize, "black");
    
            // draw quiz area 
            drawRR(rqPos, rqSize, "black");
    
            // draw close icon 
            drawRR(p0, topCellSize, "#a61f00", space);
    
            // draw back icon
            drawRR(p0.addH(topCellSpaceX + space), topCellSize, "#ff9ca7", space);
    
            
            drawRR(p0.addH(2*(topCellSpaceX + space)), topCellSize.addH(topCellSpaceX + space), "white", space);
            
            // draw next icon
            drawRR(p0.addH(4*(topCellSpaceX + space)), topCellSize, "#aeef93", space);
    
            // draw question area
            drawRR(p1, new Vector(rqSize.x - 2 * space, 2 * topCellSpaceY + space), "white", space);
    
            heatmap.render(canvas);
    
            return canvas.toDataURL("image/png");
        } else {
            return "";
        }
    }
  
    /** @param {QuizFeatureState} state*/
    set state(state) {
        if (state == null) {
            this.quizID = null;
            this.quiz = null;
            this.forceUpdate = false;
            this.quizAnswers = [];
            this.locked = false;
            this.actions = new ActionHistory();
        } else {
            let {index, quizID, quiz, actions, locked} = state;

            this.actions = ActionHistory.parse(actions);
            this.locked = locked;
    
            // Change from home to quiz or instant change of quiz. 
            if (this.quizID !== quizID && quizID !== null && quizID !== null) {
                this.forceUpdate = true;
                this.quiz = quiz;
                this.quizID = quizID;
                this.quizAnswers = quiz.questions.map(q => new Answers(q.answers));
            } 
            this.index = index;
        }
    }

    /** Sets the current question index, any promises from transitions will stored in `transitionPromise`
     * @param {number} i     -1: shows quiz start, 
     *             [0, (max-1)]: question index,
     *                      max: shows quiz results
    */
    set index(i){
        let {max, forceUpdate, choosenAnswers} = this;
        this.forceUpdate = false;

        // There has been a change in index, or force update is requested
        if (forceUpdate || i !== this.index) {

            if (this.index == -1 && i == 0) {
                this.heatmap = new Heatmap(400, 40);
                this.heatmap.start();
            }

            // The change is valid
            if (i >= -1 && i <= max) {
                this.info.max = max;
                this.info.titlePrefix = "Question";

                // Update icons
                this.next.header = i == this.max-1 && !this.locked ? "Submit" : "Next";
                this.next.disabled = i == (this.max);
                this.back.header = i == (this.max) ? "Answers" : "Back";
                this.back.disabled =  i <= 0;

                if (i == -1) {
                    this.showQuizStart();
                } else if (i == max) {
                    if (!this.locked) {

                        if (this.heatmap) {
                            this.heatmap.stop();
                            if (this.heatmap.counts > 20) {
                                const aEvent = new Event("heatmap", {bubbles: true});
                                aEvent.data = this.createRender(this.heatmap);
                                this.dispatchEvent(aEvent);
                            }
                        }
                    }
                    this.transitionPromise = this.showQuizResults(forceUpdate);
                } else {
                    // Transition to choosen answer
                    let answers = this.quizAnswers[i];
                    if (forceUpdate) {
                        answers.selected = choosenAnswers[i] || [];
                        this.answers = answers;
                    } else {
                        this.transitionPromise = this.transitionAnswers(answers, i>this.index, choosenAnswers[i] || []);
                    }
                    this.info.content = this.questions[i];
                    this.info.progress = i;
                }
                // Update current index
                this._index = i;
            }

        // Update selected answers if no change to question index
        } else if (this.index >= 0 && this.index < this.max) {
            this.quizAnswers[this.index].selected = choosenAnswers[this.index];
        }
    }

    /** @return {number} current index */
    get index(){
        return this._index;
    }

    /** @return {Object<number, number[]>} answers */
    get choosenAnswers(){
        let chosen = {};
        let chosenActions = this.actions.selectedAnswers;
        for (let i = 0; i < this.max; i++) {
            chosen[i] = [];
            if (i in chosenActions) {
                chosen[i] = chosenActions[i];
            } 
        }
        return chosen;
    }

    get results(){
        return this.actions.getResults(this.quiz);
    }
    
    /** @returns {Question[]} the current quiz questions or an empty array */
    get questions(){
        if (this.quiz) {
            return this.quiz.questions;
        } else {
            return [];
        }
    }

    /** @return {number} the number of questions */
    get max(){
        return this.questions.length;
    }

    /** @param {boolean} bool whether the quiz is locked from changing answers */
    set locked(bool){
        this.toggleAttribute("locked", !!bool);
        this._locked = !!bool;
    }

    /** @return {boolean} the locked state */
    get locked(){
        return this._locked;
    }
   
}


class QuizSearch extends SearchWindow {
    constructor(){
        super();
    }

    reset(imm){
        this.closeIcon = "close";
        this.resetSearchItems(imm)
    }

    async getSearchResults(searchPhrase){
        let quizzes = getAllQuizes();
        /** @type {Answer[]} */
        let items = quizzes.map(q => {
            return {
                quiz: q,
                icon: {
                    displayValue: q.name,
                    subtitle: q.ownerName,
                    type: "topic",
                },
            }
        })
        items = filterAndSort(items, searchPhrase, ({quiz: {name, ownerName}}) => [name, ownerName]);
        return items;
    }
}


class QuizWindow extends OccupiableWindow {
    /** @type {import("../features-interface.js").SessionDataFrame} */
    sdata = null;

    /** @type {QuizSearch} */
    search = null;

    /** @param {import("../features-interface.js").SessionDataFrame} sdata */
    constructor(feature, sdata){
        super("quiz-feature");

        this.quizView = this.createChild(SQuizView, {
            events: {
                "interaction": (e) => {
                    let action = e.data;
                    sdata.update("state", {
                        index: this.quizView.index,
                        locked: this.quizView.locked,
                    })
                    let key = sdata.push("state/actions");
                    sdata.set("state/actions/"+key, action.toString());
                },
                "close": (e) => {
                    sdata.set("state", null);
                    this.search.reset(true);
                    this.search.show(500);
                },
            }
        }, sdata);
        this.quizView.userName = sdata.me;

        this.search = this.createChild(QuizSearch, {events: {
            "value": (e) => {
                // If the search value is null, exit the quiz feature
                if (e.value == null) {
                    e.waitFor(feature.session.openWindow("default"));
                    
                    // Otherwise, if the search value is a quiz, start the quiz
                } else {
                    const {quiz} = e.value;
                    console.log("Selected quiz", quiz);
                    let state = {
                        state: {
                        quiz: quiz,
                        quizID: quiz.qid,
                        index: -1,
                        locked: false,
                        actions: null,
                    } };
                    sdata.set(null, state);
                    sdata.logChange("quiz.start", {value: quiz.qid, note: quiz.name});
                    this.quizView.state = state.state;
                    e.waitFor(this.search.hide(500));
                }
            }
        }});

        this.initialising = new Promise((r) => {
            sdata.onValue("state", (data) => {
                this.state = data;
                r();
            } )
        })
    }
    

    /**
     * @param {QuizFeatureState} state
     */
    set state(state) {
        // If the state is not valid, set it to null.
        if (typeof state?.quizID !== "string" || typeof state?.quiz !== "object" || state?.quiz == null) {
            state = null;
        }

        // Store the current state
        this._currentState = state; 

        // If the state is null, reset the search and show it.
        if (state == null) {
            if (!this.search.shown) {
                this.search.reset(true);
                this.search.show(500);
            }

        // Otherwise, if the state is valid, hide the search and set the quiz view state.
        } else if (this.search.shown) {
            this.search.hide(500);
        }
        this.quizView.state = state;
    }
    get state() {
        return this._currentState;
    }
    get isQuizOpen() {
        return this.state != null && this.state.quizID && this.state.quizID;
    }


    async open(e){
        await this.search.reset(true),
        await this.isQuizOpen ? this.search.hide(0) : this.search.show(0),
        await this.show()
    }

    async close(){
        await this.hide();
        await this.search.hide(0);
    }

    static get fixToolBarWhenOpen() {return true}
    static get usedStyleSheets(){
        return [
             relURL("/quiz.css", import.meta),
             relURL("/quiz-view.css", import.meta),
             ...SearchWindow.usedStyleSheets,
            ]
    }
}

export default class QuizFeature  extends Features {
    constructor(sesh, sdata) {
        super(sesh, sdata);
        this.board = new QuizWindow(this, sdata);

        this.board.quizView.resultsPage.sid = sdata.sid;

        this.board.quizView.addEventListener("heatmap", (e) => {
            let dataURL = e.data;
            let base64 = dataURL.split(",")[1];
            sdata.set("heatmaps/" + sdata.me, base64);
        });

        window.deletePDF = () => {
            sdata.set("pdf", null);
        }
    }



    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVATE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    

    async initialise(){
        await watchQuizes();
        await this.board.initialising;
        
        this.session.toolBar.addMenuItem("share", {
            name: "quiz",
            index: 270,
            onSelect: e => e.waitFor(this.session.openWindow("quiz"))
        })
        
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    static get layers() {
        return {
            board: {
                type: "area",
                area: "fullAspectArea",
                index: 80,
                mode: "occupy",
                name: "main",
            }
        }
    }
    
    static get name() {
        return "quiz";
    }

    static get firebaseName(){
        return "quiz";
    }
    
    static async loadResources(){
    
    }
}
