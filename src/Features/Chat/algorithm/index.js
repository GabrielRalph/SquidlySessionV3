/**
 * Algorithm Module Index
 * 
 * This file serves as a central export point for all algorithm modules.
 * Import algorithms from here for better organization and easier refactoring.
 */

// Word prediction algorithms (predicts next word after space)
export { predictNextWord, predictNextWordSync } from "./word-prediction.js";

// Word completion algorithms (completes partially typed words)
export { completeWord, completeWordSync, topFourWords } from "./word-completion.js";

// TODO: Future algorithm modules can be added here:
// export { spellCheck, spellCheckSync } from "./spell-check.js";
// etc.
