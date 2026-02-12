
/**
 * @typedef {Object} Answer
 * @property {string} title
 * @property {string} subtitle
 * @property {?string} image
 * @property {boolean} correct
 * @property {?string} [utterance]
 * @property {string} color
 * 
 * 
 * @typedef {Object} Question
 * @property {string} question
 * @property {?string} [utterance]
 * @property {?string} image
 * @property {number} n_answers
 * @property {Answer[]} answers
 * 
 * 
 * @typedef {Object} Quiz
 * @property {string} name
 * @property {boolean} public
 * @property {number} n_questions
 * @property {Question[]} questions
 * @property {string} owner
 * @property {string} [ownerName]
 * @property {boolean} [owned]
 * @property {string} [qid]
 */


import { query, get, set, onChildAdded, onChildChanged, onChildRemoved, callFunction, child, ref, orderByChild, equalTo, getUID, onValue } from "../../Firebase/firebase.js"


const MAX_TITLE_LENGTH = 1024;
const MAX_MULTI_LENGTH = 4 * 1024;
const MAX_QUESTIONS = 50;
const MAX_ANSWERS = 9;
const COLORS = new Set([
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
    "dark-purple",
    "white"
])


const {isArray} = Array;
const isString = (s) => typeof s === "string";
const isValidString = (s, key, max, emptyAllowed = false) => {
    if (!isString(s)) {
        throw key + " was not of type string.";
    } else if (s.length == 0 && !emptyAllowed){
        throw key + " was left empty."
    } else  if (s.length > max) {
        throw key + " exceeds the maximum characters: " + max + ".";
    }
}

function quizesRef(...args){
    let r1 = ref("quizes");
    if (args.length > 0) {
        r1 = child(r1, args.join("/"));
    }
    return r1;
}
/** @type {Object<string, Quiz>} */
let QUIZES = {};
let DISPLAYNAMES = {};
let DATABASE_WATCHERS = [];
let updateCallbacks = [];
const ANSWER_VALIDATER = {
    title: (question) => {
        isValidString(question, "Title", MAX_TITLE_LENGTH);
        return question;
    },
    subtitle: (question) => {
        isValidString(question, "Subtitle", MAX_MULTI_LENGTH, true);
        return question;
    },
    image: (img) => {
        if (isString(img) && img.length > 0 && img.length < MAX_MULTI_LENGTH) {
            return img
        } else {
            return null;
        }
    },
    utterance: (utt) => {
        if (isString(utt) && utt.length > 0 && utt.length < MAX_MULTI_LENGTH) {
            return utt;
        } else {
            return null;
        }
    },
    color: (color) => {
        if (COLORS.has(color)) {
            return color;
        } else {
            throw "Not a valid color";
        }
    },
    correct: (pub) => {
        return !!pub;
    }
}
const QUESTION_VALIDATER = {
    question: (question) => {
        isValidString(question, "Question", MAX_MULTI_LENGTH);
        return question;
    },
    image: (img) => {
        if (isString(img) && img.length > 0 && img.length < MAX_MULTI_LENGTH) {
            return img
        } else {
            return null;
        }
    },
    utterance: (utt) => {
        if (isString(utt) && utt.length > 0 && utt.length < MAX_MULTI_LENGTH) {
            return utt;
        } else {
            return null;
        }
    },
    answers: (answers) => {
        if (!isArray(answers)) {
            throw "Answers is not an array."
        } else if (answers.length == 0) {
            throw "No answers."
        } else if (answers.length > MAX_ANSWERS) {
            throw "There are to many answers."
        } else { 
            return answers.map(q => validate(q, ANSWER_VALIDATER, "Answer"))
        }
    }
}
const QUIZ_VALIDATER = {
    name: (name) => {
        isValidString(name, "Name", MAX_TITLE_LENGTH)
        return name;
    },
    public: (pub) => {
        return !!pub;
    },
    questions: (questions) => {
        if (!isArray(questions)) {
            throw "Questions is not an array."
        } else if (questions.length == 0) {
            throw "No questions."
        } else if (questions.length > MAX_QUESTIONS) {
            throw "There are to many questions."
        } else { 
            return questions.map(q => validate(q, QUESTION_VALIDATER, "Question"))
        }
    },
    owner: () => {
        return getUID();
    }
}
function validate(data, validater, key = "Data") {
    if (typeof data !== "object" || data === null) throw key + " was not object."
    let newData = {}
    for (let key in validater) {
        newData[key] = validater[key](data[key], data);
    }
    return newData;
}

/**
 * @param {Quiz} quiz;
 * @return {Quiz}
 */
function validateQuiz(quiz) {
    return validate(quiz, QUIZ_VALIDATER);
}

async function callUpdates(){
    await getUserNames();
    for (let cb of updateCallbacks) cb();
}

async function getUserNames(){
    let users = new Set(Object.values(QUIZES).map(topic => topic.owner));
    let proms = [...users].filter(uid => !(uid in DISPLAYNAMES)).map(async uid => {
        let name = (await get(ref(`users/${uid}/info/displayName`))).val();
        if (name == null) {
            let first = (await get(ref(`users/${uid}/info/firstName`))).val();
            let last = (await get(ref(`users/${uid}/info/lastName`))).val();
            name = (first || "") + " " + (last || "");
        }
        DISPLAYNAMES[uid] = name;
        return name;
    })
    await Promise.all(proms);
    for (let key in QUIZES) {
        let topic = QUIZES[key];
        let name = DISPLAYNAMES[topic.owner];
        topic.ownerName = name;
    }
}



/**
 * @return {Answer}
 */
