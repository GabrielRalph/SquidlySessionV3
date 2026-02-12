
/**
 * @typedef {import("./topics.js").GTopic} GTopic
 * @typedef {import("./topics.js").GItem} GItem
 */
import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { AccessClickEvent, AccessEvent } from "../../Utilities/Buttons/access-buttons.js";
import { GridIconSymbol, GridIcon } from "../../Utilities/Buttons/grid-icon.js";
import { Rotater } from "../../Utilities/rotater.js";
import { filterAndSort, SearchWindow } from "../../Utilities/search.js";
import { relURL, isExactSame, delay } from "../../Utilities/usefull-funcs.js";
import { Features, OccupiableWindow } from "../features-interface.js";
import * as Topics from "./topics.js"


const {speakUtterance} = Topics;
function range(end) {
    return new Array(end).fill(0).map((...a)=>a[1])
}

class IconSelectionEvent extends AccessEvent {
    /** @type {GItem} */
    selectedItem = 0;

    /** @type {number} */
    selectedItemIndex = 0;

    /** @type {("click"|"switch"|"dwell")} */
    mode = null;

    /** 
     * @param {GItem} item
     * @param {number} idx;
     * @param {("click"|"switch"|"dwell")} mode
     */
    constructor(item, idx, mode = "click") {
        super("icon-select", mode, {bubbles: true});
        this.selectedItemIndex = idx;
        this.selectedItem = item;
    }
}


/** A GridIcon represents an item from a topic. */
class AACGridIcon extends GridIcon {
    constructor(item, [row, col]){
        super(item, "grid-row-"+row);
        this.order = col;
        this.getUtterance(item);
    }
    async getUtterance(item) {
        if (item.type !== "action" || item.type === "topic") { 
            this.utteranceProm = Topics.getUtterance(item);
            this.utteranceURL = await this.utteranceProm;
        }
    }

    async waitForLoad(){
        await Promise.all([this.utteranceProm, super.waitForLoad()]);
    }
}

/** Represents a space in a grid. */
class GridSpace extends SvgPlus {
    /** @type {?AACGridIcon} */
    icon = null;
    constructor(row, col){
        super("grid-space");
        this.row = row;
        this.col = col;
        this.styles = {
            "grid-area": `${row+1} / ${col+1}`
        }
    }

    /** Sets the hover attribute.
     * @param {boolean} bool
     */
    set hover(bool){
        if (this.icon) this.icon.toggleAttribute("hover", bool);
    }

    /** Set the gItem of the grid space.
     * @param {GItem} item
     */
    set value(item) {
        this.innerHTML = "";
        this.icon = this.createChild(AACGridIcon, {events: {
            /** @param {AccessClickEvent} e */
            "access-click": (e) => {
                if (this.onAccessClick instanceof Function) this.onAccessClick(e);
                this.dispatchEvent(new AccessClickEvent(e))
            },
        }}, item, [this.row, this.col]);
    }

    /** Waits for the icon if any to load.
     * @returns {Promise<void>}
     */
    async waitForLoad(){
        if (SvgPlus.is(this.icon, AACGridIcon)) {
            await this.icon.waitForLoad();
        }
    }
}

/** Holds a grid of icons, set by a topic. */
class Grid extends SvgPlus {

    /** @type {[GridSpace[]]} */
    cells = [];

    constructor() {
        super("grid-block");
    }

    /** Select the icon and position provided with index in topic items idx.
     * @param {[number, number]} pos
     * @param {?number} idx
     */
    selectIcon(pos, idx, e){
        /** Un highlight last selected icon */
        if (this.lastSelected) {
            let [r, c] = this.lastSelected;
            this.cells[r][c].hover = false;
        }

        /** If new selected icon */
        if (pos) {
            // Highlight that icon
            let [r, c] = pos;
            let cell = this.cells[r][c];
            cell.hover = true;

            // Dispatch event with details of icon selection
            if (typeof idx === "number") {
                cell.dispatchEvent(new IconSelectionEvent(this.topicItems[idx], idx, e));
            }
        }
        this.lastSelected = pos;
    }   


    /**
     * @return {GridSpace[]}
     */
    get allCells() {
        return this.cells.flatMap(row => row);
    }

