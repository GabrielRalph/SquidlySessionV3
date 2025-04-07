
import {Answers, QuizView} from "./quiz-view.js"
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { Features } from "../features-interface.js";
import { getAllQuizes, watchQuizes } from "./quizzes.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { QuizResultsPage } from "./results.js";
import { callFunction } from "../../Firebase/firebase.js";
import { SvgPlus } from "../../SvgPlus/4.js";
import { AccessEvent } from "../../Utilities/access-buttons.js";

/** 
 * @typedef {Object} Action
 * @property {number} time
 * @property {("close"|"next"|"back"|"answer")} type
 * @property {number} value
 * @property {number} question
 * @property {number} duration
 * @property {number[]} answers
 */

/**
 * @typedef {import("./quizzes.js").Question} Question
 * @typedef {import("./quizzes.js").Quiz} Quiz
 * @typedef {import("./quizzes.js").Answer} Answer
 */


/**
 * @typedef {Object} QuizFeatureState
 * @property {boolean} isHome
 * @property {number} index
 * @property {Quiz} quiz
 * @property {string} quizID
 * @property {import("./quizzes.js").Action[]} actions
 */

function paginate(array, pageSize, emptyPage) {
    let pages = [];
    let page = [];
    for (let i = 0; i < array.length; i++) {
        page.push(array[i]);
        if (i > 0 && i % (pageSize-1) == 0) {
            pages.push(page)
            page = [];
        }
    }

    if (page.length > 0) {
        while (page.length < pageSize) {
            page.push(emptyPage)
        }
        pages.push(page)
    }
    return pages
}

function search(str, quizzes) {
    str = str.trim().toLowerCase();
    let filtered = new Array(quizzes.length).fill(true);
    if (str.length != 0) {
        filtered = quizzes.map(c => {
            let {name, ownerName} = c;
            name = name.trim().toLowerCase();
            ownerName = ownerName.trim().toLowerCase();
            return [
                name.indexOf(str) !== -1,
                str.indexOf(name) !== -1,
                ownerName.indexOf(str) !== -1,
                str.indexOf(ownerName) !== -1,
            ].reduce((a,b)=>a||b);
        })
    }
    return filtered;
}



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

    let action0 = actions.filter(a => a.question == -1).pop();
    let fActions = actions.filter(a => a.question >= 0 && a.question < quiz.questions.length);

    fActions.forEach((a, i)  => {

        a.duration = a.time - (i==0 ? action0.time : fActions[i-1].time);
    })

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
    let sel = fActions.map(a => a.answers.length == 0 ? "-" : "[" + a.answers + "]");

    
    let results_csv = cor.map((s, i) => `Q${i+1}, ${s}, ${cho[i]}`).join("\n");
    let actions_csv = fActions.map((s,i) => `Q${s.question + 1}, ${s.type}, ${Math.round(s.duration/ 10)/100}s, ${sel[i]}`).join("\n");
    let csv = `**Quiz Actions**\nquestion,action,response time (s), selected answers\n${actions_csv}\n\n**Quiz Results\nquestion, correct, choosen\n${results_csv}`;
    let total = answers.map(a=>a.score).reduce((a,b)=>a+b)
    return {actions: fActions, answers, csv, total};
}



class SQuizView extends QuizView {
    pageSize = 6;
    _locked = false;
    isFast = false;
    pages = [];
    quiz = null;
    actions = [];
    quizID = null;
    _index = 0;
    isHome = null;

    


    async onInteraction(type, value) {
        value = typeof value === "number" ? value : null;
        const action = {
            isHome: this.isHome,
            type, value,
            question: this.index,
            answers: this.selectedAnswers,
            time: (new Date()).getTime()
        }
        let valid = false;

        const event = new Event("interaction", {cancelable: true});
        event.data = action

        // push action if the quiz is running 
        if (!this.isHome && !this.locked) {
            this.actions.push(action)
        }

        // act on interaction
        if ((type == "back" || type == "next") && !(type == "back" && this.index == 0)) {
            this.index += type == "next" ? 1 : -1;
            valid = true;
        } else if (type == "answer") {

            // Selecting a quiz
            if (this.isHome) {
                let quiz = this.pages[this.index][value].quiz;
                this.startQuiz(quiz)
            
            // Begining the quiz
            } else if (this.index == -1) {
                this.index += 1;
            } else if (this.index == this.max) {
                this.downloadResults();
            }
            valid = true;

        } else if (type == "close") {

            if (this.isHome) {
                this.dispatchEvent(new Event("close"))

            } else {
                valid = true;
                if (await this.promt("Are you sure you want to exit?", "Exit", "Cancel")) {
                    this.closeQuiz();
                }
            }
        }


        this.dispatchEvent(event);
    }

    get choosenAnswers(){
        let choosen = new Array(this.max).fill(null).map(a => [])
        for (let {question, answers} of this.actions) {
            if (question >= 0) {
                choosen[question] = answers;
            }
        }
        return choosen;
    }

