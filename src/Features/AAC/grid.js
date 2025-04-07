
/**
 * @typedef {import("./topics.js").GTopic} GTopic
 * @typedef {import("./topics.js").GItem} GItem
 */
import { SvgPlus, Vector } from "../../SvgPlus/4.js";
import { AccessButton, AccessClickEvent } from "../../Utilities/access-buttons.js";
import { Icon } from "../../Utilities/Icons/icons.js";
import { ShadowElement } from "../../Utilities/shadow-element.js";
import { relURL, isExactSame } from "../../Utilities/usefull-funcs.js";
import { Features } from "../features-interface.js";
import * as Topics from "./topics.js"


const {speakUtterance} = Topics;
function range(end) {
    return new Array(end).fill(0).map((...a)=>a[1])
}

class IconSelectionEvent extends Event {
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
        super("icon-select", {bubbles: true});
        this.selectedItemIndex = idx;
        this.selectedItem = item;
        this.selectMode = mode;
    }
}


function plainCard(size, border = 4) {
    let inSize = size.sub(border);
    let g = inSize.y / 20;
    return `<rect class = "card" x = "${border/2}" y = "${border/2}" width = "${inSize.x}"  height = "${inSize.y}" rx = "${g}" ry = "${g}" />
            <rect stroke-width = "${border}" class = "outline" x = "${border/2}" y = "${border/2}" width = "${inSize.x}"  height = "${inSize.y}" rx = "${g}" ry = "${g}" />`
}
function folderCard(size, border = 4) {
    let inSize = size.sub(border);
    let g = inSize.y / 20;
    let w = inSize.x;
    let b = w * 0.45;

    g = Math.min(b / 3, g);


    let t = g / 3;
    let h = inSize.y;


    let p0 = new Vector(border/2, border/2 + 2*g);
    let p1 = p0.addV(-g);
    let p2 = p1.add(g, -g);

    let c2 = p1.addH(b);
    let c1 = c2.add(-g);
    
    let tv = new Vector(t, 0);
    let tv2 = tv.rotate(-Math.PI * 3 / 4);

    let p3 = c1.sub(tv);
    let p4 = c1.sub(tv2);

    let p5 = c2.add(tv2);
    let p6 = c2.add(tv);

    let p7 = p1.addH(w - g);
    let p8 = p0.addH(w);

    let rg = new Vector(g);
    let rt = new Vector(t * Math.tan(Math.PI * 3 / 8));

    let tabPath = `M${p0}L${p1}A${rg},0,0,1,${p2}L${p3}A${rt},0,0,1,${p4}L${p5}A${rt},0,0,0,${p6}L${p7}A${rg},0,0,1,${p8}Z`

    let p9 = p8.addV(h - 3 * g);
    let p10 = p9.add(-g, g);

    let p11 = p10.addH(2 * g - w);
    let p12 = p11.sub(g);

    let card = `M${p8.addV(-0.1)}L${p9}A${rg},0,0,1,${p10}L${p11}A${rg},0,0,1,${p12}L${p0.addV(-0.1)}Z`
    let outline = `M${p0}L${p1}A${rg},0,0,1,${p2}L${p3}A${rt},0,0,1,${p4}L${p5}A${rt},0,0,0,${p6}L${p7}A${rg},0,0,1,${p8}L${p9}A${rg},0,0,1,${p10}L${p11}A${rg},0,0,1,${p12}Z`;
    return  `<path class = "card" d = "${card}" />
             <path class = "tab" d = "${tabPath}" />
             <path stroke-width = "${border}" class = "outline" d = "${outline}" />`
}
const MAKE_CARD_ICON = {
    topic: folderCard,
    "topic-normal": folderCard,
    "topic-starter": folderCard,
    "topic-noun": folderCard,
    "topic-verb": folderCard,
    "topic-adjective": folderCard,
    normal: plainCard,
    starter: plainCard,
    noun: plainCard,
    verb: plainCard,
    adjective: plainCard,
    action: plainCard,
}


/** A GridIconSymbol represents the image from a grid icon. */
export class GridIconSymbol extends SvgPlus{
    constructor(symbol){
        super("div");
        this.class = "symbol";

        this.isLoaded = false;
        if (typeof symbol == "object" && symbol !== null && "url" in symbol && typeof symbol.url === "string") {
            // Create image and add load event.
            this.createChild("img", {
                events: {
                    load: () => this.dispatchEvent(new Event("load")),
                    error: () => this.dispatchEvent(new Event("load")),
                },
                src: symbol.url
            });
        } else if (typeof symbol === "string") {
            this.createChild(Icon, {}, symbol)
        } else {
            this.isLoaded = true;
        }
    }
}

