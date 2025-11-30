
const MODEL_SRCS = [
    "./Models/RRVectorsRed.js",
]
let Models = {};

async function load() {
  for (let url of MODEL_SRCS) {
    try {
        let module = await import(url);
        let model = module.default
        console.log("LOADING MODEL", model.name);
        if (model.name) {
          Models[model.name] = model;
        } else {
          console.log(`The model at ${url} is not a valid model.`);
        }
    } catch (e) {
        console.log(`The model at ${url} was unable to load.`, e)
    }
  }
}


function getModels(){
    let mods = {};
    for (let key in Models) {
        mods[key] = Models[key];
    }
    return mods;
}

function getModelColors(){
  let colors = {};
  for (let key in Models) {
      colors[key] = Models[key].color;
  }
  return colors;
}

function getModel(key){
  let model = null;
  if (key in Models) {
    model = Models[key];
  }
  return model;
}


export {getModels, getModel, getModelColors, load}
