import { SearchBar } from "../../Utilities/search.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { GridCard, GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { Rotater } from "../../Utilities/rotater.js";
import { HideShowTransition } from "../../Utilities/hide-show.js";
import { completeWord, topFourWords } from "./algorithm/index.js";
import { LetterIcon, LettersIcon, LetterLayout } from "./letter-selector.js";

// WordSuggestionIcon - similar to OptionIcon in search.js, but for word suggestions
class WordSuggestionIcon extends GridIcon {
    constructor(word, index, group) {
        super({
            symbol: null, // No symbol, only text
            displayValue: word, // Main word (large, bold) - displayed at top
            type: "adjective",
            events: {
                "access-click": (e) => {
                    const event = new AccessEvent("word-suggestion", e, {
                        bubbles: true
                    });
                    // Set detail property directly on the event
                    event.detail = { word };
                    this.dispatchEvent(event);
                }
            }
        }, group);
        this.word = word;
        this.index = index;
        this.styles = {
            "--shadow-color": "transparent",
            // "pointer-events": "all",
            "--main-color": "#dbe4ff",
            "--tab-color": "#b8c8f9"
        };
    }
}


export class ChatInput extends GridCard {
    constructor() {
        super("search-bar", "normal");

        this.input = this.content.createChild("textarea", {events: {
            "focusin": (e) => {
                this.toggleAttribute("hover", true)
            },
            "focusout": (e) => {
                this.toggleAttribute("hover", false)

            }
        }})
        this.input.setAttribute("placeholder", "Type...");

    }

    get value() {
        return this.input.value;
    }
    set value(value) {
        this.input.value = value;
    }
}


// Letter selection components are now imported from letter-selector.js

// KeyboardPanel should extend HideShowSlide like SearchWindow, not OccupiableWindow
export class KeyboardPanel extends HideShowTransition {
    constructor(feature) {
        super("keyboard-panel", "up");
        this.feature = feature;
        this.build();
    }

