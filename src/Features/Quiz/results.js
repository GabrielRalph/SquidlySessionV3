/**
 * @typedef {import("./test.js").Question} Question
 * @typedef {import("./test.js").Quiz} Quiz
 * @typedef {import("./test.js").Answer} Answer
 * @typedef {import("./actions.js").Action} Action
 * @typedef {import("./actions.js").AnswerResult} AnswerResult
 * @typedef {import("./actions.js").QuizResults} QuizResults
 */

const TEMPLATE = `
\\documentclass[12pt]{article}
\\usepackage[a4paper, left=1.5cm, right=1.5cm, top=1.5cm, bottom=1.5cm]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage{mathptmx}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{xcolor}
\\usepackage{amsfonts}
\\usepackage{graphicx}
\\usepackage{subcaption}
\\usepackage{listings}
\\usepackage{multicol}
\\usepackage{pgfplots}

\\usepackage{charter}


\\newcommand{\\mat}[1]{\\ensuremath{\\begin{pmatrix}#1\\end{pmatrix}}}
\\newcommand{\\mycirc}[1][black]{{\\Large\\textcolor{#1}{\\ensuremath\\bullet}}}
\\renewcommand{\\theenumi}{\\Alph{enumi}}
\\pgfplotsset{compat=1.8}
\\usepgfplotslibrary{statistics}

\\begin{document}
\\centerline{ \\huge \\bfseries |||QUIZ_NAME||| results}

\\centerline{ \\large  Quiz Author:|||QUIZ_CREATOR|||}

\\section*{Quiz Questions}
    \\begin{multicols}{2}
        |||QUIZ|||
    \\end{multicols}

    \\section*{Actions}
    Actions represent interactions with buttons on the quiz board. Each row in the table below represents an action. The columns of the actions table describe the following properties of an action:
    \\begin{itemize}
        \\item {\\bf Type} The type of button used either an answer or navigation button i.e. back or next.
        \\item {\\bf Chosen} The set of selected answers after the interaction.
        \\item {\\bf Time} The time since the quiz was started.
        \\item {\\bf Mode} The method of interaction used either:
        \\begin{itemize}
            \\item {\\bf Click} using the mouse cursor.
            \\item {\\bf Switch} using switch access.
            \\item {\\bf Dwell} using eye gaze dwell click.
        \\end{itemize}
        \\item {\\bf User} The user who made the interaction.
    \\end{itemize}
    |||ACTIONS|||
    \\section*{Results}
    The final results are shown in the table below. A score of 1 is awarded if the chosen answer is the same as the correct answer, or if there are no correct answers. Questions with multiple correct answers are scored based on the formula:
    $$\\text{score} = \\cfrac{\\text{\\# correct choices}}{\\text{\\# correct answers}} - \\cfrac{\\# \\text{incorrect choices}}{\\# \\text{incorrect answers}}$$
    and if all answers are correct 
    $$\\text{score} = \\cfrac{\\text{\\# chosen}}{\\text{\\# answers}}.$$
    The total score was \\textbf{|||TOTAL_SCORE|||} out of \\textbf{|||TOTAL_QUESTIONS|||} questions with an accuracy of \\textbf{|||ACCURACY|||\\%}.
    |||RESULTS|||
    \\section*{Data Visualisation}
    \\begin{multicols}{2}
        \\subsection*{Total Time per Question}
        |||TIME|||
        |||SCORE_VS_TIME|||
    \\end{multicols}
    |||SUMMARY|||
\\end{document}
`
function markup2latex(text) {
    // replace single dollar signs with literal dollar signs
    text = text.replace(/(?:[^\$])\$(?:[^\$])/g, "\\$");

    // replace double dollar signs with single dollar signs
    text = text.replace(/\$\$/g, "$");

    // replace markdown bold syntax with LaTeX bold syntax
    text = text.replace(/\*\*(.*?)\*\*/g, "\\textbf{$1}");

    // replace markdown italic syntax with LaTeX italic syntax
    text = text.replace(/\*(.*?)\*/g, "\\textit{$1}");

    // replace markdown bold italic syntax with LaTeX bold italic syntax
    text = text.replace(/\*\*\*(.*?)\*\*\*/g, "\\textbf{\\textit{$1}}");

    return text;
}

