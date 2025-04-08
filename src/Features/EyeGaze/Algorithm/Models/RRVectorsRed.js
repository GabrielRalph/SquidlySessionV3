import {EyeGazeModelInterface, Vector} from "../ModelInterface.js"
import {RidgeRegVec, ridgeregvec} from "../Utils/ridgereg.js"

const FEATURE_SET = [112, 26, 22, 23, 24, 110, 25, 33, 246, 161, 160, 159, 158, 157, 173, 243, 469, 470, 471, 472, 468, 463, 398, 384, 385, 386, 387, 388, 466, 263, 255, 339, 254, 253, 252, 256, 341, 474, 475, 476, 477, 473, 4, 243, 463]
// const FEATURE_SET = [398, 253, 386, 359, 173, 23, 130, 159,468,473,469, 470, 471, 472,474, 475, 476, 477, 4, 243, 463];
// const FEATURE_SET = [474, 475, 476, 477, 469, 470, 471, 472, 6, 162, 389]
const POWERS = 2;
function getFacePointFeatures(X) {
    let newX = FEATURE_SET.map(i => X[i]).flatMap(({x, y, z}) => new Array(POWERS).fill(0).flatMap((_,i) => [x**(i+1), y**(i+1), z**(i+1)]));
    return newX;
}


export default class RRVectorsRed extends EyeGazeModelInterface {
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

  toString(){
    return this.MP + "";
  }

  static fromString(str){
    let model = new RRVectorsRed();
    model.MP = RidgeRegVec.fromString(str);
    return model;
  }


  static get name(){
    return "RRVectorsReduced"
  }

  static get color(){
    return "red"
  }
}