    downloadResults(){
        let {results} = this;
        results.summary = "help"
        console.log(results);
        console.log(JSON.stringify(results, null, '\t'));

        this.dispatchEvent(new Event("results", {bubbles: true}));
        
        // let res = new QuizResultsPage(this.quiz, results);
        // console.log(`let quiz = ${JSON.stringify(this.quiz)}\nlet results = ${JSON.stringify(results)}`)
        
        
    }

    get results(){
        return createResults(this.quiz, this.choosenAnswers, this.actions)
    }

    closeQuiz(){
        this.quizID = null;
        this.quiz = null;
        this.showHome();
    }

    startQuiz(quiz) {
        let quizID = quiz.qid;
        let actions = [];
        this.state = {
            isHome: false,
            index: -1,
            quizID, quiz, actions
        }
    }

    async showQuizResults(isFast){
        let {results} = this;
        this.info.titleValue = "Congratulations"
        this.info.content = `${results.total}/${this.max}`;
        let answers = [{
            title: `You scored \n${results.total} out of ${this.max}.  \n${Math.round(100 * results.total /this.max)}%`,
            subtitle: "Click here to download the comprehensive results.",
            color: "white",
            isAction: true
        }];
        this.locked = true;
        if (!isFast) {
            await this.transitionAnswers(answers, true)
        } else {
            this.answers = answers;
        }
    }

    showQuizStart(){
        this.actions = [];
        this.answers = [{title: this.quiz.name, subtitle: "Click here to begin", color: "white"}];
        this.info.progress = -1;
        this.info.titleValue = `${this.max} Questions`
        this.info.content = "Get ready to begin";
    }

    showHome() {
        console.log("showing home");
        
        this.isHome = true;
        this.locked = false;
        this.info.content = "input";
        let input = this.info.input;
        input.setAttribute("placeholder", "Search for quizes!")
        let a = () => {
            this.isFast = true;
            this.pages = this.getPages(input.value);
            this.index = 0;
        }
        input.addEventListener("input", a)
        a();
    }

    getPages(searchPhrase) {
        let quizzes  = getAllQuizes();

        /** @type {Answer[]} */
        let asAnswers = quizzes.map(q => {
            return {
                title: q.name,
                subtitle: q.ownerName,
                color: "white",
                correct: false,
                quiz: q,
            }
        })


        let res = search(searchPhrase, quizzes);
            
        asAnswers = asAnswers.filter((a, i) => res[i]);
        
        return asAnswers.length > 0 ? paginate(asAnswers, this.pageSize, {color: "empty"}) : [[]];
    }

    /** @param {QuizFeatureState} state*/
    set state(state) {
        
        let {isHome, index, quizID, quiz, actions, locked} = state;

        // Invalid state
        if ((!isHome && !quiz)) return;

        this.actions = actions ? Object.values(actions) : [];
        this.locked = locked;

        // Change from home to quiz or instant change of quiz. 
        if (this.isHome !== isHome || (!isHome && quizID != this.quizID)) {
            this.isFast = true;
            this.isHome = isHome;
            if (!isHome) {
                this.quiz = quiz;
                this.quizID = quizID;
                this.quizAnswers = quiz.questions.map(q => new Answers(q.answers));
            } else {
                this.showHome();
            }
        } 

        this.index = index;
    }

    /** @returns {Question[]} */
    get questions(){
        if (this.quiz) {
            return this.quiz.questions;
        }
    }

    /** @param {number} i */
    set index(i){
        let {max, isFast, isHome} = this;
        this.isFast = false;


        // There has been a change
        if (isFast || i !== this.index) {

            // The change is valid
            if (isHome ? (i >= 0 && i < max) : (i >= -1 && i <= max)) {
                this.info.max = max;
                this.info.titlePrefix = isHome ? "Pages" : "Question";

                // Update icons
                this.next.header = !isHome && i == this.max-1 && !this.locked ? "Submit" : "Next";
                this.next.toggleAttribute("disable", i == (this.max-(isHome ? 1 : 0)));
                this.back.toggleAttribute("disable", i <= 0);
                this.close.header = isHome ? "Close" : "Exit"

                if (i == -1) {
                    this.showQuizStart();
                } else if (i == max) {
                    this.showQuizResults(isFast);
                } else {
                    // Transition to choosen answer
                    let answers = isHome ? this.pages[i] : this.quizAnswers[i];
                    if (isFast) {
                        this.answers = answers;
                    } else {
                        this.transitionAnswers(answers, i>this.index, !isHome ? this.choosenAnswers[i] : null);
                    }

                    // Display quiz info
                    if (!isHome) {
                        this.info.content = this.questions[i];
                    }
                    this.info.progress = i;
                }
                // Update current index
                this._index = i;
            }

        // Update selected answers if no change to question index
        } else if (!this.isHome && this.index >= 0 && this.index < this.max) {
            this.quizAnswers[this.index].selected = this.choosenAnswers[this.index];
        }

    }