    build() {
        console.log("[KeyboardPanel] build() called");

        // Create 3x5 grid layout (3 rows, 5 columns)
        this.grid = this.createChild(GridLayout, {
            class: "keyboard-panel-grid",
        }, 3, 5);

        // Create input bar (SearchBar) - blue background
        this.inputBar = this.createChild(ChatInput, {events: {
            "keydown": (e) => {
                const handler = keyHandlers[e.key];
                handler && handler(e);
            },
            "input": () => this._updateWordSuggestions()
        }});


        // Start with default mode
        this.mode = "default";

        // Store rotaters for letter groups and numbers
        this.rotaters = {};
        this.activeRotater = null; // Track which rotater is currently showing letters
        this.activeLetters = null; // Store the current letters being displayed

        // Debounce timer for word suggestions to avoid excessive calls
        this._suggestionUpdateTimer = null;

        // Create word suggestions area - single shared area that moves between positions
        // In default mode: shows in columns 1-2 of main grid
        // In letters mode: shows in columns 3-4 of main grid
        this.wordSuggestionsArea = this.createChild(GridLayout, {
            class: "word-suggestions-area",
        }, 2, 2); // 2 rows, 2 columns for 4 suggestions

        // Initially add to main grid (default mode position: columns 2-3, rows 1-2)
        // Suggestions are positioned below the input field (which spans columns 2-3)
        // this.grid.add(this.wordSuggestionsArea, 1, 2, 2, 3); // Span rows 1-2, columns 2-3
        this.wordSuggestions = []; // Store current word suggestions
        this._wordSuggestionsPosition = "center"; // Track current position: "center" or "right"

        // Initialize with empty suggestions - no placeholders, just blank
        this.setWordSuggestions([]);
        // Show the suggestions area (will be blank if no suggestions)
        // this.wordSuggestionsArea.style.display = "grid";

        // Listen for events from letter icons (events bubble up)
        // LetterIcon dispatches LetterEvent("letter") which bubbles to here
        this.addEventListener("letter", (e) => {
            this._handleLetter(e.value);
        });

        // Exit button (top-left, 0,0)
        // Icon will switch between "downArrow" (default) and "back" (letters mode)
        // Event handler will be set later to handle mode switching
        this.pullDown = new GridIcon({
            symbol: "downArrow",
            displayValue: "Keyboard",
            type: "action",
        }, "chat");
        this.pullDown.styles = {
            "--shadow-color": "transparent",
            "pointer-events": "all",
        }

        // Space button (top row, position 1,0)
        let spaceIcon = new GridIcon({
            symbol: "space",
            displayValue: "Space",
            type: "action",
            events: {
                "access-click": (e) => {
                    this._handleLetter(' ');
                }
            }
        }, "chat");
        spaceIcon.styles = {
            "--shadow-color": "transparent",
            "pointer-events": "all",
        }

        // Send button (top-right, 0,4) - same as chat.js
        let sendIcon = new GridIcon({
            symbol: "send",
            displayValue: "Send",
            type: "action",
            events: {
                "access-click": async (e) => {
                    const text = this.inputBar?.value?.trim();
                    if (!text) return;

                    // Clear input immediately for better UX
                    this.inputBar.value = '';
                    // Send message asynchronously (don't wait for result)
                    this.feature._sendMessage(text).catch(error => {
                        console.error("[KeyboardPanel] Error sending message:", error);
                    });
                }
            }
        }, "chat");
        sendIcon.styles = {
            "--shadow-color": "transparent",
            "pointer-events": "all",
        }

        // Create a Rotater that contains the entire bottom area (2 rows x 5 columns)
        // This rotater will flip between showing the default layout and the letter grid
        // The entire 2x5 area will rotate together as a whole
        this.rotaters.letters = this.createChild(Rotater);

        // Create all buttons first
        // ATOI button (row 0, col 0)
        let atoiIcon = new LettersIcon("atoi", "chat");
        atoiIcon.styles = { "--shadow-color": "transparent", "pointer-events": "all" };
        atoiIcon.addEventListener("show-letters", (e) => {
            e.stopPropagation();
            this._handleLetterGroup(e.letters, e);
        });

        // JTOR button (row 1, col 0)
        let jtorIcon = new LettersIcon("jtor", "chat");
        jtorIcon.styles = { "--shadow-color": "transparent", "pointer-events": "all" };
        jtorIcon.addEventListener("show-letters", (e) => {
            e.stopPropagation();
            this._handleLetterGroup(e.letters, e);
        });

        // STO0 button (row 0, col 1)
        let sto0Icon = new LettersIcon("sto0", "chat");
        sto0Icon.styles = { "--shadow-color": "transparent", "pointer-events": "all" };
        sto0Icon.addEventListener("show-letters", (e) => {
            e.stopPropagation();
            this._handleLetterGroup(e.letters, e);
        });

        // 1-9 button (row 1, col 1)
        let numIcon = new LettersIcon("1to9", "chat");
        numIcon.styles = { "--shadow-color": "transparent", "pointer-events": "all" };
        numIcon.addEventListener("show-letters", (e) => {
            e.stopPropagation();
            this._handleLetterGroup(e.letters, e);
        });

        // Delete button (row 0, col 4)
        let deleteIcon = new GridIcon({
            symbol: "back",
            displayValue: "Delete",
            type: "action",
            events: {
                "access-click": (e) => {
                    e.stopPropagation();
                    this._deleteCharacter();
                }
            }
        }, "chat");
        deleteIcon.styles = { "--shadow-color": "transparent", "pointer-events": "all" };

        // Enter button (row 1, col 4)
        let enterIcon = new GridIcon({
            symbol: "leftArrow",
            displayValue: "Enter",
            type: "action",
            events: {
                "access-click": (e) => {
                    e.stopPropagation();
                    this._insertNewline();
                }
            }
        }, "chat");
        enterIcon.styles = { "--shadow-color": "transparent", "pointer-events": "all" };

        // Store references
        // this.sto0Icon = sto0Icon;
        // this.numIcon = numIcon;
        // this.deleteIcon = deleteIcon;
        // this.enterIcon = enterIcon;
        // this.rightColumnButtons = {
        //     delete: deleteIcon,
        //     enter: enterIcon,
        //     sto0: sto0Icon,
        //     num: numIcon
        // };

        // Default layout: 2x5 grid containing all buttons
        // This entire layout will rotate as a whole
        const defaultLetterLayout = new GridLayout(2, 5);
        defaultLetterLayout.add(atoiIcon, 0, 0); // A-I
        defaultLetterLayout.add(jtorIcon, 1, 0); // J-R
        defaultLetterLayout.add(sto0Icon, 0, 1); // S-Z
        defaultLetterLayout.add(numIcon, 1, 1);  // 1-9
        defaultLetterLayout.add(this.wordSuggestionsArea, 0, 2, 1, 3);
        defaultLetterLayout.add(deleteIcon, 0, 4); // Delete
        defaultLetterLayout.add(enterIcon, 1, 4);  // Enter


        this.rotaters.letters.setContent(defaultLetterLayout, true);

        // Buttons are now created above and stored in references

        // Exit button handlers - strategy pattern
        const exitHandlers = {
            letters: (e) => {
                console.log("[KeyboardPanel] Returning to default mode from letters mode");
                e.waitFor(this._setMode("default", false));
            },
            default: async () => {
                console.log("[KeyboardPanel] Hiding panel from default mode");
                await this.hide(500);
            }
        };

        this.pullDown.events = {
            "access-click": async (e) => {
                console.log("[KeyboardPanel] Exit button clicked, current mode:", this.mode, "icon:", this.pullDown.symbol);
                const handler = exitHandlers[this.mode];
                handler && await handler(e);
            }
        };

        // Layout for 3-row design:
        // Row 0: Exit (0,0), Space (0,1), Input (0,2 to 0,3 spanning 2 cols), Send (0,4)
        this.grid.add(this.pullDown, 0, 0);
        this.grid.add(spaceIcon, 0, 1);
        this.grid.add(this.inputBar, 0, 2, 0, 3); // Span 2 columns
        this.grid.add(sendIcon, 0, 4);

        // Row 1-2: Rotater containing entire bottom area (2 rows x 5 columns)
        // This rotater contains: A-I, J-R, S-Z, 1-9, Delete, Enter
        // The entire 2x5 area will rotate together as a whole
        this.grid.add(this.rotaters.letters, 1, 0, 2, 5);
    }