function fAnswer(num) {
    if (Array.isArray(num)) return num.map(fAnswer).join(", ")
    return (typeof num !== "number" || Number.isNaN(num)) ? "-" : "ABCDEFGHIJKLMN"[num];
}
const actionKeys = [
    {
        key: "question",
        title: "Question",
        format: d => `Q${d+1}`
    },
    {
        key: "type",
        title: "Action",
    },
    {
        key: "time", 
        title: "Time",
        subtitle: "time (s)",
        format: (d) => Math.round(d/10)/100
    },
    {
        key: "answers",
        title: "Chosen",
        subtitle: "answers",
        format: fAnswer
    },
    {
        key: "mode",
        title: "Mode",
    },
    {
        key: "user",
        title: "User",
    }
]

const resultsKeys = [
    {
        key: "question",
        title: "Question",
        format: d => `Q${d+1}`
    },
    {
        key: "correct",
        title: "Correct",
        format: fAnswer
    },
    {
        key: "chosen",
        title: "Chosen",
        format: fAnswer
    },
    {
        key: "score",
        title: "Score",
    },
    {
        key: "time",
        title: "Duration",
        subtitle: "time (s)",
        format: (d) => (d/1000).toFixed(2)
    }
]

function pgfBarPlot(data, xlabel) {
    return `\\begin{tikzpicture}
\\begin{axis}[
xbar,
y=-0.7cm,
xmax=${Math.max(...data.map(r=>r[0])) * 1.2},
bar width=0.5cm,
enlarge y limits={abs=0.75cm},
xlabel={${xlabel}},
symbolic y coords={${data.map(r => r[1]).join(",")}},
ytick=data,
nodes near coords, nodes near coords align={horizontal},
]
\\addplot coordinates {${data.map(r => `(${r})`).join(" ")}};
\\end{axis}
\\end{tikzpicture}`
}

function texTable(objArr, keys) {
    let sub = keys.map(k => "subtitle" in k).reduce((a,b) => a||b)
    keys = keys.map(k => {
        if (!(k.format instanceof Function)) k.format = (t) => t;
        if (!k.subtitle) k.subtitle = "";
        return k;
    })
    let cellLayout = "|"+keys.map(a => 'c').join("|")+"|"
    let contents = 
        "\\hline\n" + 
        keys.map(k => `{\\bf ${k.title}}`).join(" & ") + 
       (sub ? "\\\\\n" +keys.map(k => k.subtitle).join(" & ") : "") +
        "\\\\\n\\hline\n" + 
        objArr.map(obj => keys.map(k => k.format(obj[k.key])).join(" & ")).join("\\\\\n\\hline\n") + 
        "\\\\ \\hline"

    return `
    \\begin{center}
    \\begin{tabular}{ ${cellLayout} } 
    ${contents}
    \\end{tabular}
    \\end{center}`
}

function getP(data, p) {
    let i = p * (data.length - 1)
    let h_i = Math.ceil(i);
    let l_i = Math.floor(i);

    let t = i - l_i;

    return  data[l_i] * (1 -t) + data[h_i] * t;
}

function boxPlot(data, keys, colors = ["red", "green"]) {
    let coords = data.map((col, i) => col.map(e => `(${i}, ${e})`).join(" "));

    return `
\\begin{tikzpicture}
  \\begin{axis}
    [ylabel = {Time (s)},
    boxplot/draw direction=y,
    xtick={${keys.map((k,i)=>i+1)}},
    xticklabel style = {align=center, font=\\small, rotate=60},
    xticklabels={${keys.join(", ")}},
    ]   
    ${
        data.map((col, i) => {
            let colS = [...col].sort((a, b) => a-b)
            const Q_1 = getP(colS, 0.25);
            const Q_3 = getP(colS, 0.75);
            let high_w = 2.5 * Q_3 - Q_1 * 1.5;
            let low_w = 2.5 * Q_1 - Q_3 * 1.5;
            low_w = low_w < 0 ? 0 : low_w;

            return `\\addplot+[mark = *, mark options = {${colors[i]}},
                boxplot prepared={
                    lower whisker=${low_w.toPrecision(3)},
                    lower quartile=${Q_1},
                    median=${getP(colS, 0.5)},
                    upper quartile=${Q_3},
                    upper whisker=${high_w.toPrecision(3)}
                }, color = ${colors[i]}
            ] coordinates{${coords[i]}};`
        })
    }
        
    \\end{axis}
\\end{tikzpicture}`
}