    /** Set the topic to be displayed.
     * @param {GTopic} topic
     */
    set topic(topic) {
        this._topicItems = topic.items;

        // Get the size of the topic and update the grid.
        let [cols, rows] = Topics.getGridSize(topic.size)
        this.size = [cols, rows];

        // For each row and column
        for (let r = 0, i=0; r < rows; r++) {
            for (let c = 0; c < cols; c++,i++) {
                let item = topic.items[i];
                if (item) {
                    // Set grid space to topic item
                    let idx = i;
                    let position = [r, c];
                    this.cells[r][c].value = item;

                    // Add click events to icon
                    this.cells[r][c].onAccessClick = (e) => this.selectIcon(position, idx, e);
                }
            }
        }

        // Select previously selected icon
        this.selectIcon(this.lastSelected);
    }
    
    get topicItems(){
        return this._topicItems;
    }

    /** Set the size of the grid.
     * @param {[number, number]} size
     */
    set size([cols, rows]){
        // add row and column templates
        this.styles = {
            "grid-template-columns": new Array(cols).fill("1fr").join(" "),
            "grid-template-rows": new Array(rows).fill("1fr").join(" "),
            "--rows": rows,
            "--cols": cols,
        }
        this.innerHTML = "";

        // Create remainding grid cell spaces
        this.cells = [
            ...range(rows).map(i => 
                range(cols).map((j) => 
                    this.createChild(GridSpace, {}, i, j)
                )
            )
        ];
        this.allCells.forEach(c => c.row += 1)
    }

    /** Waits for all icons to load
     * @returns {Promise<void>}
     */
    async waitForLoad() {
        await Promise.all(this.allCells.map(c => c.waitForLoad()))
    }
}

class AACOutputIcon extends SvgPlus {
    /** 
     * @param {GItem} item 
     */
    constructor(item) {
        super("aac-output-icon");
        this.class = item.type;
        let v = item.displayValue
        if (item.symbol) {
            this.createChild(GridIconSymbol, {}, item.symbol, true);
        }
        let text = this.createChild("div", {content: v});

        window.requestAnimationFrame(() => {
            let tsize = text.bbox[1];
            let size = this.bbox[1];
            if (tsize.x > size.x) {
                let i = Math.floor(v.length/2)
                text.textContent = v.slice(0,i) + "- " + v.slice(i)
            }            
        })
    }
}

class AACOutput extends SvgPlus {
    /** @type {GItem[]} */
    _items = []
    constructor() {
        super("aac-output");
        this.main = this.createChild("div", {class: "content"});
        this.textLine = this.main.createChild("div", {class: "text-line"})
        // Set up resize observer.
        let rs = new ResizeObserver(this.onresize.bind(this));
        rs.observe(this);
    }

    get items(){
        return this._items;
    }
    set items(items){
        if (!Array.isArray(items)) items = []
        if (!isExactSame(items, this.items)) {
            Topics.loadTopicUtterances({items})
            this._items = items;
            this.textLine.innerHTML = "";
            let icon;
            for (let item of items) {
                icon = this.textLine.createChild(AACOutputIcon, {}, item);
            }
            this.textLine.styles = {
                "--word-count": this.textLine.children.length
            }
            if (icon) {
                icon.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
            }

        }
    }

    addItem(item){
        this._items.push(item);
        let icon = this.textLine.createChild(AACOutputIcon, {}, item);
        this.textLine.styles = {
            "--word-count": this.textLine.children.length
        }

        icon.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
        this.onUpdate();
    }

    deleteWord(){
        if (this.textLine.lastChild) {
            this._items.pop()
            this.textLine.lastChild.remove();
            this.textLine.styles = {
                "--word-count": this.textLine.children.length
            }
            this.onUpdate();
        }
    }

    clear(){
        this._items = [];
        this.textLine.innerHTML = "";
        this.textLine.styles = {"--word-count": 0}
        this.onUpdate();
    }

    onUpdate(){
        this.dispatchEvent(new Event("change"))
    }

    onresize(e){
        let bbox = e[0]?.contentRect;
        this.styles = {
            "--width": bbox.width + "px",
            "--height": bbox.height + "px",
        }
    }

