import { SvgPlus, Vector } from "../../SvgPlus/4.js";
// import * as showdown from "https://unpkg.com/showdown/dist/showdown.min.js";
import markdownIt from 'https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/+esm'
import { MarkdownElement } from "./markdown.js";
// console.log(showdown);
/**
 * @typedef {import("../Firebase/quizzes.js").Answer} Answer
 * @typedef {import("../Firebase/quizzes.js").Question} Question
 * @typedef {import("../Firebase/quizzes.js").Quiz} Quiz
 * @typedef {import("../Firebase/quizzes.js").Action} Action
 * @typedef {import("../Firebase/quizzes.js").QuizResults} QuizResults
 * @typedef {import("../Firebase/quizzes.js").AnswerResponse} AnswerResponse
 */


function findBestTickInterval(minValue, maxValue, minInterval) {
    if (minValue >= maxValue) {
        throw new Error("minValue must be less than maxValue");
    }
    
    const range = maxValue - minValue;
    const roughInterval = range / 10; // Aim for around 10 ticks
    let bestInterval = Math.max(roughInterval, minInterval);
    
    // Choose a nice round number for the interval (1, 2, 5, 10, etc.)
    const niceNumbers = [1, 2, 5, 10];
    const magnitude = Math.pow(10, Math.floor(Math.log10(bestInterval)));
    
    bestInterval = niceNumbers.find(n => n * magnitude >= bestInterval) * magnitude;
    
    return bestInterval;
}

class BarGraph extends SvgPlus {
    padding = 10;
    padding2 = 15;
    size = new Vector(300, 200)
    fontSize = 16;
    fontSize2 = 20;
    constructor(data, xaxis, yaxis) {
        super("svg") 
        this.x_axis = xaxis;
        this.y_axis = yaxis;
        let {padding, size, fontSize} = this;
        let x_labels = Object.keys(data).slice(0, 18);
        let tickScale = Math.min(16*0.07+1 - 0.07 * x_labels.length, 1)
        
        let y_vals = x_labels.map(k => data[k]);
        let bar_width = (size.x - (x_labels.length + 1) * padding) / x_labels.length;

        let max_val = Math.max(...y_vals);
        let scale = (size.y - padding) / max_val;

        let scaled_y_vals = y_vals.map(y => y * scale);

        let min_y_dist = fontSize * 1.5 / scale;


        let bars = scaled_y_vals.map((y, i) => {
            let x = padding + (bar_width + padding) * i;
            this.createChild("rect", {
                x, y: size.y - y, width: bar_width, height: y
            });
        })

        this.createChild("path", {class: "axis", d: `M0,0v${size.y}h${size.x}`});

        x_labels.forEach((tick, i) => {
            this.createChild("text", {
                content: tick,
                x: padding + (bar_width + padding) * i + bar_width / 2,
                y: size.y + padding + fontSize * 0.4,
                "font-size": fontSize * tickScale,
                "text-anchor": "middle"
            })
        })


        let y_tick_intv = findBestTickInterval(0, max_val, min_y_dist);
        let y_tick_intv_s = y_tick_intv * scale;
        let n_yt = Math.floor(size.y / y_tick_intv_s) + 1;
        console.log(n_yt);
        
        for (let i = 1; i < n_yt; i++) {
            let y = size.y - i * y_tick_intv_s;
            this.createChild("path", {
                d: `M0,${y}h-${padding}`,
                class: "axis"
            })
            this.createChild("text", {
                content: (i * y_tick_intv).toPrecision(2),
                "font-size": 20,
                x: -padding * 1.5,
                y: y + fontSize * 0.3,
                "font-size": fontSize,
                "text-anchor": "end"
            })
        }

        this.resize();
    }

