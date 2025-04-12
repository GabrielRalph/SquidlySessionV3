import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0"
import {Vector, Vector3} from "./vector3.js"
const {FaceLandmarker, FilesetResolver} = vision;

/**
 * @typedef {Vector & {v3d: Vector3}} Vector2and3
 */

/**
 * @typedef EyePoints 
 * @type {object}
 * @property {Vector2and3} left
 * @property {Vector2and3} right
 * @property {Vector2and3} top
 * @property {Vector2and3} bottom
 * @property {Vector2and3[]} border
 * @property {Vector2and3[]} pupil
 * @property {Vector2and3[]} iris
 * @property {Vector2and3[]} all
 */

/**
 * @typedef FacePoints
 * @type {object}
 * @property {EyePoints} righteye
 * @property {EyePoints} lefteye
 * @property {Vector2and3[]} all
 * @property {Vector3[]} allNoScale
 * @property {Vector2and3} leftMost
 * @property {Vector2and3} rightMost
 * @property {Vector2and3[]} plane
 * @property {Number} width
 * @property {Number} width
 * @property {Vector} size
 * @property {Vector3} size3d
 */

let runningMode = "VIDEO";

const optimal_face2screen_ratios = [0.22, 0.33];
const max_center_diff = 0.12;
const border_ratio = 1/8;
const FacePointIdxs = {
  left: 162,
  right: 389,
  top: 10,
  bottom: 152,
  extent: [10, 389, 152, 162],
  outline: [109, 67, 103, 54, 21, 162, 127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389, 251, 284, 332, 297, 338, 10],
  eyes: {
    right: {
      left: 130,
      right: 173,
      top: 159,
      bottom: 145,
      outline:  [362, 398, 384, 385, 386, 387, 388, 263, 249, 390,373, 374, 380, 381, 382],
      pupil: 473,
      iris: [474, 475, 476, 477],
      exent: [159, 173, 145, 130],
      all: [463, 398, 384, 385, 386, 387, 388, 466, 263, 255, 339, 254, 253, 252, 256, 341, 474, 475, 476, 477, 473]
    },
    left: {
      top: 386,
      bottom: 374,
      left: 398,
      right: 359,
      outline: [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154,153,145,144,163,7],
      pupil: 468,
      iris: [469, 470, 471, 472],
      exent: [386, 359, 374, 398],
      all: [112, 26, 22, 23, 24, 110, 25, 33, 246, 161, 160, 159, 158, 157, 173, 243, 469, 470, 471, 472, 468]
    },
  },
  mouth: {
    outline: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
  },
  plane: [4, 243, 463],
}

function cap(y, min, max) {
    return y < min ? min : (y > max ? max : y)
}

export class FaceLandmarks extends Array {
  /**
   * @param {{x:Number, y:Number, z:Number}[]} points
   */
  constructor(points, aspect) {
    super(points.length);
    points.forEach((v,i) => {
      this[i] = v;
    });

    this.aspect = aspect;
  }


  get isOutside(){
    let el = this.get2D("eyes.left.pupil");
    let er = this.get2D("eyes.right.pupil");
    let brH = border_ratio * this.aspect;
    
    let isOutside = false;
    if (el.x < border_ratio) {
      isOutside = "left";
    } else if (er.x > 1-border_ratio) {
      isOutside = "right";
    } else if (el.y < brH || er.y < brH) {
      isOutside = "top"
    } else if (el.y > 1-brH || er.x > 1-brH) {
      isOutside = "bottom"
    }
    return isOutside
  }


  /** @return {number} */
  get faceFrameQualityMetric() {
    const [opf2s_min, opf2s_max] = optimal_face2screen_ratios
    let lmf = this.get2D("left");
    let rmf = this.get2D("right");
    let el = this.get2D("eyes.left.pupil")
    let er = this.get2D("eyes.right.pupil")

    let dist = lmf.dist(rmf);

    let f2s = 1;
    if (dist < opf2s_min) {
        f2s = (dist / opf2s_min)
    } else if (dist > opf2s_max){
        f2s = (1 - (dist - opf2s_max) / (1 - opf2s_max))
    }

    let c1 = el.add(er).div(2);
    let xerr = 1- cap(2 * Math.abs(c1.x - 0.5) - max_center_diff, 0, 1) / (1 - max_center_diff)
    let yerr = 1- cap(2 * Math.abs(c1.y - 0.5) - max_center_diff, 0, 1) / (1 - max_center_diff)
    let cerr = xerr*(yerr**2);

    return (f2s**3) * (cerr**2);
  }

  /**
   * @param {string} path
   * @param {Number} width
   * @param {Number} height
   * 
   * @return {Vector[]}
   */
  get2D(path, width = 1, height = 1) {
    if (typeof path !== "string") {
      throw `invalid eye index path must be string.`
    } else if (typeof width !== "number" || Number.isNaN(width)) {
      throw `invalid width.`
    } else if (typeof height !== "number" || Number.isNaN(height)) {
      throw `invalid height.`
    }


    path = path.split(".");
    let o = FacePointIdxs;
    for (let k of path) {
      if (!(k in o)) {
        throw `invalid eye index path ${path}`
      }
      o = o[k];
    }
    if (typeof o === "number") {
      return new Vector(this[o]).mul(width, height)
    } else {
      return o.map(i => new Vector(this[i]).mul(width, height))
    }
  }

  static get borderWidthRatio() {return border_ratio}
}

/**
 * @return {?FaceLandmarks}
 */
function getFacePoints(prediction, width, height) {
  let data = null;
  try{
    data = new FaceLandmarks(prediction.faceLandmarks[0], width/height);
  } catch(e){}
  return data;
}

let FaceMesh = false;

// Load's model
export async function load() {
  if (FaceMesh !== false) return;
  console.log("Loading Face Mesh");
  
  // Read more `CopyWebpackPlugin`, copy wasm set from "https://cdn.skypack.dev/node_modules" to `/wasm`
  const filesetResolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  FaceMesh = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode,
    numFaces: 1
  });
  console.log("Loaded Face Mesh");
}

/** Get face points from video
 * @param {HTMLVideoElement} video
 * 
 * @return {FacePoints} 
 */ 
export function getFacePointsFromVideo(video) {
  let ts = Date.now();
  let res = FaceMesh.detectForVideo(video, ts);
  let points = getFacePoints(res, video.videoWidth, video.videoHeight);
  points.ts = ts;
  return points;
}