    // _setupTextarea() {
    //     const oldInput = this.inputBar.input;
    //     const textarea = this.inputBar.content.createChild("textarea");
    //     textarea.setAttribute("placeholder", "Type...");
    //     oldInput?.value && (textarea.value = oldInput.value);

    //     // Key handlers - strategy pattern
    //     const keyHandlers = {
    //         Escape: (e) => {
    //             textarea.blur();
    //             e.preventDefault();
    //         }
    //     };

    //     textarea.events = {
    //         "focusin": () => this.inputBar.toggleAttribute("hover", true),
    //         "focusout": () => this.inputBar.toggleAttribute("hover", false),
            
    //     };

    //     oldInput.remove();
    //     this.inputBar.input = textarea;
    // }

    // Mode handlers - strategy pattern to reduce if statements
    _modeHandlers = {
        default: async () => {
            // Flip back all active rotaters to show buttons
            this.activeRotater && this.activeLetters && await this._restoreDefaultLayout();

            // Update UI elements
            this.pullDown && (this.pullDown.symbol = "downArrow") && (this.pullDown.displayValue = "Keyboard");
            // this._moveSuggestionsToCenter();
            this._updateWordSuggestions();
            console.log("[KeyboardPanel] Showing default mode");
        },
        letters: () => {
            // Update UI elements
            this.pullDown && (this.pullDown.symbol = "back") && (this.pullDown.displayValue = "Back");
            this.wordSuggestionsArea && (this.wordSuggestionsArea.style.display = "none");
            console.log("[KeyboardPanel] Showing letters mode");
        }
    };

