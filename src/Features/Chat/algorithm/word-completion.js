/**
 * Word Completion Algorithm Module
 * 
 * This module provides word completion functionality for the keyboard panel.
 * Completes partially typed words (e.g., "hello wor" → "world", "work", "word").
 * 
 * Algorithm implementation based on word frequency data.
 */

import { words } from './Corpus/words.js';

// Filter words with length > 2 (as per algorithm team's logic)
// Cache the filtered words to avoid re-filtering on every call
const wordsFiltered = words.filter(word => word.Word.length > 2);

/**
 * Completes a partially typed word
 * 
 * @param {string} partialWord - The partially typed word (e.g., "hello wor")
 * @param {number} maxSuggestions - Maximum number of suggestions to return (default: 6)
 * @returns {Promise<string[]>} - Array of completed word suggestions (up to maxSuggestions)
 * 
 * @example
 * const suggestions = await completeWord("hello wor", 6);
 * // Returns: ["world", "work", "word", "worry", "works", "worn"]
 */
export async function completeWord(partialWord, maxSuggestions = 6) {
    // Simulate async operation (algorithm might need to load models, query APIs, etc.)
    await new Promise(resolve => setTimeout(resolve, 10));

    return completeWordSync(partialWord, maxSuggestions);
}

/**
 * Alternative synchronous version (if algorithm doesn't need async operations)
 * 
 * @param {string} partialWord - The partially typed word
 * @param {number} maxSuggestions - Maximum number of suggestions to return (default: 6)
 * @returns {string[]} - Array of completed word suggestions (up to maxSuggestions)
 */
export function completeWordSync(partialWord, maxSuggestions = 6) {
    const inputWords = partialWord.split(/\s+/)
    // Get the last word from input (split by whitespace and get last part)
    const usedLastWord = inputWords.pop();
    const lastWord = usedLastWord.toLowerCase();

    // No partial word (e.g. input ends with space): next-word prediction is handled by word-prediction.js; return empty.
    if (!lastWord || lastWord.length === 0) {
        return [];
    }

    // Filter words that start with the partial word and are not the same word
    const suggestions = wordsFiltered
        .filter(word =>
            word.Word.toLowerCase().startsWith(lastWord) &&
            word.Word.toLowerCase() !== lastWord
        )
        .slice(0, maxSuggestions * 2); // Get more candidates for sorting

    // Sort by frequency (FREQcount) - higher frequency first (descending)
    // Note: FREQcount is stored as string, so convert to number for comparison
    // words.js uses "FREQcount" (lowercase c)
    suggestions.sort((a, b) => {
        const freqA = parseInt(a.FREQcount || "0", 10);
        const freqB = parseInt(b.FREQcount || "0", 10);
        return freqB - freqA; // Descending order (higher frequency first)
    });

    // Extract word strings and return up to maxSuggestions
    const topSuggestions = suggestions
        .slice(0, maxSuggestions)
        .map(word => word.Word);
    return topSuggestions.length === 0 ? [usedLastWord] : topSuggestions;
}

