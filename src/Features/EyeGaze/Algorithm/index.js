import * as FaceMesh from "./Utils/face-mesh.js"
import * as Webcam from "../../../Utilities/webcam.js";
import * as ModelLibrary from "./ModelLibrary.js"

let SelectedModel = "RRVectorsReduced";
let Model = null;


let SampleData = [];
let MethodID = null;
let is_sampling = false;
let GetScreenPosition = null;


function sample(features) {
  if (is_sampling && GetScreenPosition instanceof Function) {
    features.method = MethodID;
    SampleData.push({X: features, y: GetScreenPosition()})
  }
}


function processFrame(input) {
  let points = FaceMesh.getFacePointsFromVideo(input.video);
  input.points = points;

  sample(points);

  let position = predictScreenPosition(points);

  return position;
}

/**
 * @param {FaceMesh.FaceLandmarks[]} facePoints
 */
function getSampleStats(facePoints) {
  let n = facePoints.length;
  let m = facePoints[0].length;
  let {width, height} = facePoints[0];

  let sum = new Array(m).fill(0).map(() => {return {x:0,y:0,z:0}});
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      sum[j].x += facePoints[i][j].x;
      sum[j].y += facePoints[i][j].y;
      sum[j].z += facePoints[i][j].z;
    }
  }

  let avg = sum.map(v => {
      let nv = {};
      for (let k in v) nv[k] = v[k] / facePoints.length;
      return nv;
  });
  avg = new FaceMesh.FaceLandmarks(avg, width, height);


  let avgErr = new Array(m).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      let v = facePoints[i][j]
      avgErr[j] += ((v.x - avg[j].x) ** 2 + (v.y - avg[j].y) ** 2 + (v.z - avg[j].z) ** 2) ** 0.5
    }
  }
  avgErr = avgErr.map(ae => ae / facePoints.length)

  return {avg, avgErr}
}



let sstats = null;
export async function trainModel(sampleRate = 0.9){
  Webcam.stopProcessing();

  let stats = null;
  sstats = getSampleStats(SampleData.map(({X}) => X));
  try{
    let mClass = ModelLibrary.getModel(SelectedModel);
    Model = new mClass();
    stats = await Model.trainAndValidate(SampleData, sampleRate);
    Model.saveToStorage();
  } catch (e) {
    console.log("training error", e);
  }
  Webcam.startProcessing();
  SampleData = [];
  if (stats == null) throw new Error("Training Error.")
  else {
    stats.sampleStats=sstats;    
  }
  
  return stats;
}

function predictScreenPosition(X, kfilter = true) {
  let y = null;
  if (Model) {
    try {
      y = Model.predictAndFilter(X);
    } catch(e) {console.log(e);}
  }
  return y;
}

export function startSampling(methodID){
    MethodID = methodID;
    is_sampling = true;
}

export function stopSampling(){
  is_sampling = false;
}

export function setCalibrationPositionGetter(posGetter) {
  if (posGetter instanceof Function) {
    GetScreenPosition = posGetter;
  }
}

Webcam.setProcess((input) => processFrame(input));

async function load() {
  
  await Promise.all([
    FaceMesh.load(),
    ModelLibrary.load(),
  ]);
  Model = ModelLibrary.getModel(SelectedModel).loadFromStorage();
}
export {Webcam, load}
