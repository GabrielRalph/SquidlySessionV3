import { child, get } from "../../Firebase/firebase.js";
import { AccessEvent } from "../../Utilities/access-buttons.js";
import { GridCard, GridIcon, GridLayout } from "../../Utilities/grid-icon.js";
import { HideShow } from "../../Utilities/hide-show.js";
import { Rotater, Slider } from "../../Utilities/rotater.js";
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { delay, relURL } from "../../Utilities/usefull-funcs.js";
import { Features } from "../features-interface.js";

/**
 * @typedef {Object} SearchItem 
 * @property {Object} icon - Icon representing the item
 * @property {string|(string)=>boolean} matches - Functions or string to determine if the item matches a search query
 * @property {(string) => number} [sortindex] - Optional function to determine the sort index of the item
 * @property {SearchItem[]} [children] - Optional children items for nested searches
 */


const LETTER_TEMPLATES = {
    "atoi": "abcdefghi",
    "jtor": "jklmnopqr",
    "sto0": "stuvwxyz0",
    "1to9": "123456789",
}

class SearchBar extends GridCard {
    constructor() {
        super("search-bar", "normal");
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
            // "change": (e) => {
            //     this.dispatchEvent(new Event("change"));
            // }
        }})
    }

    get value() {
        return this.input.value;
    }
    set value(value) {
        this.input.value = value;
    }

}

class HideShowSlide extends HideShow {
    setTransitionVariable(state) {
        this.styles = {
            "transform": `translateY(${(1 - state) * 100}%)`,
        }
    }

    applyShownState() {
        this.styles = {
            "transform": "translateY(0%)",
            "pointer-events": null,
        }
    }
    applyHiddenState() {
        this.styles = {
            "transform": "translateY(100%)",
            "pointer-events": "none",
        }
    }
}

class SearchWindow extends ShadowElement {
    pageIndex = 0;
    constructor() {
        super("search-window", new HideShowSlide("search-window"));
        this.main = this.createChild(GridLayout, {}, 4, 5)

        // TOP ICONS
        // CLOSE ICON
        this.closeIcon = new GridIcon({
            symbol: "close",
            displayValue: "Exit",
            type: "action",
            events: {
                "access-click": (e) => {
                    if (this.closeIcon.mode == "close") {
                        if (this.onClose instanceof Function) {
                            this.onClose(e);
                        }
                    } else if (this.closeIcon.mode == "back") {
                        e.waitFor(this.showDefaultLayout());
                    }
                }
            }
        })
        this.closeIcon.mode = "close";
    

        // SPACE ICON
        this.spaceIcon = new GridIcon({
            displayValue: "Space",
            symbol: "space",
            type: "action",
        });
        this.addLetterEvent(this.spaceIcon, " ");

        // SEARCH VALUE ICON
        this.searchValueIcon = new SearchBar();
        this.searchValueIcon.events = {
            "change": (e) => {
                this.filterResults();
            }
        };

        // CLEAR ICON
        this.clearIcon = new GridIcon({
            symbol: "trash",
            displayValue: "Clear",
            type: "action",
            events: {
                "access-click": (e) => {
                    this.searchValue = ""
                    e.waitFor(this.filterResults());
                }
            }
        });

   
         /** @type {Rotater} */
         this.r1 = new Rotater();

        this.main.add(this.closeIcon, 0, 0);
        this.main.add(this.spaceIcon, 0, 1);
        this.main.add(this.searchValueIcon, 0, 2, 0, 3);
        this.main.add(this.clearIcon, 0, 4);
        this.main.add(this.r1, 1, 0, 3, 4);
       
        // SECTION 1
        this.section1 = new GridLayout(3, 5);
        this.items1rotater = new Rotater();
        this.section1.add(this.items1rotater, 0, 1, 2, 3);

        // LETTER and NUMBER ICONS
        this.atoi = new GridIcon({
            symbol: "atoi",
            type: "topic-action",
            events: {"access-click": (e) => e.waitFor(this.showLetterMode(LETTER_TEMPLATES.atoi))}
        }, "letter");
    
        this.jtor = new GridIcon({
            symbol: "jtor",
            type: "topic-action",
            events: {"access-click": (e) => e.waitFor(this.showLetterMode(LETTER_TEMPLATES.jtor))}
        }, "letter");

        this.sto0 = new GridIcon({
            symbol: "sto0",
            type: "topic-action",
            events: {"access-click": (e) => e.waitFor(this.showLetterMode(LETTER_TEMPLATES.sto0))}
        }, "letter");

        this._1to9 = new GridIcon({
            symbol: "1to9",
            type: "topic-action",
            events: {"access-click": (e) => e.waitFor(this.showLetterMode(LETTER_TEMPLATES["1to9"]))}
        }, "letter");

        // UP and DOWN ARROWS
        this.up = new GridIcon({
            symbol: "upArrow",
            type: "verb",
            events: { "access-click": (e) => e.waitFor(this.incrementPage(-1))}
        }, "navigation");

        this.down = new GridIcon({
            symbol: "downArrow",
            type: "starter",
            events: { "access-click": (e) => e.waitFor(this.incrementPage(1))}
        }, "navigation");

        this.section1.add(this.atoi, 0, 0);
        this.section1.add(this.jtor, 1, 0);
        this.section1.add(this.sto0, 2, 0);
        this.section1.add(this._1to9, 2, 4);

        this.section1.add(this.up, 0, 4);
        this.section1.add(this.down, 1, 4);

        // SECTION 2
        this.section2 = new GridLayout(3, 5);
        this.letterLayout = new GridLayout(3, 3);
        this.section2.add(this.letterLayout, 0, 0, 2, 2);

        this.items2rotater = new Rotater();
        this.section2.add(this.items2rotater, 0, 3, 2, 4);

        this.r1.setContent(this.section1, true);

        this.events = {
            "letter": (e) => {
                let letter = e.value;
                if (letter === " ") {
                    this.searchValue += " ";
                } else {
                    this.searchValue += letter;
                }
                e.waitFor(this.filterResults());
            }
        }
        this.searchValue = "";
    }

