import { AccessEvent } from "./Buttons/access-buttons.js";
import { GridCard, GridIcon, GridLayout } from "./Buttons/grid-icon.js";
import { HideShowTransition } from "./hide-show.js";
import { Rotater, Slider } from "./rotater.js";
import { relURL } from "./usefull-funcs.js";

/**
 * @typedef {Object} SearchItem 
 * @property {Object} icon - Icon representing the item
 */

/**
 * @typedef {Object} DefaultLayoutTemplateItem
 * @property {("LetterIcon"|"LettersIcon"|"IncrementIcon")} type - type for the icon either LetterIcon, IncrementIcon, or LettersIcon
 * @property {Array} params - Parameters to pass to the class constructor
 */

export const LETTER_GROUPS = {
    "atoi": {
        letters: "abcdefghi",
        icon: {symbol: "atoi", type: "topic-action"},
    },
    "jtor": {
        letters: "jklmnopqr",
        icon: {symbol: "jtor", type: "topic-action"},
    },
    "sto0": {
        letters: "stuvwxyz0",
        icon: {symbol: "sto0", type: "topic-action"},
    },
    "1to9": {
        letters: "123456789",
        icon: {symbol: "1to9", type: "topic-action"},
    }
}

export const SPECIAL_LETTERS = {
    "space": {
        displayValue: "Space",
        symbol: "space",
        type: "action",
        letterValue: " ",
    }
}


export class LettersEvent extends AccessEvent {
    constructor(letters, originalEvent) {
        super("show-letters", originalEvent, {bubbles: true});
        this.letters = letters;
    }
}

export class LetterEvent extends AccessEvent {
    constructor(letter, originalEvent) {
        super("letter", originalEvent, {bubbles: true});
        this.value = letter in SPECIAL_LETTERS ? SPECIAL_LETTERS[letter].letterValue : letter;
    }
}

class IncrementEvent extends AccessEvent {
    constructor(inc, originalEvent) {
        super("increment", originalEvent, {bubbles: true});
        this.value = inc;
    }
}

class OptionEvent extends AccessEvent {
    constructor(option, originalEvent) {
        super("value", originalEvent, {bubbles: true});
        this.value = option;
    }
}



export class SearchBar extends GridCard {
    constructor() {
        super("search-bar", "normal");

        this.pageStatus = this.content.createChild("div", {class: "page-status"});
        this.pageStatusText = this.pageStatus.createChild("span", {class: "page-status-text"});
        this.pageStatusBar = this.pageStatus.createChild("div", {class: "page-status-bar"});
        this.input = this.content.createChild("input", {events: {
            "focusin": (e) => {
                this.toggleAttribute("hover", true)
            },
            "focusout": (e) => {
                this.toggleAttribute("hover", false)

            },
            "keydown": (e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                    this.input.blur();
                    e.preventDefault();
                }
            },
        }})
        this.input.setAttribute("placeholder", "Search...");

    }

    setProgress(current, max) {
        max = max + 1;
        let page = Math.floor(current / 9) + 1;
        let total = Math.ceil(max / 9);

        this.pageStatusText.textContent = `${page} / ${total}`;

        this.pageStatus.styles = {
            "display": max < 10 ? "none" : null,
            "--page-p": 9 / max,
            "--pos-p": (page - 1) / (total - 1),
        }
    }

    get value() {
        return this.input.value;
    }
    set value(value) {
        this.input.value = value;
    }

}

export class LetterIcon extends GridIcon {
    constructor(letter, group) {
        let config = SPECIAL_LETTERS[letter] || {type: "adjective", symbol: {text: letter.toUpperCase()}};
        config.events = { "access-click": (e) => { this.dispatchEvent(new LetterEvent(letter, e)) }}
        super(config, group);
    }
}

export class LettersIcon extends GridIcon {
    constructor(letterGroup, group) {
        letterGroup = letterGroup in LETTER_GROUPS ? LETTER_GROUPS[letterGroup] : letterGroup
        super(letterGroup.icon, group);
        this.events = {
            "access-click": (e) => {
                this.dispatchEvent(new LettersEvent(letterGroup.letters, e));
            }
        }
    }
}

class IncrementIcon extends GridIcon {
    constructor(inc, group) {
        if (typeof inc !== "number" || inc === 0) {
            throw new Error("IncrementIcon requires a non-zero number as the increment value.");
        }
        super({
            symbol: inc > 0 ? "downArrow" : "upArrow",
            type: inc > 0 ? "starter" : "verb",
            events: {
                "access-click": (e) => {
                    this.dispatchEvent(new IncrementEvent(inc, e));
                }
            }
        }, group);

        this.value = inc;
    }
}

