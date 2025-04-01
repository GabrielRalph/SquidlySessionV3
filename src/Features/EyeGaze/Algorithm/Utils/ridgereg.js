import numeric from './numeric.js';
import mat from './mat.js';
import {Vector} from "../../../../SvgPlus/4.js"

/** Performs ridge regression, according to the Weka code.
 * @param {[Number]} y  size n array
 * @param {[[Number]]} X  size n x m array's
 * @param {Number} k ridge parameter
 * @return{[Number]} regression coefficients size m array
 */
function ridgereg(y, X, k){
  
    var nc = X[0].length;
    var m_Coefficients = new Array(nc);
    var xt = mat.transpose(X);
    var solution = new Array();
    let epocs = 0;
    var success = true;
    do{
        var ss = mat.mult(xt,X);
        // Set ridge regression adjustment
        for (var i = 0; i < nc; i++) {
            ss[i][i] = ss[i][i] + k;
        }

        // Carry out the regression
        var bb = mat.mult(xt,y);
        for(var i = 0; i < nc; i++) {
            m_Coefficients[i] = bb[i][0];
        }
        try{
            var n = (m_Coefficients.length !== 0 ? m_Coefficients.length/m_Coefficients.length: 0);
            if (m_Coefficients.length*n !== m_Coefficients.length){
                console.log('Array length must be a multiple of m')
            }
            solution = (ss.length === ss[0].length ? (numeric.LUsolve(numeric.LU(ss,true),bb)) : (mat.QRDecomposition(ss,bb)));

            for (var i = 0; i < nc; i++){
                m_Coefficients[i] = solution[i];
            }
            success = true;
        }
        catch (ex){
            k *= 10;
            console.log(ex);
            success = false;
        }
        epocs ++;
    } while (!success);
    return m_Coefficients;
}


class RidgeRegVec {
  constructor(mx, my) {
    this.mx = mx;
    this.my = my;
  }

  
  
  predict(X){
    let v = new Vector(0)
    for (let i = 0; i < X.length; i++) {
      v.x += X[i] * this.mx[i];
      v.y += X[i] * this.my[i];
    }
    return v;
  }

  toString(){
    return `${this.mx}\n${this.my}`
  }

  static fromString(str) {
    let ms = str.split("\n");
    let [mx, my] = ms.map(m => m.split(",").map(v => parseFloat(v)));
    return new RidgeRegVec(mx, my);
  }
}

/** Performs ridge regressions given y as a vector's
  * @param {[(X: [Number], y: Vector)]} data regression data
  * @param {Number} k ridge parameter
  * @return {(predict: Function, mx: [number], my: [number])}
*/
function ridgeregvec(data, k = Math.pow(10, -5)){
  let X = data.map(u => u.X)
  let mx = ridgereg(data.map(u => [u.y.x]), X, k);
  let my = ridgereg(data.map(u => [u.y.y]), X, k);

  return new RidgeRegVec(mx, my);
}


export {RidgeRegVec, ridgereg, ridgeregvec};
