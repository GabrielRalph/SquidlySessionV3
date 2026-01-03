import fs from 'fs';
import { extractFunction } from './utils.js';

function isDir(path) {
    return fs.lstatSync(path).isDirectory();
}
function getAllFeatures(directory) {
    let features = []
    fs.readdirSync(directory).forEach(featureDir => {
        if (isDir(`${directory}/${featureDir}`)) {
            fs.readdirSync(`${directory}/${featureDir}`).forEach(file => {
                if (file.endsWith('.js')) {


                    // Read the file content
                    let text = fs.readFileSync(`${directory}/${featureDir}/${file}`, 'utf8');
                    text.replace(/\/\/.*/g, ''); // remove comments
                    text = text.replace(/\/\*((.|\n)*?)\*\//g, ''); // remove line comments

                    // Check if it defines a Feature class and exports it as default
                    if (text.match(/extends\s+Features/) && text.match(/export\s+default/)) {

                        // Ensure it has a static name() method
                        let name = text.match(/static\s+get\s+name\(\)[\s\n]*{[\s\n]*return\s*["'`](.+?)["'`]/);
                        if (name && name[1]) {

                            // Extract the class name
                            let className = text.match(/export\s+default\s+class\s+([A-Za-z0-9_]+)/);
                            
                            // Add to features list
                            features.push({
                                relPath: `./${featureDir}/${file}`,
                                filename: `${directory}/${featureDir}/${file}`,
                                name: name[1],
                                code: text,
                                className: className ? className[1] : name[1]
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

/**
 * Analyzes the code of a feature to find dependencies on other features.
 * @param {Object} feature - The feature to analyze.
 * @param {Array} allFeatures - List of all features to check against.
 * @returns {Object} - An object mapping feature names to dependency info.
 */
function getDependencies(feature, allFeatures) {
    let {code} = feature;

    let featureClass = extractFunction('Features', code);
    let contructorCode = extractFunction('constructor[\\s\\n]*\\((.*?)\\)', featureClass);
    let initialiseCode = extractFunction('initialise[\\s\\n]*\\((.*?)\\)', featureClass);

    let dependencies = {};
    for (let other of allFeatures) {
        if (feature.filename !== other.filename) {
            
            let importRegex = new RegExp(`session.${other.name}`, 'g');
            if (code.match(importRegex)) {
                let isInConstructor = contructorCode && contructorCode.match(importRegex);
                let isInInitialise = initialiseCode && initialiseCode.match(importRegex);
                dependencies[other.name] = {
                        inConstructor: !!isInConstructor,
                        inInitialise: !!isInInitialise
                };
            }
        }
    }

    return dependencies;
}

/**
 * Adds dependency and dependent information to each feature.
 * Also sorts features by the number of dependents.
 * @param {Array} features - List of features to process.
 */
function addDependencies(features) {
    features.forEach(feature => {
        feature.dependencies = getDependencies(feature, features);
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

export function createFeatureList(src) {
    const features = getAllFeatures(src);
    addDependencies(features);

    console.log("\nFeatures: \n\t" + features.map(f => f.name).join("\n\t"));
    const module = [
        "import { relURL } from '../Utilities/usefull-funcs.js';",
        "",
        ...features.map(
            f => `/** @typedef {import('${f.relPath}').default} ${f.className} */`
        ),
        "",
        "export class SquildyFeatureProxy {",
        "",
        ...features.map(
            f => `\t/** @return {${f.className}} */\n\tget ${f.name}() { return this.getFeature("${f.name}"); }\n`
        ),
        "\t/** @override */",
        "\tgetFeature() { }",
        "",
        "}",
        "",
        "export const FeaturesList = [",
        features.map(
            f=>`\t[relURL("${f.relPath}", import.meta), "${f.name}"]`
        ).join(",\n"),
        "];"
    ]
    fs.writeFileSync(src + '/feature-list.js', module.join('\n'));
}