class OptionIcon extends GridIcon {
    constructor(option, group) {
        super(option.icon, group);
        this.events = {
            "access-click": (e) => {    
                this.dispatchEvent(new OptionEvent(option, e));
            }
        }
        this.value = option;
    }
}



const ICON_CLASSES = {
    "LetterIcon": LetterIcon,
    "IncrementIcon": IncrementIcon,
    "LettersIcon": LettersIcon,
}

const DEFAULT_LAYOUT_TEMPLATES = {
    "search": [
        {
            type: "LettersIcon", 
            params: ["atoi", "letter"],
        },
        {   
            type: "LettersIcon",
            params: ["jtor", "letter"],
        },
        {
            type: "LettersIcon",
            params: ["sto0", "letter"],
        },
        {
            type: "LettersIcon",
            params: ["1to9", "letter"],
        },
        {
            type: "IncrementIcon",
            params: [1, "down"],
        },
        {
            type: "IncrementIcon",
            params: [-1, "up"],
        }
    ],
}


class DefaultLayout extends GridLayout {
    constructor(template = "search") {
        super(3, 5);
        this.mode = "default";

        if (typeof template === "string") {
            if (!(template in DEFAULT_LAYOUT_TEMPLATES)) {  
                throw new Error(`Template "${template}" not found in DefaultLayout.`);
            } 
            template = DEFAULT_LAYOUT_TEMPLATES[template];
        } else if (!Array.isArray(template)) {
            throw new Error("Template must be a string or an array.");
        } else if (template.length === 0) {
            throw new Error("Template array cannot be empty.");
        } else {
            let valid = true;
            for (let item of template) {
                if (typeof item !== "object" || item == null || (!(item.type in ICON_CLASSES))) {
                    valid = false;
                    break;
                } else {
                    item.params = Array.isArray(item.params) ? item.params : [];
                }
            }
            if (!valid) {
                throw new Error("Template array must contain valid objects with 'type' and 'params' properties.");
            }
        }
        this._incrementers = [];

        let i = 0;
        for (let {type, params} of template) {
            let icon = new ICON_CLASSES[type](...params);
            this.add(icon, i<3?i:5-i, i<3?0:4);
            if (type === "IncrementIcon") {     
                this._incrementers.push(icon);
            }
            i++;
        }

        this.rotater = new Rotater();
        this.add(this.rotater, 0, 1, 2, 3);
        this.slider = new Slider();
        this.rotater.setContent(this.slider, true);
    }


    updateIncrementers(current, max) {
        this._incrementers.forEach(icon => {
            let inc = icon.value * 9;
            icon.disabled = (current + inc) < 0 || (current + inc )> max;
        });
    }

    /**
     * Update the displayed results based on the current page index and mode.
     * @param {SearchItem[]} items - List of items to display
     * @param {number|boolean} direction - true: set them immediately. 
     *                                   - false: use the rotater to set them.
     *                                   - 1 or -1: then slide the results in the given direction.    
     */
    async showResults(items, direction = false) {
        // Update the nine items in the first grid
        let itemGrid = new GridLayout(3, 3);
        for (let i = 0; i < 9 && i < items.length; i++) {
            itemGrid.add(
                new OptionIcon(items[i], "option9-"+Math.floor(i / 3)),
                Math.floor(i / 3), i % 3
            );
        }

        if (direction === 1 || direction === -1) {
            await this.slider.setContent(itemGrid, direction);
        } else {
            this.slider = new Slider();
            this.slider.setContent(itemGrid, true);
            await this.rotater.setContent(this.slider, direction);
        }
    }
}

class LetterLayout extends GridLayout {
    constructor() {
        super(3, 5);
        this.letterGrid = new GridLayout(3, 3);
        this.add(this.letterGrid, 0, 0, 2, 2);

        this.rotater = new Rotater();
        this.add(this.rotater, 0, 3, 2, 4);
    }

    /**
     * Show the letters in the letter grid.
     * @param {string[]} letters - List of letters to display
     * @param {boolean} [immediate=false] - If true, set the content immediately without transition.
     */
    async showLetters(letters, immediate = false) {
        this.letterGrid.innerHTML = "";
        letters = [...letters].slice(0, 9);
        for (let i = 0; i < letters.length; i++) {
            const icon = new LetterIcon(letters[i], "letter-"+ Math.floor(i / 3));
            this.letterGrid.add(icon, Math.floor(i / 3), i % 3);
        }
    }

    /**
     * Update the displayed results based on the current page index and mode.
     * @param {SearchItem[]} items - List of items to display
    * @param {boolean} [immediate=false] - If true, set the content immediately without transition.

     */
    async showResults(items, immediate = false) {
        let itemGrid = new GridLayout(3, 2);
        for (let i = 0; i < 6 && i < items.length; i++) {
            itemGrid.add(
                new OptionIcon(items[i], "option6-"+Math.floor(i / 2)),
                Math.floor(i / 2), i % 2
            );
        }
        await this.rotater.setContent(itemGrid, immediate);
    }
}


