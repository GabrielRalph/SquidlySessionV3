import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { HideShow } from "../../Utilities/hide-show.js";
import { BasePointer, SvgResize } from "../../Utilities/svg-resize.js";
import * as Algorithm from "./Algorithm/index.js"
import { linspace } from "./Algorithm/Utils/other.js";

/**
 * @typedef {Object} CalibrationSequence
 * @property {"scan"|"grid"} type
 * @property {Number} size
 * @property {Number} time
 * @property {Number} count
 * @property {string} label
 * @property {CalibrationSequence[]} [sequences]
 */

async function delay(ms) {
    if (!ms) return new Promise(requestAnimationFrame)
    return new Promise((r) => setTimeout(r, ms))
}
async function waitForClick() {
	return new Promise((resolve, reject) => {
		let end = () => {
			window.removeEventListener("click", end);
			resolve();
		}
		window.addEventListener("click", end);
	});
}



class CSeq {
	constructor(cs) {
		for (let k in cs) {
			this[k] = cs[k]
		}
	}

	/** @return {Number} */
	get duration() {
		return this.getDuration();
	}

	/** 
	 * @param {CalibrationSequence} cs 
	 * @return {Number}
	 * */
	getDuration() {
		return this.time;
	}

	/** 
	 * @param {Number} t
	 * @param {CalibrationSequence} cs
	 * 
	 * @return {Vector}
	 */
	getPointAtTime(t, cs = this.cs) {
		return null;
	}


	getStateAtTime(){
		return {
			point: this.getPointAtTime(cs),

		}
	}
}
class CSList extends CSeq{
	// /** @type {CSeq[]} */
	// sequences = [];

	constructor(cs) {
		super(cs);
		this.sequences = this.sequences.map(makeCSeq);
	}

	/**
	 *  @param {Number} t 
	 *  @return {[Number, CSeq]}
	 * */
	getSquenceAtTime(t) {
		let {sequences} = this;
		let tx = 0;
		let res = null;
		
		for (let cs of sequences) {
			let nextT = tx + cs.duration;
			if (t < nextT) {
				res = [t-tx, cs]; 
				break;
			}	
			tx = nextT;
		}
		return res;
	}


	/** 
	 * @param {Number} t
	 * @return {Vector}
	 */
	getPointAtTime(t) {
		let point = null;
		let res = this.getSquenceAtTime(t);
		
		if (res !== null) {
			let [tx, cs] = res;
			point = cs.getPointAtTime(tx);
		}
		return point;
	}

	getDuration() {
		let ts = this.sequences.map(cs => cs.duration)
		return ts.reduce((t1, t2) => t1+t2)
	}	
}

const CSeqs = {
	
	list: CSList,
	wait: class CSWait extends CSeq {
		getPointAtTime(t) {
			return new Vector();
		}
	},
	pulse: class CSPulse extends CSeq {
		getPointAtTime(t) {
			t = t / this.duration;
			let p = new Vector(this.x, this.y);
			let lin = t < 0.5 ? 1 - t/0.5 : (t - 0.5) / 0.5;
			p.size = (lin*0.9 + 0.1)**0.5
			if (p.size < 1e-10) p.size = 1e-10;
			p.recording = true;
			return p;
		}
	},
	fade: class CSFade extends CSeq {
		getPointAtTime(t) {
			t = t / this.duration;
			let p = new Vector(this.x, this.y);
			let wave =( 1 + Math.cos(t * Math.PI)) / 2;
			if (this.direction == "in") wave = 1 -wave;
			p.opacity = wave;
			return p;
		}
	},
	move: class CSPulse extends CSeq {
		getPointAtTime(t) {
			t = t / this.duration;

			let start = new Vector(this.startX, this.startY);
			let end = new Vector(this.endX, this.endY);
			let p = start.mul(1 - t).add(end.mul(t));
			p.recording = true;
			return p;
		}
	},
	grid: class CSGrid extends CSList{
		constructor(cs) {
			let {size, time} = cs;
			let ncs = {
				type: "grid",
				sequences: new Array(size**2).fill(0).map((_,i) => {
					let x = (i % size) / (size - 1);
					let y = Math.floor(i / size) / (size - 1);
					return {x,y,time,type:"pulse"}
				})
			}
			super(ncs);
			console.log(this.sequences);
			
		}
	},
	scanX: class CSGrid extends CSList{
		constructor(cs) {
			let {size, scanTime, pulseTime} = cs;
			let ncs = {
				type: "scanX",
				sequences: new Array(size).fill(0).flatMap((_,i) => {
					let y = i / (size - 1);
					return [
						{
							x: 0,
							y: y,
							direction: "in",
							time: pulseTime,
							type: "fade",
						},
						{
							startX: 0, 
							endX: 1,
							startY: y, 
							endY: y,
							time: scanTime,
							type:"move"
						},
						{
							x: 1,
							y: y,
							time: pulseTime,
							type: "pulse"
						},
						{
							x: 1,
							y: y,
							direction: "out",
							time: pulseTime,
							type: "fade",
						},
					]
				})
			}
			super(ncs);
		}
	}, 
	zigzag: class CSGrid extends CSList{
		constructor(cs) {
			let {size, scanTime, pulseTime} = cs;
			let segTime = scanTime / (size-1);
			let diagTime = scanTime * (1 + (1/size)**2)**0.5
			let ncs = {
				type: "zigzag",
				sequences: [
					{
						x: 0,
						y: 0,
						time: pulseTime,
						direction: "in",
						type: "fade"
					},
					...new Array(size).fill(0).flatMap((_,i) => {
						let y = i / (size - 1);
						let segs = [
							{
								x: 0,
								y: y,
								time: pulseTime,
								type: "pulse"
							},
							...new Array(size-1).fill(0).flatMap((q, j) => {
								let sx = j / (size-1);
								let ex = sx + 1/(size-1);
								return [
									{
										startX: sx, 
										endX: ex,
										startY: y, 
										endY: y,
										time: segTime,
										type:"move"
									},
									{
										x: ex,
										y: y,
										time: pulseTime,
										type: "pulse"
									},
								]
							})
						]
						if (i < size - 1) {
							segs.push({
								startX: 1, 
								endX: 0,
								startY: y, 
								endY: y + 1/(size - 1),
								time: diagTime,
								type:"move"
							})
						}
						return segs;
					}),
					{
						x: 1,
						y: 1,
						time: pulseTime,
						direction: "out",
						type: "fade"
					},
				]
			}
			super(ncs);
		}
	}, 
	message: class CSMessage extends CSList {
		constructor(cs) {
			let {time, message, isCount} = cs;
			super({
				message,
				isCount,
				type: "message",
				sequences: [
					{
						x: 0, y: 0,
						type: "fade",
						direction: "in",
						time: 0.5,
					},
					{
						type: "wait",
						time: time,
					},
					{
						x: 0, y: 0,
						type: "fade",
						direction: "out",
						time: 0.5,
					}
				]
			});
		}
		
		getPointAtTime(t){
			let p = super.getPointAtTime(t);
			p.message = this.message + (this.isCount ? "</br>" + Math.floor(t) + "s" : "");
			return p;
		}
	},
}
/**
 * @param {CalibrationSequence}
 * @return {CSeq}
 */
