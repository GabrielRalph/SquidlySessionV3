let mx = 0;
let my = 0;
let x = 0;
let y = 0;
let w = window.innerWidth;
let h = window.innerHeight;
window.XPos = 0;
window.YPos = 0;
window.change_flag = false;
window.onmousemove = (e) => {
  window.XPos = e.x;
  window.YPos = e.y;
  window.change_flag = true;
}

export function isPageHidden(){
  return document.hidden || document.msHidden || document.webkitHidden || document.mozHidden;
}

export function getCursorPosition(){
  return {x: window.XPos, y: window.YPos}
}

export function elementAtCursor(){
  return document.elementFromPoint(window.XPos, window.YPos);
}

export async function parallel() {
  let res = [];
  for (let argument of arguments) {
    res.push(await argument);
  }
  return res;
}

export async function transition(callBack, duration) {
  if (callBack instanceof Function) {
    let end = false;
    return new Promise((resolve, reject) => {
      let t0 = null
      callBack(0);
      let dt = 0;
			let tn = 0;
      let next = (tnow) => {
				tn = tnow;
        if (t0 == null) t0 = window.performance.now();
        dt = window.performance.now() - t0;
        let t = dt/duration;
        if (t > 1) {
          t = 1;
          end = true;
        }
        callBack(t);
        if (!end) {
          window.requestAnimationFrame(next);
        } else {
          resolve(true);
        }
      }
      window.requestAnimationFrame(next)
    });
  }
}

export function lurp4(x, y, tl, tr, bl, br) {
	let xt = tl.mul(1-x).add(tr.mul(x));
	let xb = bl.mul(1-x).add(br.mul(x));
	let p = xt.mul(1-y).add(xb.mul(y));
	return p;
}

export function dotGrid(size, tl, tr, bl, br) {

  let points = [];
  if (size == 1) {
    points.push(tl.add(br).div(2));
  } else {
    let dd = 1 / (size - 1);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let p = lurp4(x*dd, y*dd, tl, tr, bl, br);
        points.push(p);
      }
    }
  }
	return points;
}

export function linspace(start, end, incs) {
  let range = end - start;
  let dx = range / (incs - 1);
  let space = [];
  for (let i = 0; i < incs; i ++) space.push(start + i * dx);
  return space;
}

export async function delay(time){
  return new Promise((resolve, reject) => {
    if (time) {
      setTimeout(resolve, time);
    } else {
      window.requestAnimationFrame(resolve);
    }
  })
}
export function relURL(url, meta) {
  let root = meta.url;
  url = url.replace(/^\.\//, "/");
  if (url[0] != "/") url = "/" + url;
  return root.split("/").slice(0, -1).join("/") + url;
}

export class TransitionVariable {
  constructor(initialValue, durationPerUnit, onupdate) {
    if (onupdate instanceof Function) this.onupdate = onupdate;
    this.duration = durationPerUnit;
    this.hardSet(initialValue);
    this._updating = null;
  }

  onupdate() {

  }

  async startUpdating(){
    if (this._updating instanceof Promise) return this._updating;

    let update = async () => {
      let t0 = performance.now();
      while(this.goalValue != this.transValue) {
        await delay();
        let t1 = performance.now();
        let dv = (t1 - t0) / (1000 * this.duration);
        t0 = t1;

        let value = this.goalValue;
        if (Math.abs(this.transValue - value) <= dv) {
          this.transValue = this.goalValue
        } else {
          this.transValue += this.transValue > value ? -dv : dv;
        }

        if (this.onupdate instanceof Function) {
          this.onupdate(this.getTransValue());
        }
      }
    }

    this._updating = update();
    await this._updating;
    this._updating = null;
  }

  async set(value) {
    this.goalValue = value;
    await this.startUpdating();  
  }

  hardSet(value) {
    this.goalValue = value;
    this.transValue = value;
  }

  get(){
    return this.goalValue;
  }

  getTransValue() {
    return this.transValue;
  }
}

export class WaveStateVariable extends TransitionVariable {
  constructor(initialState, duration, onupdate) {
    super(initialState, duration, onupdate);
  }

  async set(value) {
    value = value ? 1 : 0;
    super.set(value);
  }

  hardSet(value) {
    value = value ? 1 : 0;
    super.hardSet(value);
  }

  getTransValue(){
    return (1 - Math.cos(this.transValue * Math.PI))/2
  }
}