    async _setMode(mode, immediate = false) {
        if (this.mode === mode) return;

        this.mode = mode;
        console.log("[KeyboardPanel] Setting mode to:", mode);

        const handler = this._modeHandlers[mode];
        handler && await handler();
    }

    async _restoreDefaultLayout() {
        if (this.activeRotater !== this.rotaters.letters) return;

        // // Recreate default layout with all buttons (2x5 grid)
        // const defaultLetterLayout = new GridLayout(2, 5);

        // // Recreate ATOI button
        // const atoiIcon = new LettersIcon("atoi", "chat");
        // atoiIcon.styles = { "--shadow-color": "transparent", "pointer-events": "all" };
        // atoiIcon.addEventListener("show-letters", (e) => {
        //     e.stopPropagation();
        //     this._handleLetterGroup(e.letters, e);
        // });
        // defaultLetterLayout.add(atoiIcon, 0, 0);

        // // Recreate JTOR button
        // const jtorIcon = new LettersIcon("jtor", "chat");
        // jtorIcon.styles = { "--shadow-color": "transparent", "pointer-events": "all" };
        // jtorIcon.addEventListener("show-letters", (e) => {
        //     e.stopPropagation();
        //     this._handleLetterGroup(e.letters, e);
        // });
        // defaultLetterLayout.add(jtorIcon, 1, 0);

        // Add STO0, 1-9, Delete, Enter buttons
        // defaultLetterLayout.add(this.sto0Icon, 0, 1);
        // defaultLetterLayout.add(this.numIcon, 1, 1);
        // defaultLetterLayout.add(this.deleteIcon, 0, 4);
        // defaultLetterLayout.add(this.enterIcon, 1, 4);


        await this.activeRotater.setContent(this.defaultLetterLayout, false);

        // this.activeRotater = null;
        // this.activeLetters = null;
    }

    // _moveSuggestionsToCenter() {
    //     if (!this.wordSuggestionsArea || this._wordSuggestionsPosition === "center") return;

    //     this.wordSuggestionsArea.parentNode?.removeChild(this.wordSuggestionsArea);
    //     this.grid.add(this.wordSuggestionsArea, 1, 2, 2, 3);
    //     this._wordSuggestionsPosition = "center";
    // }

    _deleteCharacter() {
        // Optional chaining and early return pattern
        const input = this.inputBar?.input;
        if (!input) return;

        const currentValue = input.value || '';
        const cursorPos = input.selectionStart ?? currentValue.length;
        if (cursorPos <= 0) return;

        // Functional approach: create new value without mutation
        const newValue = currentValue.slice(0, cursorPos - 1) + currentValue.slice(cursorPos);
        input.value = newValue;
        input.setSelectionRange(cursorPos - 1, cursorPos - 1);
        this.inputBar.value = newValue;
    }