    async incrementPage(inc) {
        if (inc > 0 && this.pageIndex + 9 < this._displayedResults.length) {
            this.pageIndex += 9;
            await this.updateDisplayedResults(inc)
        } else if (inc < 0 && this.pageIndex - 9 >= 0) {
            this.pageIndex -= 9;
            await this.updateDisplayedResults(inc)
        }
    }

    addLetterEvent(icon, letter) {
        icon.events = {
            "access-click": (e) => {
                let e2 = new AccessEvent("letter", e, {bubbles: true});
                e2.value = letter.toLowerCase();
                this.dispatchEvent(e2)
            }
        }
    }
    
    async showDefaultLayout(imidiate = false) {
        this.mode = "default";
        this.closeIcon.mode = "close";
        this.closeIcon.displayValue = "Exit";
        this.closeIcon.symbol = "close";
        this.r1.setContent(this.section1, imidiate);
    }


    async showLetterMode(letters) {
        this.mode = "letter";
        this.closeIcon.mode = "back";
        this.closeIcon.displayValue = "Back";
        this.closeIcon.symbol = "back";
        this.makeLetters(letters);
        await this.r1.setContent(this.section2, false);
    }


    makeLetters(letters) {
        this.letterLayout.innerHTML = "";
        letters = [...letters].slice(0, 9);
        for (let i = 0; i < letters.length; i++) {
            const letter = letters[i].toUpperCase();
            const icon = new GridIcon({
                symbol: {text: letter},
                type: "adjective",
            }, "letter-"+ Math.floor(i / 3));
            this.letterLayout.add(icon, Math.floor(i / 3), i % 3);
            this.addLetterEvent(icon, letter);
        }
    }

    /**
     * Update the displayed results based on the current page index and mode.
     * @param {number|boolean} direction - true: set them immediately. 
     *                                   - false: use the rotater to set them.
     *                                   - 1 or -1: then slide the results in the given direction.    
     */
    async updateDisplayedResults(direction = false) {
        // Slice the displayed results based on the current page index
        let list = this._displayedResults.slice(this.pageIndex)
        
        // Function to handle item clicks
        let itemClick = (e, item) => {
            let event = new AccessEvent("value", e);
            event.value = item;
            if (this.onValue instanceof Function) {
                this.onValue(event);
            }
        }
        
        // Update the nine items in the first grid
        let items1 = new GridLayout(3, 3);
        for (let i = 0; i < 9 && i < list.length; i++) {
            let icon = new GridIcon(list[i].icon, "option-"+Math.floor(i / 3));
            icon.events = {"access-click": (e) => itemClick(e, list[i]) };
            items1.add(icon, Math.floor(i / 3), i % 3);
        }

        // Update the six items for the second grid
        let items2 = new GridLayout(3, 2);
        for (let i = 0; i < 6 && i < list.length; i++) {
            let icon = new GridIcon(list[i].icon, "option6-"+Math.floor(i / 2));
            icon.events = { "access-click": (e) => itemClick(e, list[i]) };
            items2.add(icon , Math.floor(i / 2), i % 2);
        }

        // Handle transitions
        // Rotate items 2 if the mode is letter otherwise set the content immediately
        let proms = [this.items2rotater.setContent(items2,!!direction || this.mode !== "letter")]

        // If the mode is letter then set the direction to true .i.e. immediate
        direction = this.mode === "letter" ? true : direction;

        // If the direction is 1 or -1 then set the content using the slider1
        if (direction === 1 || direction === -1) {
            proms.push(this.slider1.setContent(items1, direction))

        // Otherwise set content using the rotater
        } else {
            let slider1 = new Slider();
            slider1.setContent(items1, true);
            this.slider1 = slider1;
            proms.push(this.items1rotater.setContent(slider1, direction))
        }

        await Promise.all(proms);
    }


