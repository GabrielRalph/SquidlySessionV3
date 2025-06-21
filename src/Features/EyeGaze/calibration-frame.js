import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { HideShow } from "../../Utilities/hide-show.js";
import { BasePointer, SvgResize } from "../../Utilities/svg-resize.js";
import { delay, relURL } from "../../Utilities/usefull-funcs.js";
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
	scanY: class CSGrid extends CSList{
		constructor(cs) {
			let {size, scanTime, pulseTime} = cs;
			let ncs = {
				type: "scanX",
				sequences: new Array(size).fill(0).flatMap((_,i) => {
					let x = i / (size - 1);
					return [
						{
							x: x,
							y: 0,
							direction: "in",
							time: pulseTime,
							type: "fade",
						},
						{
							startX: x, 
							endX: x,
							startY: 0, 
							endY: 1,
							time: scanTime,
							type:"move"
						},
						{
							x: x,
							y: 1,
							time: pulseTime,
							type: "pulse"
						},
						{
							x: x,
							y: 1,
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

function makeDefaultCSeqs(speed, size) {
	return makeCSeq({
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
				type: "scanX",
				scanTime: speed,
				pulseTime: 0.75,
				size: size,
			},
			{
				type: "scanY",
				scanTime: speed,
				pulseTime: 0.75,
				size: size,
			},
		]
	});
}

const speedName2value = {
	"slow": 6,
	"medium": 4,
	"fast": 2,
}

const Guides = [
	"default",
	"balloon",
	"bee",
	"squidly"
]

export class CalibrationFrame extends HideShow {
	/** @type {BasePointer} */
	pointer = null;
	pointerSize = 50;
	_speed = 4;
	_size = 4;
	_guide = "default";

	/** @type {CalibrationSequence} */
	calibrationSequence = null;

	constructor(el = "calibration-frame") {
		super(el);
		if (typeof el === "string") this.onconnect();
		window.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				this.stop = true;
			}
		})
		this.calibrationSequence = makeDefaultCSeqs(this.speed, this.size);
	}

	/** @param {string} value */
	set guide(value) {
		if (value in this.guides) {
			this.pointer.guide = this.guides[value];
			this._guide = value;
		}
	}

	/** @return {string} */
	get guide() {
		return this._guide;
	}

	/** @param {Number|string} value */
	set size(value) {	
		value = parseInt(value);
		if (!Number.isNaN(value)) {
			this._size = value;
			this.calibrationSequence = makeDefaultCSeqs(this.speed, this.size);
		}
	}
	/** @return {Number} */
	get size() {
		return this._size;
	}
	/** @param {Number|string} value */
	set speed(value) {		
		if (typeof value === "number") {
			this._speed = value;
			this.calibrationSequence = makeDefaultCSeqs(this.speed, this.size);
		} else if (value in speedName2value) {
			this._speed = speedName2value[value];
			this.calibrationSequence = makeDefaultCSeqs(this.speed, this.size);
		}
	}
	/** @return {Number} */
	get speed() {
		return this._speed;
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

	async calibrate(css = this.calibrationSequence) {
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
			try {
				validation = await Algorithm.trainModel();
			} catch (e) {
				console.log(e);
			}
		}
		return validation;
	}

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

	async loadGuides(){
		let guides = {};
		await Promise.all(Guides.map(async (g) => {
			let url = `../../Utilities/CalibrationGuides/${g}.svg`;
			let svg = await (await fetch(relURL(url, import.meta))).text();
			svg = SvgPlus.parseSVGString(svg);
			guides[g] = svg.innerHTML;
		}))
		this.guides = guides;
	}
}