    async speak(){
        await Promise.all(this.items.map(i => speakUtterance(i)))
    }
}
const ActionsTemplate = [
    {
        row: 0,
        col: -1,
        displayValue: "Speak",
        iconSource: "speaker"
    },
    {
        row: 0,
        col: 0,
        displayValue: "Exit",
        iconSource: "close",

    },
    {
        row: 1,
        col: -1,
        displayValue: "Delete Word",
        iconSource: "back",
        key: "backspace",
    },
    {
        row: 2,
        col: -1,
        displayValue: "Clear",
        iconSource: "trash"
    },
    {
        row: 3,
        col: -1,
        displayValue: "Search",
        iconSource: "search",
        key: "quick"
    },
]
class AACGridBoard extends OccupiableWindow {
    cols = 5;
    rows = 4;
    init = true;

    /** @type {AACGrid} */
    aacGrid

    /** @type {?string} */
    quickTalk

    /** @type {?string} */
    currentTopic

    /** @type {Rotater} */
    gridArea = null

    /** @type {?Grid} */
    currentGrid = null;

    /** @type {string[]} */
    topicPath = []

    /** @type {AACOutput} */
    output

    constructor(aacGrid) {;
        super("aac-board");
        this.aacGrid = aacGrid
        this.root.styles = {
            "grid-template-columns": new Array(this.cols).fill("1fr").join(" "),
            "grid-template-rows": new Array(this.rows).fill("1fr").join(" "),
        }

        // Build Grid Area rotater.
        this.gridArea = this.createChild(Rotater, {
            styles: {
                "grid-column-start": 1,
                "grid-column-end": 5,
                "grid-row-start": 2,
                "grid-row-end": 5,
            }
        })

        
        // Build Action buttons
        this.actionButtons = {};
        for (let action of ActionsTemplate) {
            let {row, col, displayValue, iconSource, key} = action
            key = key || displayValue.toLowerCase();
            if (row < 0) row += this.rows;
            if (col < 0) col += this.cols;
            let cell = this.createChild(GridSpace, {events: {
                "access-click": (e) => {
                    const event = new AccessEvent(key, e);
                    this.root.dispatchEvent(event);
                },
            }}, row, col);
            cell.value = {
                displayValue,
                symbol: iconSource,
                type: "action",
                hidden: false,
            }
            this.actionButtons[key] = cell;
        }

        // Build output space
        this.output = this.createChild(AACOutput, {
            class: "output-cell",
            styles: {
                "grid-column-start": 2,
                "grid-column-end": 5,
                "grid-row-start": 0,
                "grid-row-end": 0,
            }
        });


        this.root.events = {
            "icon-select": (e) => e.waitFor(this.onIconSelect(e)),
            "exit": (e) => e.waitFor(this.goBack(e)),
            "clear": () => this.output.clear(),
            "backspace": () => this.output.deleteWord(),      
            "speak": () => this.output.speak(),
            "quick": async (e) => {
                e.waitFor(this.startSearch());
            },
        }

        this.searchWindow = this.createChild(SearchWindow, {
            events: {
                "value": async (e) => {
                    await e.waitFor(this.onSearchValue(e.value));
                }
            }
        })
        this.searchWindow.getSearchResults = async (phrase) => {
            phrase = phrase.toLowerCase();
            let results = await Topics.getAllTopics(this.aacGrid.sdata.hostUID);
            results = Object.keys(results).map((id) => {
                let item = results[id];
                return {
                    id,
                    item,
                    icon: {
                        displayValue: item.name,
                        type: "topic",
                        subtitle: item.ownerName,
                    },
                }
            });
            return filterAndSort(results, phrase, ({item}) => [item.name, item.ownerName]);
        }
    }

    async close(){
        await super.close();
        this.searchWindow.shown = false;
    }

    async startSearch(){
        await this.searchWindow.resetSearchItems(true);
        await this.searchWindow.show(500);
    }

    async onSearchValue(value) {
        let p1 = null;
        if (value) {
            let topicID = value.id;
            if (topicID && topicID !== this.currentTopic) {
                p1 = this.setRootTopic(topicID);
            }
        }
        await Promise.all([
            p1,
            this.searchWindow.hide(500)
        ]);
    }

    async setRootTopic(topicUID, immediate = false) {
        await Topics.getTopicCC(topicUID);
        if (topicUID !== this.currentTopic) {
            let topic = await Topics.getTopic(topicUID);
            if (topic) {
                this.currentTopic = topicUID;
                this.topicPath = [topicUID];

                this.aacGrid._updateTopics(this.topicPath);

                Topics.loadTopicUtterances(topic);
                this.currentGrid = new Grid();
                this.currentGrid.topic = topic;

                await this.gridArea.setContent(this.currentGrid, immediate);
                this.updateBack();
            }
        }
    }