    /** @return {number} */
    get index(){
        return this._index;
    }

    /** @return {number} */
    get max(){
        return this.isHome ? this.pages.length : this.questions.length;
    }

    /** @param {boolean} bool */
    set locked(bool){
        this.toggleAttribute("locked", !!bool);
        this._locked = !!bool;
    }
    /** @return {boolean} */
    get locked(){
        return this._locked;
    }
   
}

/**
 * @param {Action} action
 */
function serialise_action(action) {
    let value = -1;
    if ("value" in action) {
        value = action.value;
    }
    
    let answers = action.answers;
    let answerInt = 0;
    for (let i of answers) answerInt += 1 << i;

    let str = [action.type, action.time, action.question, value, answerInt].join(",");
    return str;
}

function deserialise_action(action) {
    let [type, time, question, value, answerInt] = action.split(",");
    time = parseInt(time);
    value = parseInt(value);
    value = value == -1 ? null : value;
    question = parseInt(question);
    answerInt = parseInt(answerInt);
    let answers = [];
    for (let i = 0; i < 10; i++) {
        if (answerInt >> i & 1 !== 0) {
            answers.push(i);
        }
    }
    return {type, time, value, question, answers}
}


class QuizWindow extends ShadowElement {
    /** @type {import("../features-interface.js").SessionDataFrame} */
    sdata = null;


    /** @param {import("../features-interface.js").SessionDataFrame} sdata */
    constructor(feature, sdata){
        super("quiz-feature");
        this.quizView = new SQuizView(sdata);
        this.appendChild(this.quizView);

        this.sdata = sdata;
    }

    async initialise(){
        let {quizView, sdata} = this;
        this.quizView.addEventListener("interaction", (e) => {
            if (quizView.isHome) {
                sdata.set("state", {isHome: true})
            } else {
                sdata.update("state", {
                    isHome: false,
                    quiz: quizView.quiz,
                    quizID: quizView.quizID,
                    index: quizView.index,
                    locked: quizView.locked,
                })
                let key = sdata.push("state/actions");
                
                if (!e.data.isHome && !quizView.locked) {
                    sdata.set("state/actions/"+key, serialise_action(e.data))
                }
            }
        })
        return new Promise((r) => {
            sdata.onValue("state", (data) => {
                this.onStateValue(data);
                r();
            } )
        })


    }

    /**
     * @param {QuizFeatureState} state
     */
    onStateValue(state) {

        if (state == null || !state.isHome && !state.quiz) {
            state = {
                isHome: true,
                index: 0,
            }
            this.sdata.set("state", state);
        }

        if ("actions" in state) {
            state.actions = Object.values(state.actions).map(deserialise_action);
        }
        
        this.quizView.state = state;
    }


  
    static get usedStyleSheets(){
        return [
             relURL("/quiz.css", import.meta),
             relURL("/quiz-view.css", import.meta)
            ]
    }
}

export class QuizFeature  extends Features {
    constructor(sesh, sdata) {
        super(sesh, sdata);
        this.board = new QuizWindow(this, sdata);
        this.board.root.addEventListener("results", async () => {
            // let sid = this.sdata.sid;
            // let data = await callFunction("quizzes-report", {sid}, "australia-southeast1");
            // console.log(data);
            // let pdf = await sdata.get('pdf');
            // let a = new SvgPlus("a");
            // a.props={
            //     href: "data:application/octet-stream;base64," + pdf,
            //     download: "Results.pdf"
            // }
            // a.click();
            
            
        })
        this.board.quizView.addEventListener("close", () => {
            this.close();
        })
        this.session.toolBar.addSelectionListener("quiz", (e) => {
            this.open(e);
        })
    }



    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    

    open(e){
        let p = this.session.toolBar.toggleToolBar(false);
        this.board.root.toggleAttribute("shown", true);
        this.session.toolBar.toolbarFixed = true;
        this.sdata.set("open", true);
        if (e instanceof AccessEvent) {
            e.waitFor(Promise.all([
                p,
                new Promise((r) => setTimeout(r, 550))
            ]))
        }
    }

    close(){
        this.board.root.toggleAttribute("shown", false);
        if (this.session.accessControl.isSwitching) {
            this.session.accessControl.restartSwitching();
            this.session.toolBar.toggleToolBar(true);
        } else {
            this.session.toolBar.toolbarFixed = false;
        }
        this.sdata.set("open", false);
    }


    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVATE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    

    async initialise(){
        await watchQuizes();
        await this.board.initialise();
        this.sdata.onValue("open", (isOpen) => {
            if (isOpen === true) this.open();
            else if (isOpen === false) this.close();
        })

    }

    static get firebaseName(){
        return "quiz";
    }
    
    static async loadResources(){
    
    }
}