export function getEmptyAnswer(i){
    return {
        title: String.fromCharCode(65 + i),
        subtitle: "",
        correct: false,
        image: "",
        color: "white"
    }
}

/**
 * @return {Question}
 */
export function getEmptyQuestion(i, n = 4) {
    return {
        question: "Question " + (i+1),
        image: null,
        n_answers: n,
        answers: new Array(n).fill(0).map((a,i)=>getEmptyAnswer(i))
    }
}

/**
 * @return {Quiz}
 */
export function getEmptyQuiz(n = 4){
    return {
        name: "New Quiz",
        public: false,
        n_questions: n,
        questions: new Array(n).fill(0).map((a,i)=>getEmptyQuestion(i))
    }
}

/** Get's the chat gpt summary for the data in csv format.
 * @param {string} csv
 */
export async function getSummary(sid, progressCallback = null, onlySummary = false) {
    let callProgress = (status) => {
        if (progressCallback instanceof Function) {
            progressCallback(status);
        }
    }

    callProgress("Creating Report");


    let watchers = [];
    let result = await new Promise(async (resolve, reject) => {
        let summary = null;
        watchers = [
            onValue(ref("session-data/" + sid + "/quiz/proccessing"), (snapshot) => {
                if (snapshot.val()) {
                    callProgress("Summarising Quiz Results") 
                }
            }),
            onValue(ref("session-data/" + sid + "/quiz/summary"), (snapshot) => {
                summary = snapshot.val();
                if (summary) {
                    if (onlySummary) {
                        callProgress("Quiz Summary Ready");
                        resolve({
                            pdf: null,
                            errors: [],
                            summary: summary
                        });
                    } else {
                        callProgress("Formatting PDF Report");
                    }
                }
            })
        ]
        if (!onlySummary) {
            watchers.push(onValue(ref("session-data/" + sid + "/quiz/pdf"), (snapshot) => {
                let pdfBase64 = snapshot.val();
                if (pdfBase64) {
                    callProgress("PDF Report Ready");
                    resolve({
                        summary: summary,
                        pdf: pdfBase64,
                        errors: [],
                    })
                }
            }))
        }

        let res = await callFunction("quizzes-summarise", {sid: sid, onlySummary}, "australia-southeast1");
        if (res.data.errors.length > 0) {
            resolve({errors: res.data.errors, pdf: null, summary});
        }
    })
    for (let watcher of watchers) {
        watcher();
    }

    return result;
}

/** Saves a quiz to firebase, if quiz is invalid it will through an error.
 * @param {string} qid 
 * @param {Quiz} quiz
 */
export async function saveQuiz(qid, quiz) {
    let quizID = qid;
    try {
        quiz = validateQuiz(quiz);
        let {data} = await callFunction("quizzes-add", {qid, quiz}, "australia-southeast1")
        if (data.errors.length > 0) {
            console.log("An error occured whilst saving quiz.", data.errors);
        }
        quizID = data.quizID;
        
    } catch (e) {
    }
    return quizID;
}

/** Deletes a quiz from firebase
 * @param {string} qid 
 */
export async function deleteQuiz(qid) {
    await set(quizesRef(qid), null);
}

export function getQuiz(qid){
    let quiz = null;
    if (qid in QUIZES) {
        let quiz_master = QUIZES[qid];
        quiz = validateQuiz(quiz_master);
        quiz.n_questions = quiz.questions.length;
        quiz.questions.forEach(q => {
            q.n_answers = q.answers.length;
        })
        quiz.owned = getUID() == quiz.owner;
        quiz.ownerName = quiz_master.ownerName;
        quiz.qid = qid;
    }
    return quiz;
}

export function getAllQuizes(){
   return Object.keys(QUIZES).map(getQuiz);
}

/**
 * @param {function} callback
 * 
 * @return {function} unsubscriber
 */
export function addQuizUpdateListener(callback){
    if (callback instanceof Function) {
        updateCallbacks.push(callback)
        
        return () => {
            let update = [];
            for (let cb of updateCallbacks) {
                if (cb !== callback) {
                    update.push(cb)
                }
            }
            updateCallbacks = update;
        }
    }
}

/**
 * Initialises firebase and begins listening to updates 
 */
let init = false;
export async function watchQuizes(callback) {
    while (DATABASE_WATCHERS.length > 0) DATABASE_WATCHERS.pop()();
    QUIZES = {};
    let publicQuery = query(quizesRef(), orderByChild('public'), equalTo(true));
    let ownedQuery = query(quizesRef(), orderByChild('owner'), equalTo(getUID()));

    let proms = [["public", publicQuery], ["owned", ownedQuery]].map(async ([type, query]) => {
        let allQuizes = (await get(query)).val();
        for (let QID in allQuizes) QUIZES[QID] = allQuizes[QID];

        DATABASE_WATCHERS.push(onChildAdded(query, (snapshot) => {
            let QID = snapshot.key;
            let alreadyAdded = QID in QUIZES
            QUIZES[QID] = snapshot.val();
            if (!alreadyAdded) {
                callUpdates();
            }
        }));

        DATABASE_WATCHERS.push(onChildChanged(query, (snapshot) => {
            let QID = snapshot.key;
            QUIZES[QID] = snapshot.val();
            callUpdates();
        }));

        DATABASE_WATCHERS.push(onChildRemoved(query, (snapshot) => {
            let QID = snapshot.key;
            if (QID in QUIZES) {
                delete QUIZES[QID]
                callUpdates();
            }
        }));
    });
    await Promise.all(proms);
    await callUpdates();
    if (callback instanceof Function) await callback(user);
}