function toScatter(data) {
    let max = Math.max(...data.map(d => d[1]));
    let min = Math.min(...data.map(d => d[1]));
    let dy = max - min;
    return `\\begin{tikzpicture}
            \\begin{axis}[
                enlargelimits=false,
                xmin=-0.5,
                xmax=1.5,
                ymax=${max + dy/10},
                ymin=${min - dy/10}
            ]
            \\addplot+ [
            only marks,
            scatter,
            mark size=2pt,
            ]
            table [meta=label] {
            x y label
            ${data.map(row => row.join(" ")).join("\n")}
            };
            \\end{axis}
            \\end{tikzpicture}`
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const letters_lower = letters.toLowerCase();
function isTitleValid(title, i) {
    if (title == letters[i] || title == letters_lower[i] || title == i+"") return false;
    return true;
}
function toAnswerString(answer, i, choosen) {
    let values = []
    if (isTitleValid(answer.title, i)) {
        values.push(markup2latex(answer.title));
    }
    if (answer.subtitle) {
        values.push((values.length > 0 ? ", " : "") + markup2latex(answer.subtitle));
    }

    if (answer.correct === true) {
        values.push("\\mycirc[green]");
    }

    if (choosen && choosen.has(i)) {
        values.push("\\mycirc[blue]");
    }

    values.unshift(`\\item`);

    return values.join(" ");
}
    


/**
 * @type {Object<string, (QuizResults) => string>}
 */
const TABLES = {
    /** @param {QuizResults} data */
    "ACTIONS": (data) => {
        return texTable(data.actions, actionKeys)
    },

    "TOTAL_SCORE": (data) => {
        let score = data.results_by_question.reduce((a, b) => a + b.score, 0)
        let isInt = score % 1 < 0.01;
        return isInt ? Math.round(score) : score.toFixed(2);
    },

    "TOTAL_QUESTIONS": (data) => {
        return data.results_by_question.length;
    },

    "ACCURACY": (data) => {
        let correct = data.results_by_question.reduce((a, b) => a + b.score, 0)
        let total = data.results_by_question.length;
        return total == 0 ? "0" : Math.round(100 * correct / total);
    },

    /** @param {QuizResults} data */
    "RESULTS": (data) => {
        return texTable(data.results_by_question, resultsKeys)
    },

    /** @param {QuizResults} data */
    "TIME": (data) => {
        let coords = data.results_by_question.map((a,i) => [(a.time / 1000).toPrecision(3), "Q"+(i+1)])
        return pgfBarPlot(coords, "Time (s)")
    },

    /** @param {QuizResults} data */
    "SCORE_VS_TIME": (data) => {
        let correct = [[], []];
        data.results_by_question.map(a => correct[Math.floor(a.score)].push(a.time/1000));
        let res =  `
        \\subsection*{Response Time vs Accuracy}
            ${boxPlot(correct, ["incorrect", "correct"])}
        `
        if (correct[0].length == 0 || correct[1].length == 0) res = ""
        return res;
    },

    /** @param {QuizResults} data */
    "QUIZ_NAME": (data) => {
        return data.quiz.name
    },

    /** @param {QuizResults} data */
    "QUIZ_CREATOR": (data) => {
        return data.quiz.ownerName
    },

    /** @param {QuizResults} data */
    "QUIZ": (data) => {
        let cSet = data.results_by_question.map(a => new Set(a.chosen));
        return `
        \\begin{description}
            ${
                data.quiz.questions.map((q, i) => 
                    `\\item[Q${i+1}] ${markup2latex(q.question)} \n ${
                        `
                        \\begin{enumerate}
                            ${q.answers.map((a,j) => toAnswerString(a, j, cSet[i])).join("\n")}
                        \\end{enumerate}
                        `
                }`
                ).join("\n")
            }
        \\end{description}`
    },

    "SUMMARY": (data) => {
        if (!data.summary) return "";
       
        return " \\section*{AI Summary}" + data.summary;
    }
}


/**
 * @param {QuizResults} results
 * @return {string}
 * */
export function formatReport(results) {
    return TEMPLATE.replace(/\|\|\|(\w+)\|\|\|/g, (a, b) => {
        if (b in TABLES) return TABLES[b](results)
    })
}
