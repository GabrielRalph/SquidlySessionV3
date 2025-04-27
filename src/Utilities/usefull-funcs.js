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

export function isIOS() {
  if (/iPad|iPhone|iPod/.test(navigator.platform)) {
    return true;
  } else {
    return navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 2 &&
      /MacIntel/.test(navigator.platform);
  }
}

export function isIpadOS() {
  return navigator.maxTouchPoints &&
    navigator.maxTouchPoints > 2 &&
    /MacIntel/.test(navigator.platform);
}

export function isExactSame(obj1, obj2) {
  if (typeof obj1 !== typeof obj2) return false;
  else if (typeof obj1 === "object") {
      if (obj1 === null && obj2 === null ) return true;
      else if (obj1 === null || obj2 === null) return false;
      else {
          let k1 = new Set(Object.keys(obj1));
          let k2 = new Set(Object.keys(obj2));
          let k3 = new Set();
          for (let v of k1) k3.add(v);
          for (let v of k2) k3.add(v);
      
          if (k1.size !== k3.size) {
              return false;
          } else {
              for (let key of k1) {
                  let v1 = obj1[key];
                  let v2 = obj2[key];
                  if (!isExactSame(v1, v2)) return false;
              }
          }
      }
  } else if ( obj1 !== obj2 ) return false;

  return true;
}

/**
 * @TODO Make this work for all devices
 */
export function getDevice(){
  if (isIOS()) {
    if (isIpadOS()) {
      return "tablet"
    } else {
      return "phonoe"
    }
  } else {
    return "computer"
  }
}

console.log(getDevice());

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

export function argmin(arr) {
  let mini = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[mini]) {
      mini = i;
    }
  }
  return mini;
}

export function argmax(arr) {
  let maxi = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > arr[maxi]) {
      maxi = i;
    }
  }
  return maxi;
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
    this.reverseDuration = durationPerUnit;
    this.hardSet(initialValue);
    this._updating = null;
  }

  onupdate() {

  }

  async waitTransition(){
    if (this._updating instanceof Promise) {
      await this._updating;
    }
  }

  async startUpdating(){
    if (this._updating instanceof Promise) return this._updating;

    let update = async () => {
      let t0 = performance.now();
      while(this.goalValue != this.transValue) {
        await delay();
        let t1 = performance.now();
        let duration = this.transValue > this.goalValue ? this.reverseDuration : this.duration;
        let dv = (t1 - t0) / (1000 * duration);
        t0 = t1;

        let value = this.goalValue;
        if (Math.abs(this.transValue - value) <= dv) {
          this.transValue = this.goalValue
        } else {
          this.transValue += this.transValue > value ? -dv : dv;
        }

        if (this.onupdate instanceof Function) {
          this.onupdate(this.getTransValue(), this.goalValue);
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
    this.onupdate(this.getTransValue());
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
    await super.set(value);
  }

  hardSet(value) {
    value = value ? 1 : 0;
    super.hardSet(value);
  }

  getTransValue(){
    return (1 - Math.cos(this.transValue * Math.PI))/2
  }
}

export function getQueryKey(string = window.location.search) {
  let key = null;
  try {
    let match = string.match(/^\?([ !"%&'()*+\,\-\/0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ\^_`abcdefghijklmnopqrstuvwxyz{|}]{20})(?:\.(\w*))?$/);
    if (match) {
      if (!match[2]) match[2] = null;
      key = {
        key: match[1],
        option: match[2]
      }
    }
  } catch (e) { }
  return key;
}

export function makeLogger(name, style) {
  return (...args) => {
    console.log("%c" + name + ": " + args.map(t => t + "").join(" "), style);
  }
}

export class PromiseChain {
  constructor(){
      this.head = null;
      this.tail = null;

  }
  /** 
   * @param {() => Promise} 
   * @return {Promise}
   * */
  async addPromise(func) {
      let item = {next: null, prom: null};

      // Add item to chain
      if (this.head == null) {
          this.head = item;
          this.tail = item;
      } else {
          this.tail.next = item;
          this.tail = item;
      }

      // wait for previous promises in the chain
      let node = this.head;
      while (node != item) {
          await node.prom;
          node = node.next;
      }

      // call the promise added.
      item.prom = func();
      let res = await item.prom;

      // remove the item from the chain
      if (this.tail == item) {
          this.tail = null;
          this.head = null;
      } else {
          this.head = item.next;
      }
      return res;
  }
}

class PrivacyError extends Error{
  constructor(message) {
    super(message);
    this.stack = this.stack.replace(/\sat\s+Object.set[^\n]+\n/, "")
  }
}
class ProxyClass {
  constructor(...args) {
      return new Proxy(...args)
  }
}
export class PublicProxy extends ProxyClass {
  constructor(instance, restrict) {
    if (typeof restrict !== "object" || restrict == null) restrict = {}
    let isPrivate = (prop) => {
      return prop[0] == "_" ||
              prop in restrict || 
              prop[0] == "$"
    }
    super(instance, {
      get: (target, prop, receiver) => {
        if (prop in target) {
          let isF = target[prop] instanceof Function
          if (isPrivate(prop)) {
            throw new PrivacyError(`Failed to ${isF ? "call" : "get"} ${prop} as it's a private ${isF ? "function" : "property"}.`)
          } else {
            return isF ? instance[prop].bind(instance) : target[prop];
          }
        } else {
          throw new PrivacyError(`No property or function ${prop}.`)
        }
      },
      set: (target, prop, receiver) => {
        if (prop in instance) {
          if (isPrivate(prop)) {
            throw new PrivacyError(`Failed to set ${prop} as it's a private ${target[prop] instanceof Function ? "function" : "property"}.`)
          } else {
            instance[prop] = receiver;
          }
        } else {
          throw new PrivacyError(`No property or function ${prop}.`)
        }
        return true
      }
    })
  }
}