    async setTopicPath(path, immediate) {
        this.topicPath = path;
        this.updateBack();
        await Topics.getTopicCC(path[0]);
        await this.setTopic(path[path.length-1], immediate, true)
    }
  
    /** @param {IconSelectionEvent} event */
    async onIconSelect(event) {
        let item = event.selectedItem;
        if (item.type !== "topic" && item.type !== "action") {
            speakUtterance(item);
            this.output.addItem(item);
            this.aacGrid.sdata.logChange("aac.word", {value: item.displayValue, note: event.clickMode});
        }
        if (Topics.isTopicItem(item.type)) {
            await this.setTopic(item.topicUID);
            this.aacGrid._updateTopics(this.topicPath);
        }
    }
  
    async setTopic(topicUID, immediate, noHist) {
        if (topicUID !== this.currentTopic) {
            let topic = await Topics.getTopic(topicUID);
            if (topic) {
                this.currentTopic = topicUID;
                if (!noHist) this.topicPath.push(topicUID);
                Topics.loadTopicUtterances(topic);
                this.currentGrid = new Grid();
                this.currentGrid.topic = topic;
    
                await this.gridArea.setContent(this.currentGrid, immediate);
                this.updateBack();
            }
        }
    }

    async goBack(e) {
        if (this.topicPath.length > 1) {
            this.topicPath.pop();
            await this.setTopic(this.topicPath.pop());
            this.aacGrid._updateTopics(this.topicPath);
        } else {
            const event = new AccessEvent('close', e);
            this.dispatchEvent(event)
        }
    }

    updateBack(){
        if (this.topicPath.length > 1) {
            this.actionButtons.exit.value = {
                displayValue: "Back",
                symbol: "arrow",
                type: "action",
                hidden: false,
            }
        } else {
            this.actionButtons.exit.value = {
                displayValue: "Exit",
                symbol: "close",
                type: "action",
                hidden: false,
            }
        }
    }
    
    static get fixToolBarWhenOpen() {return true}
    static get usedStyleSheets() {return [relURL("grid.css", import.meta), GridIcon.styleSheet, ...SearchWindow.usedStyleSheets, Rotater.styleSheet]}
}

export default class AACGrid extends Features {
    constructor(sesh, sdata) {
        super(sesh, sdata);
        this.board = new AACGridBoard(this);
        this.board.output.addEventListener("change", () => {
            sdata.set("output", this.board.output.items);
        })

        this.board.addEventListener("close", (e) => {
            e.waitFor(this.session.openWindow("default"));
        })

        this.session.toolBar.addMenuItem("access", {
            name: "aac",
            index: 270,
            onSelect: e => e.waitFor(this.session.openWindow("aacGrid"))
        })
      
    }
  
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVATE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    _updateTopics(path){
        this.sdata.set("topics", path);
    }

    async _loadAndSetTopics(id) {
        await Topics.getTopicCC(id);
        this.board.setTopic(id);
    }

    async _initialiseQuickTalk(){
        let id = (await Topics.getQuickTalk())[0]
        this.board.quickTalk = id
    }


    async initialise(){
        let {sdata} = this;
        Topics.setText2SpeechModule(this.session.text2speech);
        
        let quickTalkProm = this._initialiseQuickTalk();

        // Get the current topic
        let topics = await sdata.get("topics");
        
        if (topics == null) {
            let defaultID = [(await Topics.getDefaultBoard())[0]]
            this.sdata.set("topics", defaultID);
            topics = defaultID
        } 
        
        await this.board.setTopicPath(topics)

        sdata.onValue("topics", async (tps) => {
            if (tps != null) {
                this.board.setTopicPath(tps);
            }
        })

        sdata.onValue("output", (items) => {
            this.board.output.items = items;
        })

        await quickTalkProm;
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ STATIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    static get layers() {
        return {
            board: {
                type: "area",
                area: "fullAspectArea",
                index: 80,
                mode: "occupy",
            }
        }
    }

    static get name() {
        return "aacGrid";
    }

    static get firebaseName(){
        return "aac";
    }
    
    static async loadResources(){
        await AACGridBoard.loadStyleSheets();
    }
}
