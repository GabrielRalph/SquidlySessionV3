/**
 * Word Prediction Algorithm Module
 *
 * Predicts the next word after the user types one or more words and space.
 * Uses corpus bigram/n-gram data (5-gram → 4-gram → 3-gram → 2-gram), then 1-gram fallback.
 * Fully local; no LLM, no network.
 */

import { bigrams } from './Corpus/bigrams.js';
import { trigrams } from './Corpus/trigrams.js';
import { fourgrams } from './Corpus/4grams.js';
import { fivegrams } from './Corpus/5grams.js';
import { words } from './Corpus/words.js';

const NGRAM_SOURCES = [
  { n: 5, map: fivegrams },
  { n: 4, map: fourgrams },
  { n: 3, map: trigrams },
  { n: 2, map: bigrams },
];

// 1-gram fallback: top words by frequency
const wordsFiltered = words.filter((w) => w.Word.length > 2);
const TOP_WORDS = wordsFiltered
  .slice(0, 50)
  .map((w) => w.Word);

/** Default suggestions when input is empty or no context (top 4 by frequency). Exported for UI fallback. */
export const topFourWords = TOP_WORDS.slice(0, 4);

/**
 * Get last 1..4 complete words as context for prediction.
 * If input ends with space, last token is complete; otherwise drop the partial last token.
 */
function getContextWords(currentInput) {
  const trimmed = (currentInput || '').trim();
  const tokens = trimmed ? trimmed.split(/\s+/) : [];
  const completeTokens = trimmed && !(currentInput || '').endsWith(' ')
    ? tokens.slice(0, -1)
    : tokens;
  return completeTokens.slice(-4);
}

/**
 * Collect next-word candidates from n-gram tables (longest context first).
 * Each word appears at most once; first occurrence wins (longer context preferred).
 */
function getNextWordCandidates(contextWords) {
  const seen = new Set();
  const order = [];
  // check ngrmas orderly
  for (const { n, map } of NGRAM_SOURCES) {
    if (contextWords.length < n - 1) continue;
    const prefix = contextWords.slice(-(n - 1)).join(' ').toLowerCase();
    const list = map[prefix];
    if (!list) continue;
    for (const { word } of list) {
      if (seen.has(word)) continue;
      seen.add(word);
      order.push(word);
    }
  }
  return order;
}

/**
 * Predicts the next word after the user types a word and space.
 *
 * @param {string} currentInput - The current text (e.g. "you that ")
 * @param {number} maxSuggestions - Maximum number of suggestions (default 6)
 * @returns {Promise<string[]>} - Array of predicted words
 */
export async function predictNextWord(currentInput, maxSuggestions = 6) {
  await new Promise((r) => setTimeout(r, 0));
  return predictNextWordSync(currentInput, maxSuggestions);
}

/**
 * Synchronous next-word prediction using corpus n-grams and 1-gram fallback.
 *
 * @param {string} currentInput - The current text (e.g. "you that ")
 * @param {number} maxSuggestions - Maximum number of suggestions (default 6)
 * @returns {string[]} - Array of predicted words
 */
export function predictNextWordSync(currentInput, maxSuggestions = 6) {
  const contextWords = getContextWords(currentInput);
  const candidates = getNextWordCandidates(contextWords);

  if (candidates.length >= maxSuggestions) {
    return candidates.slice(0, maxSuggestions);
  }

  const out = candidates.slice();
  for (const w of TOP_WORDS) {
    if (out.length >= maxSuggestions) break;
    if (!out.includes(w)) out.push(w);
  }
  return out.slice(0, maxSuggestions);
}