    async filterResults(immediate = false) {
        
        this.pageIndex = 0;
        let value = this.searchValue.toLowerCase();

        let search = this.searchItems.map(item => {
            let is_match = true;
            let index = 0;
            if (value) {
                is_match = false;
                if (item.matches instanceof Function) {
                    is_match = item.matches(value);
                } else if (typeof item.matches === "string") {
                    let search_text = item.matches.toLowerCase();
                    let i1 = search_text.indexOf(value);
                    let i2 = value.indexOf(search_text);
                    is_match = i1 !== -1 || i2 !== -1;
                    index = i1 == 0 || i2 == 0 ? 2 : 1;
                }
            }

            if (item.sortindex instanceof Function) {
                index = item.sortindex(value);
            }

            return [item, is_match, index];
        })
        let sub_items = search.filter(item => item[1]);
        sub_items.sort((a, b) => b[2] - a[2]);
        sub_items = sub_items.map(item => item[0]);
        

        await this.setDisplayedResults(sub_items, !!immediate);
    }


    setSearchItems(items, immediate = false) {
        this.pageIndex = 0;
        this._searchItems = items;
        this._displayedResults = items;
        this.updateDisplayedResults(!!immediate)
    }

    /**
     * @param {SearchItem[]} list - List of items to display
     * @param {?boolean} [transMode=null] - Whether to slide the results in or not
     */
    setDisplayedResults(list, direction = false) {
        this._displayedResults = list;
        this.updateDisplayedResults(direction);
    }

    /** 
     * @param {SearchItem[]} results - List of items to display
     * @param {boolean} [init=false] - Whether to reset the search window to the default layout
     */
    async reset(list, init = false) {
        this.searchValue = "";
        this.setSearchItems(list, init);
        await this.showDefaultLayout(init);
        if (init) {
            await this.root.show(500);
        }
    }


    get searchItems() {
        return this._searchItems;
    }

    set searchValue(value) {
        this._value = value;
        if (value.length > 0) {
            value = value[0].toUpperCase() + value.slice(1);
        }
        this.searchValueIcon.value = value;
    }

    get searchValue() {
        return this.searchValueIcon.value;
    }
    
    get dispatchResults() {
        return this._displayedResults;
    }


    static get usedStyleSheets() {
        return [relURL("styles.css", import.meta), GridIcon.styleSheet, Rotater.styleSheet];
    }
}

export class Search extends Features {
    constructor(session) {
        super(session);
        this.searchWindow = new SearchWindow();
    }

    async startSearch(list, onComplete = null) {
        await Promise.all([
            this.searchWindow.reset(list, true),
            this.searchWindow.root.show(500),
        ]);
        this._search(list, onComplete);
    }

    /**
     * @param {searchItemp[]} list list - List of items to search through
     */
    async _search(list, onComplete, event) {
        let results = {children: list};
        let lastEvent = null
        while (Array.isArray(results?.children) && results.children.length > 0) {
            [results, lastEvent] = await new Promise((resolve) => {
                this.searchWindow.onValue = (e) => {
                    resolve([e.value, e]);
                };
                this.searchWindow.onClose = (e) => {
                    resolve([null, e]);
                };
            });

            if (Array.isArray(results?.children) && results.children.length > 0) {
                lastEvent.waitFor(this.searchWindow.reset(results.children, false))
            }
        }
        let finish = async () => {
            let proms = [this.searchWindow.root.hide(500)]
            if (onComplete instanceof Function) {
                let prom = onComplete(results);
                if (prom instanceof Promise) {
                    proms.push(prom);
                }
            }
            await Promise.all(proms);
        }
        await lastEvent.waitFor(finish(), true);
        return results;
    }

    async initialise() {
        await SearchWindow.loadStyleSheets();
    }
}