/** A GridIcon represents an item from a topic. */
class GridIcon extends AccessButton {
    constructor(item, [row, col]){
        super("grid-row-"+row);
        this.order = col;

        // Set class to type
        this.class = "grid-icon " + item.type;
        this.type = item.type;
        this.item = item;

        // Get utterance url
        this.getUtterance(item);
        
        // Toggle attribute 'i-hidden' if icon is hidden.
        this.toggleAttribute("i-hidden", item.hidden);

        // Enable draggability
        this.setAttribute("draggable", true)


        // Create card background svg, and icon content box.
        this.cardIcon = this.createChild("svg", {class: "card-icon"});
        this.content = this.createChild("div", {class: "content"});

        // Add symbol to content box.
        this.symbol = this.content.createChild(GridIconSymbol, {
            events: {load: () => {
                this.loaded = true;
                if (this.onload instanceof Function) this.onload();
                this.dispatchEvent(new Event("load"));
            }}
        }, item.symbol);
        this.loaded = this.symbol.isLoaded;

        // Add text box with display value to content box.
        this.content.createChild("div", {content: item.displayValue || "", class: "display-value"});

        // Set up resize observer to re render the card when the size of the 
        // grid icon changes.
        let rs = new ResizeObserver(() => this.onresize())
        rs.observe(this);
    }

    async getUtterance(item) {
        this.utteranceProm = Topics.getUtterance(item);
        this.utteranceURL = await this.utteranceProm;
    }

    /** Can be used to wait for the grid symbol image to load.
     *  @return {Promise<void>}
     * */ 
    async waitForLoad(){
        let proms = [this.utteranceProm]
        if (!this.loaded) proms.push(new Promise((r) => this.onload = () => r()));
        await Promise.all(proms);
        
    }

    // Called when the size of the icon changes.
    onresize(){
        // If element is on the DOM
        if (this.parentElement) {
            // Get the size from the bounding client rect of the icon.
            let size = this.bbox[1]; 
            
            // If there are no zero values in size dimension.
            if (size.x > 1e-10 && size.y > 1e-10 && this.type in MAKE_CARD_ICON) {
                this.cardIcon.props = {
                    viewBox: `0 0 ${size.x} ${size.y}`,      // Update the svg viewBox.
                    content: MAKE_CARD_ICON[this.type](size) // Recompute the svg content.
                }
            }
        }
    }
}

/** Rotates between two elements */
class Rotater extends SvgPlus {
    angle = 0;
    contentSets = [];
    constructor(){
        super("div");
        this.class = "rotater";
        let rel = this.createChild("div")
        this.slot1 = rel.createChild("div", {class: "slot-1"});
        this.slot2 = rel.createChild("div", {class: "slot-2"});
        this.transitionTime = 0.8;

    }

    /** Set the content of the rotater
     * @param {Element} content
     * @param {boolean} immediate whether to use rotation transition or immediate.
     * @returns {Promise<void>}
     */
    async setContent(content, immediate = false) {
        // If a current set is in progress add the set request to a buffer.
        if (this._settingContent) {
            this.contentSets.push([content, immediate]);
        
        // Otherwise set the content
        } else {
            this._settingContent = true;
            let element = immediate ? this.shownSlot : this.hiddenSlot;
            
            element.innerHTML = "";
            if (content instanceof Element) {
                element.appendChild(content);
            }
    
            if (!immediate) {
                await this.flip();
            }
            this._settingContent = false;
            if (this.contentSets.length > 0) {
                this.setContent(...this.contentSets.pop());
                this.contentSets = [];
            }
        }
    }

    
    set transitionTime(time){
        this._transitionTime = time;
        this.styles = {"--transition-time": time + "s"}
    }
    get transitionTime(){ return this._transitionTime; }
    
    get shownSlot(){ return this.flipped > 0.5 ? this.slot1 : this.slot2; }
    get hiddenSlot(){ return this.flipped > 0.5 ? this.slot2 : this.slot1; }


