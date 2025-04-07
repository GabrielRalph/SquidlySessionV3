import {EyeGazeModelInterface, Vector} from "../ModelInterface.js"
import {ridgeregvec} from "../Utils/ridgereg.js"

const FEATURE_SET = [112, 26, 22, 23, 24, 110, 25, 33, 246, 161, 160, 159, 158, 157, 173, 243, 469, 470, 471, 472, 468, 463, 398, 384, 385, 386, 387, 388, 466, 263, 255, 339, 254, 253, 252, 256, 341, 474, 475, 476, 477, 473, 4, 243, 463]
function getFacePointFeatures(X) {
    let newX = FEATURE_SET.map(i => X.facePoints.all[i]).flatMap(({v3d}) => [v3d.x, v3d.y, v3d.z]);
    return newX;
}

export default class RRVectors extends EyeGazeModelInterface {
  train(data) {
    let myX = [];
    for (let {X, y} of data) {
        try {
            let Xp = getFacePointFeatures(X);
            myX.push({X: Xp, y: y});
        } catch(e) {
            console.log('IDP');
        }
    }
    this.MP = ridgeregvec(myX);
    
  }
  predict(X) {
    let y = null;
    if (this.MP) {
      try {
        let x = getFacePointFeatures(X);
        y = this.MP.predict(x);
      } catch (e) {
        console.log('IDP');
      }
    }
    return y;
  }

  static get name(){
    return "RRVectors"
  }

  static get color(){
    return "blue"
  }
}
