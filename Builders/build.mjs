import fs from 'fs';

function isDir(path) {
    return fs.lstatSync(path).isDirectory();
}
function getAllFeatures(directory) {
    let features = []
    fs.readdirSync(directory).forEach(featureDir => {
        if (isDir(`${directory}/${featureDir}`)) {
            fs.readdirSync(`${directory}/${featureDir}`).forEach(file => {
                if (file.endsWith('.js')) {
                    let text = fs.readFileSync(`${directory}/${featureDir}/${file}`, 'utf8');
                    text.replace(/\/\/.*/g, ''); // remove comments
                    text = text.replace(/\/\*((.|\n)*?)\*\//g, ''); // remove line comments
                    if (text.match(/extends\s+Features/) && text.match(/export\s+default/)) {
                        let name = text.match(/static\s+get\s+name\(\)[\s\n]*{[\s\n]*return\s*["'`](.+?)["'`]/);
                        if (name && name[1]) {
                            features.push({
                                filename: `${directory}/${featureDir}/${file}`,
                                name: name[1],
                            });
                        } else {
                            console.warn("Feature found but no static name():", `${directory}/${featureDir}/${file}`);
                        }
                    }
                }
            })
        }
    });

    return features;
} 


function extractFunction(stub, text) {
    let funcRegex = new RegExp(`${stub}[\\s\\n]*{`, 'g');
    let match = funcRegex.exec(text);
    if (!match) return null;

    let startIndex = match.index + match[0].length;
    let braceCount = 1;
    let currentIndex = startIndex;

    while (braceCount > 0 && currentIndex < text.length) {
        if (text[currentIndex] === '{') {
            braceCount++;
        } else if (text[currentIndex] === '}') {
            braceCount--;
        }
        currentIndex++;
    }

    if (braceCount === 0) {
        return text.slice(match.index, currentIndex);
    } else {
        return null; // No matching closing brace found
    }
}

function getDependencies(featureFile, allFeatures) {
    let text = fs.readFileSync(featureFile, 'utf8');
    text.replace(/\/\/.*/g, '');
    text = text.replace(/\/\*((.|\n)*?)\*\//g, '');

    let featureClass = extractFunction('Features', text);
    let contructorCode = extractFunction('constructor[\\s\\n]*\\((.*?)\\)', featureClass);
    let initialiseCode = extractFunction('initialise[\\s\\n]*\\((.*?)\\)', featureClass);

    let dependencies = {};
    for (let feature of allFeatures) {
        if (featureFile !== feature.filename) {
            
            let importRegex = new RegExp(`session.${feature.name}`, 'g');
            if (text.match(importRegex)) {
                let isInConstructor = contructorCode && contructorCode.match(importRegex);
                let isInInitialise = initialiseCode && initialiseCode.match(importRegex);
                dependencies[feature.name] = {
                        inConstructor: !!isInConstructor,
                        inInitialise: !!isInInitialise
                };
            }
        }
    }

    return dependencies;
}

function buildDependencyGraph(features) {
    features.forEach(feature => {
        feature.dependencies = getDependencies(feature.filename, features);
    });

    features.forEach(feature => {
        feature.dependents = {};
        feature.dependentsCount = 0;
        features.forEach(otherFeature => {
            if (feature !== otherFeature) {
                if (otherFeature.dependencies[feature.name]) {
                    let info = otherFeature.dependencies[feature.name];
                    feature.dependents[otherFeature.name] = info;
                    feature.dependentsCount += 1 + (info.inConstructor ? 2 : 0) + (info.inInitialise ? 1 : 0)
                }
            }
        })
    });

    features.sort((a, b) => b.dependentsCount - a.dependentsCount);
}

function createFeatureList(src) {
    const features = getAllFeatures(src);
    buildDependencyGraph(features);
    const relURLs = features.map(f=>`[relURL(".${f.filename.replace(src, '')}", import.meta), "${f.name}"]`);
    const featuresList = `import { relURL } from '../Utilities/usefull-funcs.js';\nexport default [\n\t${relURLs.join(",\n\t")}\n]`
    fs.writeFileSync(src + '/feature-list.js', featuresList);
}


createFeatureList('./src/Features');