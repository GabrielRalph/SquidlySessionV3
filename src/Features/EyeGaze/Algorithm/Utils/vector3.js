import {Vector} from "../../../../SvgPlus/vector.js"
function round(v, dp) {
  return Math.round(Math.pow(10, dp) * v)/Math.pow(10, dp);
}

function isNum(value) {
  return typeof value === "number";
}

function PV3(args) {
  let x = 0;
  let y = 0;
  let z = 0;
  if (args.length > 0) {
    if (args.length == 1 && isNum(args[0])) {
      x = args[0];
      y = x;
      z = x;
    } else if (args.length == 2 && isNum(args[0]) && isNum(args[1])) {
      x = args[0];
      y = args[1];
    } else if (args.length == 3 && isNum(args[0]) && isNum(args[1]) && isNum(args[2])) {
      x = args[0];
      y = args[1];
      z = args[2];
    } else if (Array.isArray(args[0])) {
      return PV3(args[0]);
    } else if (typeof args[0] === "object") {
      return PV3(["x", "y", "z"].map(k => args[0][k]));
    }
  } else {
    throw "invalid vector"
  }
  return [x, y, z];
}

function PV3v(args) {
  let [x, y, z] = PV3(arguments);
  return new Vector3(x, y, z);
}

class Vector3{
  constructor(){
    let [x, y, z] = PV3(arguments);
    this.x = x;
    this.y = y;
    this.z = z;
  }

  rotateZ(theta) {
    let x = this.x * Math.cos(theta) - this.y * Math.sin(theta);
    let y = this.x * Math.sin(theta) + this.y * Math.cos(theta);
    return new Vector3(x, y, this.z);
  }
  rotateY(theta) {
    let x = this.x * Math.cos(theta) + this.z * Math.sin(theta);
    let z = -this.x * Math.sin(theta) + this.z * Math.cos(theta);
    return new Vector3(x, this.y, z);
  }
  rotateX(theta) {
    let y = this.y * Math.cos(theta) - this.z * Math.sin(theta);
    let z = -this.y * Math.sin(theta) + this.z * Math.cos(theta);
    return new Vector3(this.x, y, z);
  }

  // rotate() {
  //   let vec = parseV3()
  //   if (vec instanceof Vector3) {
  //     return this.rotateX(vec.x).rotateY(vec.y).rotateZ(vec.z);
  //   }
  //   return null;
  // }

  dot() {
    let [x, y, z] = PV3(arguments);
    return this.x*x + this.y*y + this.z*z;
  }

  cross() {
    let [x, y, z] = PV3(arguments);
    return new Vector3(this.y * z - this.z * y, this.z * x - this.x * z, this.x * y - this.y * x)
  }

  angleBetween(){
    let b = PV3v(arguments);
    return Math.acos(this.dot(b)/(this.norm() * b.norm()));
  }

  add() {
    let [x, y, z] = PV3(arguments);
    return new Vector3(this.x + x, this.y + y, this.z + z);
  }
  sub() {
    let [x, y, z] = PV3(arguments);
    return new Vector3(this.x - x, this.y - y, this.z - z);
  }
  mul() {
    let [x, y, z] = PV3(arguments);
    return new Vector3(this.x * x, this.y * y, this.z * z);
  }
  div() {
    let [x, y, z] = PV3(arguments);
    return new Vector3(this.x / x, this.y / y, this.z / z);
  }
  norm(){
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  dist() {
    let [x, y, z] = PV3(arguments);
    return this.sub(x, y, z).norm();
  }

  dir(){
    let n = this.norm();
    return this.div(new Vector3(n, n, n));
  }

  toVector(){
    return new Vector(this.x, this.y);
  }

  array(){
    return [this.x, this.y, this.z];
  }

  toString() {
    return `${round(this.x, 5)}, ${round(this.y, 5)}, ${round(this.z, 5)}`
  }
}

export {Vector3, Vector}