class SearchGrid extends GridLayout {
    mode = "default";
    pageIndex = 0;
    searchItems = [];
    __closeIconType = "close"; // Default close icon type

    constructor(defaultLayout = "search") {
        super(4, 5);

        // CLOSE ICON
        this.closeIcon = new GridIcon({
            symbol: "close",
            displayValue: "Exit",
            type: "action",
            events: {
                "access-click": (e) => {
                    if (this.mode == "default") {
                        this.dispatchEvent(new OptionEvent(null, e));
                    } else if (this.mode == "letters") {
                        e.waitFor(this._setMode("default", false));
                    }
                }
            }
        }, "s-main");
        this.add(this.closeIcon, 0, 0);

        // SPACE ICON
        this.spaceIcon = new LetterIcon("space", "s-main");
        this.add(this.spaceIcon, 0, 1);

        // SEARCH VALUE ICON
        this.searchValueIcon = new SearchBar();
        this.add(this.searchValueIcon, 0, 2, 0, 3);

        // CLEAR ICON
        this.clearIcon = new GridIcon({
            symbol: "trash",
            displayValue: "Clear",
            type: "action",
            events: {
                "access-click": (e) => {
                    this.searchValue = ""
                    this.dispatchEvent(new AccessEvent("change", e, {bubbles: true}));
                }
            }
        }, "s-main");
        this.add(this.clearIcon, 0, 4);


        this.rotater = new Rotater();
        this.add(this.rotater, 1, 0, 3, 4);

        this.defaultLayout = new DefaultLayout(defaultLayout);
        this.letterLayout = new LetterLayout();

        this.rotater.setContent(this.defaultLayout, true);

        this.events = {
            "letter": (e) => {
                let letter = e.value;
                this.searchValue += letter;
                this.dispatchEvent(new AccessEvent("change", e, {bubbles: true}));
            },
            "increment": (e) => {
                e.stopImmediatePropagation();
                e.waitFor(this._incrementResults(e.value));
            },
            "show-letters": (e) => {
                e.stopImmediatePropagation();
                this.letterLayout.showLetters(e.letters, true);
                e.waitFor(this._setMode("letters", false))
            },
        };
    }

    async setSearchItems(items, immediate = false) {
        this.pageIndex = 0;
        this.pageMax = items.length - 1;
        this.searchItems = items;
        await this._updateResults(immediate);
    }

    async _incrementResults(inc) {
        if (typeof inc === "number" && inc !== 0 && Number.isInteger(inc)) {
            let newIndex = this.pageIndex + inc * 9;
            if (newIndex >= 0 && newIndex <= this.pageMax && newIndex !== this.pageIndex) {
                this.pageIndex = newIndex;
                await this._updateResults(inc);
            }
        }
    }

    async _setMode(mode, direction) {
        if (this.mode !== mode) {
            this.mode = mode;
            if (mode === "default") {
                this._closeIconType = this.closeIconType;
            } else {
                this._closeIconType = "back";
            }

            await this.rotater.setContent(mode === "default" ? this.defaultLayout : this.letterLayout, direction);
        }
    }

    async _updateResults(direction) {
        this.defaultLayout.updateIncrementers(this.pageIndex, this.pageMax);
        this.searchValueIcon.setProgress(this.pageIndex, this.pageMax);
        let items = this.searchItems.slice(this.pageIndex, this.pageIndex + 9);
        await this.defaultLayout.showResults(items, this.mode === "default" ? direction : true);
        await this.letterLayout.showResults(items, this.mode === "letters" ? direction === true : true);
    }


    /**
     * Set the type of the close icon.
     * @param {string|import("./Buttons/grid-icon.js").GridIconOptions} type - The type of the close icon, either "close", "back", or an object with icon properties.
     */
    set _closeIconType(type) {
        if (type === "close") {
            this.closeIcon.symbol = "close";
            this.closeIcon.displayValue = "Exit";
            this.closeIcon.subtitle = null;
        } else if (type === "back") {
            this.closeIcon.symbol = "back";
            this.closeIcon.displayValue = "Back";
            this.closeIcon.subtitle = null;
        }  else if (typeof type === "object" && type !== null) {
            this.closeIcon.set(type);
        }
    }

    /**
     * Set the type of the close icon.
     * @param {string|import("./Buttons/grid-icon.js").GridIconOptions} type - The type of the close icon, either "close", "back", or an object with icon properties.
     */
    set closeIconType(type) {
        if (this.mode === "default") {
            this._closeIconType = type;
        }
        this.__closeIconType = type;
    }

