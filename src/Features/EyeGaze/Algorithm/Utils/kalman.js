import mat from "./mat.js"
import numeric from "./numeric.js"


class KalmanFilter {
  /**
  * Kalman Filter constructor
  * Kalman filters work by reducing the amount of noise in a models.
  * https://blog.cordiner.net/2011/05/03/object-tracking-using-a-kalman-filter-matlab/
  *
  * @param {Array.<Array.<Number>>} F - transition matrix
  * @param {Array.<Array.<Number>>} Q - process noise matrix
  * @param {Array.<Array.<Number>>} H - maps between measurement vector and noise matrix
  * @param {Array.<Array.<Number>>} R - defines measurement error of the device
  * @param {Array} P_initial - the initial state
  * @param {Array} X_initial - the initial state of the device
  */
  constructor(F, H, Q, R, P_initial, X_initial) {
    this.F = F; // State transition matrix
    this.Q = Q; // Process noise matrix
    this.H = H; // Transformation matrix
    this.R = R; // Measurement Noise
    this.P = P_initial; //Initial covariance matrix
    this.X = X_initial; //Initial guess of measurement
  }

  update(z) {
      // Here, we define all the different matrix operations we will need
      let {add, sub, inv, identity} = numeric;
      let {mult, transpose} = mat;
      //TODO cache variables like the transpose of H

      // prediction: X = F * X  |  P = F * P * F' + Q
      var X_p = mult(this.F, this.X); //Update state vector
      var P_p = add(mult(mult(this.F,this.P), transpose(this.F)), this.Q); //Predicted covaraince

      //Calculate the update values
      var y = sub(z, mult(this.H, X_p)); // This is the measurement error (between what we expect and the actual value)
      var S = add(mult(mult(this.H, P_p), transpose(this.H)), this.R); //This is the residual covariance (the error in the covariance)

      // kalman multiplier: K = P * H' * (H * P * H' + R)^-1
      var K = mult(P_p, mult(transpose(this.H), inv(S))); //This is the Optimal Kalman Gain

      //We need to change Y into it's column vector form
      for(var i = 0; i < y.length; i++){
          y[i] = [y[i]];
      }

      //Now we correct the internal values of the model
      // correction: X = X + K * (m - H * X)  |  P = (I - K * H) * P
      this.X = add(X_p, mult(K, y));
      this.P = mult(sub(identity(K.length), mult(K,this.H)), P_p);
      return transpose(mult(this.H, this.X))[0]; //Transforms the predicted state back into it's measurement form
  };

  static default(xmax = 0.500, xmin = 0, delta_t = 1/20, pixel_error = 47){
    // Initialize Kalman filter [20200608 xk] what do we do about parameters?
    // [20200611 xk] unsure what to do w.r.t. dimensionality of these matrices. So far at least
    //               by my own anecdotal observation a 4x1 x vector seems to work alright
    var F = [ [1, 0, 1, 0],
      [0, 1, 0, 1],
      [0, 0, 1, 0],
      [0, 0, 0, 1]];

    //Parameters Q and R may require some fine tuning
    var Q = [ [1/4, 0,    1/2, 0],
      [0,   1/4,  0,   1/2],
      [1/2, 0,    1,   0],
      [0,  1/2,  0,   1]];// * delta_t
    // var delta_t = 1/10; // The amount of time between frames
    Q = numeric.mul(Q, delta_t);

    var H = [ [1, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 0, 0]];
    var H = [ [1, 0, 0, 0],
      [0, 1, 0, 0]];
    // var pixel_error = 47; //We will need to fine tune this value [20200611 xk] I just put a random value here

    //This matrix represents the expected measurement error
    var R = numeric.mul(numeric.identity(2), pixel_error);

    var P_initial = numeric.mul(numeric.identity(4), 0.0001); //Initial covariance matrix
    var x_initial = [[xmax], [xmax], [xmin], [xmin]]; // Initial measurement matrix

    return new KalmanFilter(F, H, Q, R, P_initial, x_initial)
  }
}

export default KalmanFilter
