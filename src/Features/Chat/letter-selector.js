/**
 * Letter Selector Module
 * 
 * Handles letter selection UI components for the keyboard panel.
 * Provides LetterIcon, LettersIcon, LetterLayout, and related events.
 */
import { GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { LetterIcon, LettersIcon } from "../../Utilities/search.js";
// Letter layout for displaying 9 letters in a 2x5 grid
// Row 0: A-E (5 letters), Row 1: F-I (4 letters)
// Each letter button is the same size as back button (1 grid cell)
export class LetterLayout extends GridLayout {
    constructor() {
        super(2, 5); // 2 rows, 5 columns
        this.add(new GridIcon({
            type: "action",
            displayValue: "Delete", // Empty space for alignment
            symbol: "back",
        }, "ll-row-1"), 1, 4)
    }

    /**
     * Show the letters in the letter grid.
     * @param {string} letters - String of letters to display (e.g., "abcdefghi")
     * @param {boolean} [immediate=false] - If true, set the content immediately without transition.
     */
    async showLetters(letters, immediate = false) {
        this.innerHTML = "";
        const lettersArray = [...letters].slice(0, 9);

        // Functional approach: calculate row/col instead of if-else
        lettersArray.forEach((letter, i) => {
            const icon = new LetterIcon(letter, `ll-row-${Math.floor(i / 5)}`);
            const row = Math.floor(i / 5); // 0 for first 5, 1 for next 4
            const col = i % 5; // Column position within row
            this.add(icon, row, col);
        });
    }
}

export {LetterIcon, LettersIcon};