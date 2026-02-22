/**
 * Word Completion Algorithm Module
 * 
 * This module provides word completion functionality for the keyboard panel.
 * Completes partially typed words (e.g., "hello wor" → "world", "work", "word").
 * 
 * Algorithm implementation based on word frequency data.
 */

import { bigrams } from './bigrams.js';
import { trigrams } from './trigrams.js';
import { fourgrams } from './4grams.js';
import { fivegrams } from './5grams.js';
import { words as _WORDS} from './words.js';


const NGRAMS = [
  bigrams,
  trigrams,
  fourgrams,
  fivegrams,
];

// Ensure n-grams are sorted by frequency for efficient suggestion retrieval
for (const ngram of NGRAMS) {
    for (const key in ngram) {
        ngram[key] = ngram[key].sort((a, b) => b.freq - a.freq);
    }
}

// ensure words are sorted by frequency as well
const WORDS = _WORDS.filter(word => word.word.length > 2);
_WORDS.sort((a, b) => b.Freq - a.Freq);

function findMatchingNgrams(words, lastWord) {
  let ngramMatches = [];
  for (let i = 0; i < words.length && i < NGRAMS.length; i++) {

    // For each n-gram level, we take the last i+1 words and check if they exist in the corresponding NGRAMS[i]
    const gram = words.slice(-(i+1)).join(" ");
    if (gram in NGRAMS[i]) {
      // If the n-gram exists, we filter the possible next words to those that start with the last word fragment
      let nextWords = NGRAMS[i][gram].filter(w => w.word.startsWith(lastWord));
      if (nextWords.length > 0) {
        ngramMatches.unshift(...nextWords);
      }
    }
  }

  return unique(ngramMatches)
}


function unique(options) {
  let included = new Set();
  return options.filter(w => {
    if (included.has(w.word)) {
      return false;
    } else {
      included.add(w.word);
      return true;
    }
  });
}

function getWordsStartingWith(fragment) {
  if (fragment === "") {
    return WORDS;
  } else {
    return WORDS.filter(w => w.word.startsWith(fragment));
  }
};



export function getSuggestions(input, maxSuggestions = 5) {

  let words = input.toLowerCase().split(/\s+/)
  let lastWord = words.pop();

  let suggestions = findMatchingNgrams(words, lastWord);
  if (suggestions.length < maxSuggestions) {
    const wordMatches = getWordsStartingWith(lastWord, maxSuggestions).slice(0, maxSuggestions*2);
    suggestions.push(...wordMatches);
    suggestions = unique(suggestions);
  }


  if (suggestions.length === 0) {
    suggestions = [{word: lastWord, freq: 0}];
  }

  suggestions = suggestions.slice(0, maxSuggestions).map(s => ({word: s.word, freq: s.freq}));

  if (lastWord.length > 0) {
    let lastWordCapitalized = input.split(/\s+/).pop();
    for (let word of suggestions) {
      word.word = word.word.replace(lastWord, lastWordCapitalized);
    }
  } else if (words.length == 0 || words[words.length - 1].endsWith(".")) {
    // If there is no last word and this is the first word, capitalize suggestions
    for (let word of suggestions) {
      word.word = word.word.charAt(0).toUpperCase() + word.word.slice(1);
    }
  } 

  return suggestions;
}

