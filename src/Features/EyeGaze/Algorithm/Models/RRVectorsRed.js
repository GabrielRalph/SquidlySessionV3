import {EyeGazeModelInterface, Vector} from "../ModelInterface.js"
import {RidgeRegVec, ridgeregvec} from "../Utils/ridgereg.js"


const FEATURE_SET = [398, 253, 386, 359, 173, 23, 130, 159,468,473,469, 470, 471, 472,474, 475, 476, 477, 4, 243, 463];

function getFacePointFeatures(X) {
    let newX = FEATURE_SET.map(i => X[i]).flatMap(({x, y, z}) => [x, y, z]);
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