    _insertNewline() {
        // Optional chaining and early return pattern
        const input = this.inputBar?.input;
        if (!input) return;

        const currentValue = input.value || '';
        const cursorPos = input.selectionStart ?? currentValue.length;
        const newValue = currentValue.slice(0, cursorPos) + '\n' + currentValue.slice(cursorPos);

        input.value = newValue;
        input.setSelectionRange(cursorPos + 1, cursorPos + 1);
        this.inputBar.value = newValue;

        // Functional approach: use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
            input.scrollTop = input.scrollHeight;
        });
    }

    _setButtonsVisibility(display) {
        // Optional chaining and functional approach
        const buttons = this.rightColumnButtons;
        if (!buttons) return;

        // Functional programming: filter and map pattern
        Object.values(buttons)
            .filter(Boolean)
            .forEach(button => button.style.display = display);
    }

    async _handleLetterGroup(letters, e) {
        console.log("[KeyboardPanel] _handleLetterGroup called with letters:", letters);

        // Guard clause with early return
        if (!this.rotaters.letters) {
            console.error("[KeyboardPanel] Letters rotater not found");
            return;
        }

        // Optional chaining pattern
        // this.wordSuggestionsArea && (this.wordSuggestionsArea.style.display = "none");

        // Factory pattern: create letter grid
        const letterGrid = this._createLetterGrid(letters);

        // Store state
        this.activeLetters = letters;
        this.activeRotater = this.rotaters.letters;

        // Strategy pattern: handle promise based on event existence
        const flipPromise = this.rotaters.letters.setContent(letterGrid, false);
        const flipHandlers = {
            true: (promise) => e.waitFor(promise),
            false: (promise) => promise
        };
        await flipHandlers[!!e](flipPromise);

        this.mode = "letters";
        console.log("[KeyboardPanel] Letters shown with flip animation, switching to letters mode");

        // Functional approach: update UI in next frame
        requestAnimationFrame(() => {
            this.pullDown && (this.pullDown.symbol = "back") && (this.pullDown.displayValue = "Back");
        });
    }

    _createLetterGrid(letters) {
        const letterGrid = new LetterLayout();
        const lettersArray = [...letters].slice(0, 9);

        // Functional approach: calculate position instead of if-else
        lettersArray.forEach((letter, i) => {
            const icon = new LetterIcon(letter, `letter-${Math.floor(i / 5)}`);
            const row = Math.floor(i / 5); // 0 for first 5, 1 for next 4
            const col = i % 5; // Column position within row
            letterGrid.add(icon, row, col);
        });

        // Add Delete button in the bottom-right corner (row 1, col 4)
        const deleteIcon = new GridIcon({
            symbol: "back",
            displayValue: "Delete",
            type: "action",
            events: {
                "access-click": (e) => {
                    e.stopPropagation();
                    this._deleteCharacter();
                }
            }
        }, "chat");
        deleteIcon.styles = {
            "--shadow-color": "transparent",
            "pointer-events": "all",
        };
        letterGrid.add(deleteIcon, 1, 4); // Bottom-right corner

        return letterGrid;
    }

    _handleLetter(letter) {
        console.log("[KeyboardPanel] Letter selected:", letter);
        const input = this.inputBar?.input;
        if (!input) return;

        this.inputBar.value = (this.inputBar.value || '') + letter;
        this._updateWordSuggestions();
        //TODO back button
        // this._restoreDefaultLayout()

    }

    /**
     * Initialize word suggestions with placeholder or actual words
     * @param {string[]} words - Array of word suggestions (up to 6 words)
     * @private
     */
    _initializeWordSuggestions(words) {
        this.wordSuggestionsArea && this.setWordSuggestions(words);
    }

    /**
     * Update word suggestions display
     * @param {string[]} words - Array of word suggestions (up to 6 words)
     */
    // Word suggestion styles - factory pattern
    // _wordSuggestionStyles = {
    //     active: {
    //         "--shadow-color": "transparent",
    //         "pointer-events": "all",
    //         "--main-color": "#dbe4ff",
    //         "--tab-color": "#b8c8f9"
    //     },
    //     placeholder: {
    //         "--shadow-color": "transparent",
    //         "pointer-events": "none",
    //         opacity: "0.5",
    //         "--main-color": "#f0f0f0",
    //         "--tab-color": "#e0e0e0"
    //     }
    // };

    setWordSuggestions(words) {
        if (!Array.isArray(words) || words.length === 0) {
            words = topFourWords;
        }
        // Early return pattern - guard clause
        if (!this.wordSuggestionsArea) {
            console.warn("[KeyboardPanel] Word suggestions area not found");
            return;
        }

        this.wordSuggestionsArea.innerHTML = "";
        this.wordSuggestions = words || [];
        const maxWords = Math.min(4, this.wordSuggestions.length);

        // Early return if no suggestions - leave area blank
        if (maxWords === 0) return;

        // Factory pattern: create suggestion icons
        const createSuggestionIcon = (word, index) => {
            const icon = this._createWordSuggestionIcon(word, index);
            this.wordSuggestionsArea.add(icon, Math.floor(index / 2), index % 2);
        };

        // Create word suggestion buttons
        this.wordSuggestions.slice(0, maxWords).forEach(createSuggestionIcon);

    }

    _createWordSuggestionIcon(word, index) {
        const wordIcon = new WordSuggestionIcon(word, index, "chat");
        // Object.assign(wordIcon.styles, this._wordSuggestionStyles.active);

        wordIcon.addEventListener("word-suggestion", (e) => {
            e.stopPropagation();
            const wordValue = e.detail?.word ?? e.word ?? wordIcon.word;
            this._handleWordSuggestion(wordValue, e);
        });

        return wordIcon;
    }


    /**
     * Handle word suggestion click
     * Replace the current incomplete word with the selected suggestion
     * @param {string} word - The selected word
     * @param {Event} e - The click event
     */
    _handleWordSuggestion(word, e) {
        console.log("[KeyboardPanel] Word suggestion selected:", word);
        // Guard clause with optional chaining
        const input = this.inputBar?.input;
        if (!input) return;

        const currentValue = this.inputBar.value || '';
        const cursorPos = input.selectionStart ?? currentValue.length;
        const textBeforeCursor = currentValue.substring(0, cursorPos);
        const wordMatch = textBeforeCursor.match(/(\S*)$/);
        const currentWord = wordMatch?.[1] ?? '';
        const wordStartPos = cursorPos - currentWord.length;
        const beforeWord = currentValue.substring(0, wordStartPos);
        const afterCursor = currentValue.substring(cursorPos);

        // Functional approach: determine space after using regex test
        const spaceAfter = afterCursor.length > 0 || !/^\s/.test(afterCursor) ? ' ' : '';
        const newValue = beforeWord + word + spaceAfter + afterCursor;

        input.value = newValue;
        input.setSelectionRange(wordStartPos + word.length + spaceAfter.length, wordStartPos + word.length + spaceAfter.length);
        this.inputBar.value = newValue;

        requestAnimationFrame(() => this._updateWordSuggestions());
    }

    /**
     * Update word suggestions based on current input
     * This method calls the word completion algorithm and updates the UI
     * Uses debouncing to avoid excessive calls
     * Works in both default and letters mode
     * @private
     */
    // Display mode mapping for suggestions
    _suggestionDisplayMode = {
        letters: "none",
        default: "grid"
    };

    async _updateWordSuggestions() {
        // Guard clause with optional chaining
        const input = this.inputBar?.input;
        if (!input) return;

        // Clear existing timer
        clearTimeout(this._suggestionUpdateTimer);

        // Debounce: wait 200ms after user stops typing before updating suggestions
        this._suggestionUpdateTimer = setTimeout(async () => {
            const currentInput = this.inputBar.value || '';
            const hasInput = currentInput.trim().length > 0;

            try {
                // Functional approach: conditional execution
                const suggestions = hasInput ? await completeWord(currentInput, 4) : [];
                this.setWordSuggestions(suggestions);
            } catch (error) {
                console.error("[KeyboardPanel] Error completing words:", error);
                this.setWordSuggestions([]);
            } finally {
                // Strategy pattern: use display mode map
                const displayMode = this._suggestionDisplayMode[this.mode] ?? "grid";
                this.wordSuggestionsArea && (this.wordSuggestionsArea.style.display = displayMode);
            }
        }, 200);
    }

    // Override hide() to remove keyboard-open class from parent chat-window
    async hide(duration = 400) {
        // Sync input value from keyboard panel to main input bar before hiding
        const mainInputBar = this.feature?.chatWindow?.inputBar;
        if (mainInputBar && this.inputBar) {
            mainInputBar.value = this.inputBar.value || '';
            // Also sync the underlying textarea/input element
            mainInputBar.input && this.inputBar.input && (mainInputBar.input.value = this.inputBar.input.value || '');
        }

        // Get chat history element for synchronized animation
        const chatWindow = this.closest("chat-window");
        const chatHistory = chatWindow?.querySelector(".chat-history");
        const gridLayout = chatWindow?.querySelector("grid-layout");

        // CRITICAL: Set all backgrounds BEFORE any grid-row changes
        if (chatHistory) {
            chatHistory.style.setProperty('background', '#f7f7fb', 'important');
        }
        if (gridLayout) {
            gridLayout.style.setProperty('background', '#f7f7fb', 'important');
        }

        // Force reflow to ensure backgrounds are painted
        chatHistory?.offsetHeight;
        gridLayout?.offsetHeight;

        // Wait for paint to complete
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Remove class to trigger grid-row change AFTER background is painted
        chatWindow?.classList.remove("keyboard-open");

        // Force reflow again to ensure grid-row change is applied
        chatHistory?.offsetHeight;

        // Wait one more frame before starting animation
        await new Promise(resolve => requestAnimationFrame(resolve));

        await super.hide(duration);
    }

    // Override show() to add keyboard-open class to parent chat-window and scroll to bottom
    async show(duration = 400, hide = true) {
        // Sync input value from main input bar to keyboard panel before showing
        const mainInputBar = this.feature?.chatWindow?.inputBar;
        if (mainInputBar && this.inputBar) {
            this.inputBar.value = mainInputBar.value || '';
            // Also sync the underlying textarea/input element
            this.inputBar.input && mainInputBar.input && (this.inputBar.input.value = mainInputBar.input.value || '');
        }

        // Get chat history element for synchronized animation
        const chatWindow = this.closest("chat-window");
        const chatHistory = chatWindow?.querySelector(".chat-history");
        const gridLayout = chatWindow?.querySelector("grid-layout");

        // CRITICAL: Set all backgrounds BEFORE any grid-row changes
        if (chatHistory) {
            chatHistory.style.setProperty('background', '#f7f7fb', 'important');
        }
        if (gridLayout) {
            gridLayout.style.setProperty('background', '#f7f7fb', 'important');
        }

        // Force reflow to ensure backgrounds are painted
        chatHistory?.offsetHeight;
        gridLayout?.offsetHeight;

        // Wait for paint to complete
        await new Promise(resolve => requestAnimationFrame(resolve));

        // Add class to trigger grid-row change AFTER background is painted
        chatWindow?.classList.add("keyboard-open");

        // Force reflow again to ensure grid-row change is applied
        chatHistory?.offsetHeight;

        // Wait one more frame before starting animation
        await new Promise(resolve => requestAnimationFrame(resolve));

        await super.show(duration, hide);

        // Update word suggestions after input is synced (important: trigger suggestions for synced text)
        this._updateWordSuggestions();

        // Scroll chat history to bottom
        this.feature?.chatWindow?.chatHistory && setTimeout(() => {
            this.feature.chatWindow.chatHistory.scrollToBottom();
        }, duration + 50);
    }

    // get shown() is inherited from HideShow

    static get usedStyleSheets() {
        return [
            relURL("./keyboard-panel.css", import.meta),
            relURL("./letter-selector.css", import.meta),
            GridIcon.styleSheet,
            Rotater.styleSheet,
        ]
    }

    static get fixToolBarWhenOpen() { return true }
}