    /**
     * Get the type of the close icon.
     * @returns {string|import("./Buttons/grid-icon.js").GridIconOptions} - The type of the close icon, either "close", "back", or an object with icon properties.
     * */
    get closeIconType() {
        return this.__closeIconType;
    }

    /**
     * @param {string} value - The search value to set
     */
    set searchValue(value) {
        this._value = value;
        if (value.length > 0) {
            value = value[0].toUpperCase() + value.slice(1);
        }
        this.searchValueIcon.value = value;
    }

    /**
     * @returns {string} - The current search value
     */
    get searchValue() {
        return this.searchValueIcon.value;
    }
}


export function compareString(a, b) {
    if (a.length > b.length) return a.indexOf(b);
    if (b.length > a.length) return b.indexOf(a);
    else return a === b ? 0 : -1;
}

export function compareStrings(a, stringList) {
    let i = 0;
    let totalScore = 0;
    
    if (typeof a === "string" && a.length > 0) {

        for (let str of stringList) {
            if (typeof str === "string") {
                let score = 0;
                let index = compareString(a, str.toLowerCase().trim());
                if (index !== -1) {
                    // If the strings start with the same letters then a whole score is given.
                    if (index === 0) {
                        score = 2;
                    } else {
                        let lastChar = str.length > a.length ? str.charAt(index - 1) : a.charAt(index - 1);
                        if (lastChar === " " || lastChar === "-" || lastChar === "_") {
                            score = 1;
                        } else {
                            score = 0.5; // If the strings match but not at the start, give half a point.
                        }
                    }
        
                    // Based on how much the string matches the search string, a score is given.
                    score += (str.length > a.length ? a.length / str.length : str.length / a.length) * 0.5;
        
                    // Score points are valued less the further down the list the item is.
                    totalScore += score/(4**i);
                }
            }
            i++;
        }
        totalScore = totalScore == 0 ? 0 : 1/totalScore; // Invert the score to make it easier to sort.
    } else {
        totalScore = stringList[0].toLowerCase().trim()
    }
    return totalScore;
}

export function filterAndSort(items, phrase, getStrings) {
    phrase = phrase.toLowerCase();
    let scores = items.map(item => {
        let strings = getStrings(item);
        if (typeof strings === "string") {
            strings = [strings];
        }
        if (Array.isArray(strings)) {
            return [compareStrings(phrase, strings), item]
        } else {
            return [0.00001, item]; // If no strings are found, give a very low score.
        }
    });
    
    scores = scores.filter(([score, _]) => typeof score === "string" || score > 0);
    scores.sort(([a], [b]) => b > a ? -1 : 1);
    return scores.map(([_, item]) => item);
}

export class SearchWindow extends HideShowTransition {
    constructor(defaultLayout = "search") {
        super("search-window", "up");
        this._sgrid = this.createChild(SearchGrid, {events: {
            "change": (e) => {
                e.stopImmediatePropagation();
                if (e instanceof AccessEvent) {
                    e.waitFor(this.updateSearchItems()) 
                } else {
                    this.updateSearchItems()
                }
            },
            "value": (e) => {
                this._currentValue = e.value;
                if (this.onValue instanceof Function) {
                    this.onValue(e);
                }
            }
        }}, defaultLayout);
    }

    set closeIcon(type) {
        this._sgrid.closeIconType = type;
    }
   

    /**
     * Reset the search items and update the search grid.
     */
    async resetSearchItems(immediate = false) {
        this._sgrid.searchValue = "";
        await this.updateSearchItems(immediate);
    }

    /**
     * Update the search items based on the current search value.
     */
    async updateSearchItems(immediate = false) {
        let results = await this.getSearchResults(this._sgrid.searchValue);
        if (!Array.isArray(results)) {
            throw new Error("getSearchResults must return an array of SearchItem objects.");
        }
        await this._sgrid.setSearchItems(results, immediate);
    }

    /** This function should be implemented to return search results based on the phrase.
     * @param {string} phrase - The phrase to search for
     * @returns {Promise<SearchItem[]>} - Returns a promise that resolves to the search results
     */
    async getSearchResults(phrase) {

    }

    /**
     * @return {SearchItem}
     * This is the currently selected search item.
     */
    get selected() {
        return this._currentValue;
    }

    /**
     * Get the current search value.
     * @return {string}
     */
    get value() {
        return this._sgrid.searchValue;
    }

    static get styleSheet() {
        return relURL("search-styles.css", import.meta);
    }

    static get usedStyleSheets() {
        return [relURL("search-styles.css", import.meta), GridIcon.styleSheet, Rotater.styleSheet];
    }
}
        