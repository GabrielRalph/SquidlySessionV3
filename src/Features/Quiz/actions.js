/**
 * @typedef {import("./quizzes.js").Quiz} Quiz
 */

/**
 * @typedef {Object} AnswerResponse
 * @property {number} question
 * @property {Array<number>} correct
 * @property {Array<number>} choosen
 * @property {number} score
 */

/**
 * @typedef {Object} QuizResults
 * @property {AnswerResponse[]} results_by_question
 * @property {ActionHistory} actions
 * @property {string} results_csv
 * @property {string} actions_csv
 * @property {number} total_score
 * @property {number} total_questions
 * @property {number} total_correct
 * @property {number} total_incorrect
 * @property {Quiz} quiz
 */

function numberOrNull(value) {
    return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function toString(value) {
    if (value === null || value === undefined) {
        return "-";
    } else if (typeof value === "number") {
        return value.toString();
    } else if (typeof value === "string") {
        return value;
    } else {
        throw new Error("Invalid value type: " + typeof value);
    }
}

function arrayToString(arr) {
    let str = "-"
    if (Array.isArray(arr) && arr.length > 0) {
        if (arr.length === 1) {
            str = arr[0] + ""
        } else {
            str = "{" + arr.map(a => a+"").join(",") + "}";
        }
    }
    return str;
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function toAnswerSet(answers) {
    return arrayToString(answers.map(a => letters[a]));
}




/**
 * @param {Array} choosen the list of answers chosen by the user
 * @param {Array} correct the list of correct answers
 * @param {number} total  the total number of answers available for the question
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

const ActionType2Letter = {
    next: "n",
    back: "b",
    close: "c",
    answer: "a"
}
const Letter2ActionType = {
    n: "next",
    b: "back",
    c: "close",
    a: "answer"
}
const Mode2Letter = {
    click: "C",
    switch: "S",
    dwell: "D",
    "-": "-"
}
const Letter2Mode = {
    C: "click",
    S: "switch",
    D: "dwell",
    "-": "-"
}
const User2Letter = {
    "-": "-",
    "participant": "P",
    "host": "H",
}
const Letter2User = {
    "-": "-",
    P: "participant",
    H: "host",
}

export class Action {

    /**
     * @type {("next"|"back"|"close"|"answer")}
     * @see {ActionType2Letter}
     */
    type = null;

    /**
     * @type {number}
     */
    value = null; // the value of the action, e.g. the answer selected

    /**
     * @type {number}
     */
    question = null; // the question associated with the action

    /**
     * @type {number[]}
     */
    answers = []; // the answers selected for that question after this action occurred

    /**
     * @type {number}
     */
    timestamp = null; // the timestamp of the action

    /**
     * @type {("click"|"switch"|"dwell")}
     * @see {Mode2Letter}
     */
    mode = "click"; // the mode of the action, e.g. "click", "keyboard", "dwell"

    /**
     * @type {("host"|"participant")}
     * @see {User2Letter}
     */
    user = "-"; // the user who performed the action, default is "-"

    /** 
     * @type {number}
     */
    time = 0; // the time of the action relative to the first action in the history, in milliseconds

    /**
     * @param {string} type
     * @param {number} value
     * @param {number} question
     * @param {Array<number>} answers
     * @param {("click"|"switch"|"dwell")} mode
     * @param {("host"|"participant")} user 
     */
    constructor(type, value, question, answers, mode = "click", user = "-") {
        if (type in Letter2ActionType) {
            type = Letter2ActionType[type]; // convert letter to full type
        }
        if (typeof type !== "string" || !(type in ActionType2Letter)) {
            throw new Error("Invalid action type: " + type);
        }

        if (mode in Letter2Mode) {
            mode = Letter2Mode[mode]; 
        } else if (!(mode in Mode2Letter)) {
            mode = "-";
        }

        if (user in Letter2User) {
            user = Letter2User[user]; 
        } else if (!(user in User2Letter)) {
            user = "-";
        }
            
        this.type = type; // "next" | "back" | "close" | "answer"
        this.value = numberOrNull(value); // the value of the action, e.g. the answer selected
        this.question = numberOrNull(question); // the question associated with the action
        this.answers = answers.map(numberOrNull).filter(n => n!=null); // the answers selected for that question after this action occurred
        this.timestamp = new Date().getTime(); // the timestamp of the action
        this.mode = mode; // the mode of the action, e.g. "click", "keyboard",
        this.user = user; // the user who performed the action, default is "-"
    }

    toString(){
        return [ActionType2Letter[this.type], toString(this.value), toString(this.question),  this.answers.join("|") , toString(this.timestamp), this.mode, this.user].join(",");
    }

    static fromString(str) {
        let [type, value, question, answers, timestamp, mode, user] = str.split(",");

        if (!(type in Letter2ActionType)) {
            throw new Error("Invalid action type: " + type);
        }

        value = value === "-" ? null : parseInt(value);
        question = question === "-" ? null : parseInt(question);
        answers = answers.split("|").map((a) => parseInt(a));
        timestamp = parseInt(timestamp);
        let action = new Action(type, value, question, answers, mode, user);
        action.timestamp = timestamp; // set the timestamp

        return action;
    }
}

export class ActionHistory extends Array {
    push(actions) {
        if (typeof actions === "string") {
            super.push(Action.fromString(actions));
        } else if (actions instanceof Action) {
            super.push(actions);
        }
    }

    toStringArray() {
        return this.map(action => action.toString());
    }

    get selectedAnswers() {
        let answers = {};
        for (let action of this) {
            answers[action.question] = [...action.answers];
        }
        return answers;
    }

    get questionTimes() {
        let times = {};
        this.sort((a, b) => a.timestamp - b.timestamp);
        
        for (let i = 0; i < this.length; i++) {
            let action = this[i];
            if (!(action.question in times)) {
                times[action.question] = 0;
            }
            if (i > 0) {
                times[action.question] += action.timestamp - this[i - 1].timestamp;
            }
        }

        return times;
    }

    getFirstTimestamp(question = 0) {
        this.sort((a, b) => a.timestamp - b.timestamp);

        let t0 = this[0]?.timestamp || 0;
        if (question !== null) {
            for (let action of this) {
                if (action.question === question) {
                    t0 = action.timestamp;
                    break;
                }
            }
        }
        return t0;
    }

    getFirstActionOf(question = 0) {
        this.sort((a, b) => a.timestamp - b.timestamp);
        
        let result = undefined;
        for (let i = 0; i < this.length; i++) {
            if (this[i].question === question) {
                result = i;
                break;
            }
        }

        return result;
    }

    getLastActionOf(question = 0) {
        this.sort((a, b) => a.timestamp - b.timestamp);
        
        let result = undefined;
        for (let i = 0; i < this.length; i++) {
            if (this[i].question === question) {
                result = i;
            }
        }
        return result;
    }

    static parse(obj) {
        let history;
        if (obj instanceof ActionHistory) {
            history = obj;
        } else {
            history = new ActionHistory();
            if (Array.isArray(obj)) {
                for (const action of obj) {
                    history.push(action);
                }
            } else if (typeof obj === "object" && obj !== null) {
                for (const action of Object.values(obj)) {
                    history.push(action);
                }
            }
        }

        // Sort the history by timestamp
        history.sort((a, b) => a.timestamp - b.timestamp);

        return history;
    }

    /**
     * @param {Quiz} quiz
     * @returns {QuizResults} results object containing the results of the quiz
     */
    getResults(quiz) {
        let lastAction = this.getFirstActionOf(quiz.questions.length);
        let filteredActions = this.slice(0, lastAction);
        let {selectedAnswers, questionTimes} = filteredActions;

        let results = []; 
        for (let i = 0; i < quiz.questions.length; i++) {
            let question = quiz.questions[i];

            let correct = question.answers.map((a, i) => a.correct ? i : null).filter(i => i !== null);
            let chosen = selectedAnswers[i] || [];
            let score = computeScore(chosen, correct, question.answers.length);

            results.push({
                question: i,
                correct: correct,
                chosen: chosen,
                score: score,
                time: questionTimes[i] || 0
            });
        }

        let t0 = this.getFirstTimestamp(-1);
        filteredActions.forEach(a => {
            a.time = a.timestamp - t0; // set the time of the action relative to the first action
        })
        

        let results_csv = `**Quiz Results**\nQuestion, Correct, Choosen, Score, Time Spent (s) \n${
            results.map(r => {
                return `Q${r.question + 1}, ${toAnswerSet(r.correct)}, ${toAnswerSet(r.chosen)}, ${r.score}, ${(r.time / 1000).toFixed(2)}`;
            }).join("\n")
        }`;

        let actions_csv = `**Quiz Actions**\nQuestion, Action, Time (s), Selected Answers, User, Mode\n${
            filteredActions.slice(1).map((a, i) => {
                return `Q${a.question + 1}, ${a.type}, ${(a.time / 1000).toFixed(2)}, ${toAnswerSet(a.answers)}, ${User2Letter[a.user]}, ${Mode2Letter[a.mode]}`;
            }).join("\n")
        }\n**Keys**\nInteraction Mode: C = Click, S = Switch, D = Dwell\nUser: P = Participant, H = Host\n`

        let total = results.map(a=>a.score).reduce((a,b)=>a+b)
        return {
            results_by_question: results,
            results_csv: results_csv,
            actions_csv: actions_csv,
            actions: filteredActions.slice(1), // exclude the first action which is usually the start of the quiz
            total_score: total,
            total_questions: quiz.questions.length,
            total_correct: results.filter(r => r.score > 0).length,
            total_incorrect: results.filter(r => r.score == 0).length,
            quiz: quiz
        };
    }
}