    /** Filps the rotater
     * @return {Promise<void>}
     */
    async flip(){
        this.flipping = true;
        this.angle =  this.angle + 180;
        this.styles = {
            "--angle": this.angle + "deg"
        }
        let flipped = !this.flipped;
        this.toggleAttribute("flip", flipped);
        this._flipped = flipped;
        await new Promise((r) => {setTimeout(r, this.transitionTime * 1000)});
        this.flipping = false;
    }


    get flipped(){return this._flipped;}
}

/** Represents a space in a grid. */
class GridSpace extends SvgPlus {
    /** @type {?GridIcon} */
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
        this.icon = this.createChild(GridIcon, {events: {
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
        if (SvgPlus.is(this.icon, GridIcon)) {
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
    selectIcon(pos, idx){
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
                cell.dispatchEvent(new IconSelectionEvent(this.topicItems[idx], idx));
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
                    this.cells[r][c].onAccessClick = () => this.selectIcon(position, idx);
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
        this.createChild(GridIconSymbol, {}, item.symbol);
        this.createChild("div", {content: item.displayValue});
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
        let rs = new ResizeObserver(() => this.onresize())
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

    onresize(){
        let size = this.bbox[1];
        this.styles = {
            "--width": size.x + "px",
            "--height": size.y + "px",
        }
    }

    async speak(){
        // console.log("speaking");
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
        displayValue: "Quick Talk",
        iconSource: "msg",
        key: "quick"
    },
]
class AACGridBoard extends ShadowElement {
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
                    const event = new Event(key);
                    event.initialEvent = e;
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
            "icon-select": (e) => this.onIconSelect(e),
            "exit": (e) => this.goBack(e),
            "clear": () => this.output.clear(),
            "backspace": () => this.output.deleteWord(),      
            "speak": () => this.output.speak(),
            "quick": async () => {
                await this.setTopic(this.quickTalk);
                this.aacGrid._updateTopics(this.topicPath);
            },

        }
    }


    async setTopicPath(path, immediate) {
        // console.log(path);
        
        this.topicPath = path;

        this.updateBack();
        await Topics.getTopicCC(path[0]);
        await this.setTopic(path[path.length-1], immediate, true)
    }

  
    /** @param {IconSelectionEvent} event */
    async onIconSelect(event) {
        
        let item = event.selectedItem;
        if (item.type !== "topic") {
            speakUtterance(item);
            this.output.addItem(item);
        }
        if (Topics.isTopicItem(item.type)) {
            await this.setTopic(item.topicUID);
            this.aacGrid._updateTopics(this.topicPath);
        }
        // console.log(this.output.items);
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
                this.gridArea.setContent(this.currentGrid, immediate);
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
            const event = new Event('close');
            event.initialEvent = e.initialEvent;
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
    

    static get usedStyleSheets() {return [relURL("grid.css", import.meta)]}
}

export class AACGrid extends Features {
    constructor(sesh, sdata) {
        super(sesh, sdata);
        this.board = new AACGridBoard(this);
        this.board.output.addEventListener("change", () => {
            sdata.set("output", this.board.output.items);
        })

        this.board.addEventListener("close", this.close.bind(this))
        this.session.toolBar.addSelectionListener("aac", (e) => {
            this.open(e);
        })
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PUBLIC ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */


    open(e){
        console.log("event - ", e);
        if (e instanceof Event) {
            e.waitFor(this.session.toolBar.toggleToolBar(false))
            e.waitFor(new Promise((r) => setTimeout(r, 550)))
        }
        this.board.root.toggleAttribute("shown", true);
        this.session.toolBar.toolbarFixed = true;
        this.sdata.set("open", true);
    }

    close(){
        this.board.root.toggleAttribute("shown", false);
        if (this.session.accessControl.isSwitching) {
            this.session.accessControl.restartSwitching();
            this.session.toolBar.toggleToolBar(true);
        } else {
            this.session.toolBar.toolbarFixed = false;
        }
        this.sdata.set("open", false);
    }

    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ PRIVATE ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
    /* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */

    _updateTopics(path){
        // console.log("updating", path);
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

        sdata.onValue("open", (isOpen) => {
            if (isOpen === true) this.open();
            else if (isOpen === false) this.close();
        })

        await Promise.all([
            this.board.currentGrid.waitForLoad(),
            quickTalkProm
        ]);

    }

    static get firebaseName(){
        return "aac";
    }
    
    static async loadResources(){
        await AACGridBoard.loadStyleSheets();
    }
}