function makeCSeq(cs) {
	return new CSeqs[cs.type](cs);
}


const defaultCalibration = makeCSeq({
	type: "list",
	sequences: [
		{
			type: "message",
			time: 1.5,
			isCount: false,
			message: "Let's calibrate..."
		},
		{
			type: "message",
			time: 4,
			isCount: false,
			message: "<span style = 'white-space:pre'>Follow the targets. Relax, it's okay to blink.</span></br></br>Press Esc to cancel at any time."
		},
		{
			type: "zigzag",
			scanTime: 2.5,
			pulseTime: 1,
			size: 7,
		},
	]
});

// console.log(defaultCalibration);
window.cseq = defaultCalibration;


export class CalibrationFrame extends HideShow {
	/** @type {BasePointer} */
	pointer = null;
	
	pointerSize = 50;
	constructor(el = "calibration-frame") {
		super(el);
		if (typeof el === "string") this.onconnect();
		window.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				this.stop = true;
			}
		})
		
	}

	applyShownState() {
		super.applyShownState();
		this.styles = {
			"pointer-events": "all"
		}
	}

	onconnect() {
		this.styles = {
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: "#1b1818",
			"cursor": "none",
		}

		let rel = this.createChild("div", {
			styles: {
				position: "relative",
				width: "100%",
				height: "100%"
			}
		});

		let pointers = rel.createChild(SvgResize);
		this.pointer = pointers.createPointer("calibration", this.pointerSize);
		pointers.shown = true;
		pointers.start();

		// let vregs = new HideShow("g");
		// this.vregs = vregs;
		// this.vregps = [];
		// let s = 5;
		// for (let y = 0; y < s; y++) {
		// 	for (let x = 0; x < s; x++) {
		// 		let p = pointers.createPointer("calibration", 20);
		// 		p.position = new Vector((x + 0.5) / s, (y + 0.5) / s);
		// 		p.shown = true;
		// 		this.vregps.push(p);
		// 		vregs.appendChild(p);
		// 	}
		// }
		// pointers.appendChild(vregs);


		let message = new HideShow("div");
		message.styles = {
			position: "absolute",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -50%)",
			"text-align": "center",
			"font-size": "1.5em",
            color: "white"
		}
		this.appendChild(message);
		this.message = message;

		Algorithm.setCalibrationPositionGetter(() => { return this.position })
	}

	get pad() { return 0.03; }
	get topleft() { return new Vector(this.pad, this.pad); }
	get tl() { return this.topleft; }
	get topright() { return new Vector(1 - this.pad, this.pad); }
	get tr() { return this.topright; }
	get bottomleft() { return new Vector(this.pad, 1 - this.pad); }
	get bl() { return this.bottomleft; }
	get bottomright() { return new Vector(1 - this.pad, 1 - this.pad); }
	get br() { return this.bottomright; }
	set recording(value) {
		this._recording = value;
		if (value) Algorithm.startSampling(this.sample_method, this.bbox)
		else Algorithm.stopSampling()
	}
	get recording() {
		return this._recording;
	}
	get position() {
		return this.pointer.position;
	}
	set position(pos) {
		this.pointer.position = pos;
	}

	async calibrate(css = defaultCalibration) {
		let t = 0;
		let duration = css.duration;
		let t0 = performance.now();
		this.stop = false;
		this.pointer.shown = false;
		this.pointer.opacity = 0;
		this.message.opacity = 0; 
		while (t < duration && !this.stop) {
			let point = css.getPointAtTime(t);

			if (typeof point.message === "string") {
				this.message.innerHTML = point.message;
				this.message.opacity = (typeof point.opacity === "number" ? point.opacity : 1);
				this.recording = false;

			} else {

				this.pointer.size = (point.size ? point.size : 1) * this.pointerSize;
				this.pointer.opacity = (typeof point.opacity === "number" ? point.opacity : 1);
				this.recording = !!point.recording;
	
				let br = new Vector(this.pointerSize).div(this.clientWidth, this.clientHeight);
				let fs = new Vector(1).sub(br.mul(2))
				this.position = point.mul(fs).add(br);
			}


			await delay();
			t = (performance.now() - t0) / 1000;
		}

		let validation = null;
		if (!this.stop) {
			validation = await Algorithm.trainModel();
		}
		return validation;
	}

	// async calibrate_grid(grid = 3, counts = 4) {
	// 	let { tl, tr, bl, br } = this;
	// 	this.ctype = `grid${grid}t${counts}`
	// 	let points = dotGrid(grid, tl, tr, bl, br);
	// 	await this.showMessageCountDown("Focus on the red dot<br/>as it appears on the screen.<br/>$$");
	// 	await this.calibrate_points(points, counts);
	// }

	// async calibrate_points(points, counts) {
	// 	let { pointer } = this;
	// 	for (let p of points) {
	// 		pointer.position = p;
	// 		await pointer.show(1000);
	// 		this.recording = true;
	// 		for (let s = 0; s < counts; s++) {
	// 			pointer.text = s + 1;
	// 			await pointer.showText(500);
	// 			await pointer.hideText(500)
	// 		}
	// 		this.recording = false;
	// 		await pointer.hide();
	// 	}
	// }
	
	// async calibrate_scan(divs = 5, max_time = 3) {
	// 	await this.showMessageCountDown("Focus on the red dot<br/>as it moves along the screen.<br/>$$");
		
	// 	let { pointer } = this;
	// 	let bbox = this.getBoundingClientRect();
	// 	let [t1, t2] = [max_time, max_time];
	// 	if (bbox.width > bbox.height) t2 = max_time * bbox.height / bbox.width;
	// 	else if (bbox.height > bbox.width) t1 = max_time * bbox.width / bbox.heipght;

		
	// 	this.ctype = `scan${divs}t${max_time}`
	// 	let ext = [[this.tl, this.bl, this.tr, this.br, t1], [this.tl, this.tr, this.bl, this.br, t2]];
	// 	for (let [pa1, pa2, pb1, pb2, time] of ext) {

	// 		let pairs = linspace(1, 0, divs).map(t =>
	// 			[pa1.mul(t).add(pa2.mul(1 - t)), pb1.mul(t).add(pb2.mul(1 - t))]
	// 		)
	// 		for (let [left, right] of pairs) {
	// 			pointer.position = left;
	// 			await pointer.show();
	// 			this.recording = true;
	// 			await pointer.moveTo(right, time * 1000);
	// 			this.recording = false;
	// 			await pointer.hide();
	// 		}
	// 	}
	// }

	// async showMessage(text) {
	// 	this.message.innerHTML = text;
	// 	await this.message.show();
	// }
	// async hideMessage() { await this.message.hide(); }
	// async showMessageCountDown(text, count = 3) {
	// 	let textf = (i) => text.replace("$$", i)
	// 	this.message.innerHTML = textf("&nbsp;");
	// 	await this.message.show();
	// 	for (let i = count; i > 0; i--) {
	// 		this.message.innerHTML = textf(i);
	// 		await delay(1000);
	// 	}
	// 	await this.message.hide();
	// }

	// async calibrate(params = defaultCalibration) {
	// 	if (params.scan.on) await this.calibrate_scan(params.scan.size, params.scan.time);
	// 	if (params.grid.on) await this.calibrate_grid(params.grid.size, params.grid.time);
	// 	await this.showMessage("Calibrating eye tracking...");
	// 	let val = await Algorithm.trainModel();
	// 	await this.hideMessage();
	// 	return val;
	// }

	async show_results(std = this.std){
		await this.showMessage(`Model Accuracy ${Math.round(100 - 2 * std * 100)}%`);
		await delay(3000);
		await this.hideMessage();
	}

	async show(duration, hide) {
		if (!hide) {
			this.styles = {
				"cursor": "none",
				display: null,
			}
		}
		await super.show(duration, hide);
		if (hide) {
			this.styles = {
				"cursor": null,
				display: "none"
			}
		}
	}
}