    async resize(){
        await new Promise((r) => window.requestAnimationFrame(r))
        let [pos0,size0] = this.svgBBox;
        this.createChild("text", {
            "font-size": this.fontSize2,
            content: this.x_axis,
            y: pos0.y + size0.y + this.padding2 + this.fontSize2 * 0.3,
            x: this.size.x/2,
            "text-anchor": "middle"
        })
        this.createChild("text", {
            "font-size": this.fontSize2,
            content: this.y_axis,
            y: this.fontSize2 * 0.3,
            x: 0,
            "text-anchor": "middle",
            transform: `translate(${pos0.x - this.padding2}, ${this.size.y/2}) rotate(-90) `
        })
        await new Promise((r) => window.requestAnimationFrame(r))
        let [pos,size] = this.svgBBox;
        size = size.add(this.padding*2);
        pos = pos.sub(this.padding);
        this.props = {viewBox: `${pos.x} ${pos.y} ${size.x} ${size.y}`}
    }
}

class QuizList extends SvgPlus{
    /** @param {Quiz} quiz */
    constructor(quiz) {
        super("div")

        quiz.questions.map((q, i) => {
            let r = this.createChild("div", {class: " q-title"})
            r.createChild("h4", {content: `Q${i+1}:`});
            r.createChild(MarkdownElement, {}, "div", q.question, true);
            let l = this.createChild("ol");
            q.answers.map(a => {
                l.createChild("li", {content: a.title}).toggleAttribute("correct", a.correct)
            })
        })
    }
}

const answersKeys = {
    "question": {
        title: "Question",
        format: d => `Q${d+1}`
    },
    "choosen": {
        title: "Choosen",
    },
    "correct": {
        title: "Correct",
    },
}

const actionKeys = {
    "question": {
        title: "Question",
        format: d => `Q${d+1}`
    },
    "type": {
        title: "Action",
    },
    "duration": {
        title: "Response<br>time (s)",
        format: (d) => Math.round(d/10)/100
    },
    "answers": {
        title: "Selected<br>answers"
    }
}

class Table extends SvgPlus {
    constructor(actions, keyType) {
        super("table");
        let head = this.createChild("thead");
        let tr = head.createChild("tr")
        let keys = Object.keys(keyType)
        keys.map(k => tr.createChild("th", {content: keyType[k].title}));

        let body = this.createChild("tbody");
        actions.map(e => {
            let tr0 = body.createChild("tr");
            keys.map(k => {
                let val = e[k];
                if (keyType[k].format) val = keyType[k].format(val);
                tr0.createChild("td", {content: val});
            })
        })
    }
}

export class QuizResultsPage extends SvgPlus {
    /** 
     * @param {Quiz} quiz 
     * @param {QuizResults} results 
     * */
    constructor(quiz, results) {
        super("div")
        this.createChild("h1", {content: quiz.name + " Results"})
        let main = this.createChild("div", {class: "results"})
        this.main = main;

        this.createSection("Quiz Questions")
            .createChild(QuizList, {}, quiz);


        this.createSection("Responses")
            .createChild(Table, {}, results.actions, actionKeys);

        this.createSection("Answers")
            .createChild(Table, {}, results.answers, answersKeys);

        let time = {};
        results.actions.forEach((a, i) => {
            let key = a.question + 1;
            if (!(key in time)) time[key] = 0;
            time[key] += a.duration / 1000;
        })
        this.createSection("Plots")
            .createChild(BarGraph, {}, time, "Question", "Response Time (s)");

        let md = new markdownIt();
        const result = md.render(results.summary);
        let div = new SvgPlus("div");
        div.innerHTML = result;

        let section = []
        let i =0;
        
        for (let child of [...div.children]) {
            
            if (section.length == 0 || child.tagName !== "H3") section.push(child);
            else {
                let s;
                if (i == 0) {
                    s = this.createSection("AI Insights");
                    i = 1;
                } else {
                    s = main.createChild("div", {class:"section"});
                }
                for (let el of section) s.appendChild(el);
                section = [child];
            }
        }
        let s;
        if (i == 0) {
            s = this.createSection("AI Insights");
            i = 1;
        } else {
            s = main.createChild("div", {class:"section"});
        }
        for (let el of section) s.appendChild(el);

    }

    createSection(name, cname = "") {
        let section = this.main.createChild("div", {class: "section "+cname});
        section.createChild("h2", {content: name});
        return section
    }

}