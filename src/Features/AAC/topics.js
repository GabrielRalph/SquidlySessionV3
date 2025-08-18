/** 
 * @typedef {Object} IconInfo 
 *  @property {string} name
 *  @property {string} type
 *  @property {string} url
 *  @property {string} id
 *  @property {number} match
 */

import * as FB from "../../Firebase/firebase.js";

/**
 * @typedef {Object} UploadResults
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {string} symbolID
 * @property {string} url
 * @property {IconInfo[]} similar
 */

/** @typedef {import('../Text2Speech/text2speech.js').Text2Speech} Text2Speech*/

/**
 * @typedef {Object} DeleteResults
 * @property {boolean} success
 * @property {string[]} errors
 * @property {IconInfo[]} multiples
 */
/**
 * @typedef {Object} TopicSearchResults
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {GTopic[]} results
 */

/**
 * @typedef {("normal"|"starter"|"topic")} GItemType
 */

/**
 * @typedef {("2x1"|"2x2"|"3x2"|"3x3"|"4x3")} GridSize
 */

/**
 * @typedef {Object} GItem
    * @property {GItemType} type one of the three item types
    * @property {{url: string, id: string}} symbol the symbol image shown
    * @property {string} displayValue the value displayed
    * @property {?string} utterance will take the value of displayValue if not included
    * @property {?string} topicUID topic id 
    * @property {boolean} hidden
 */

/**
 * @typedef {Object} GTopic
    * @property {string} name
    * @property {GridSize} size
    * @property {[GItem]} items
    * @property {?string} topicUID
    * @property {string} owner
    * @property {boolean} owned
    * @property {boolean} public
 */

/**
 * @typedef {Object} GTopicDescriptor
 * @property {string} name
 * @property {GridSize} size
 * @property {string} topicUID
 * @property {boolean} owned
 * @property {boolean} public
 * @property {string} ownerName
 */

/**
 * @type {Object.<GridSize, function>}
 */
const GRID_SIZES = {
    "1x1": ()=>[1,1],
    "2x1": ()=>[2,1],
    "2x2": ()=>[2,2],
    "3x1": ()=>[3,1],
    "3x2": ()=>[3,2],
    "3x3": ()=>[3,3],
    "4x1": ()=>[4,1],
    "4x2": ()=>[4,2],
    "4x3": ()=>[4,3],
}
const GITEM_TYPES = {
    "normal": "word",
    "starter": "word",
    "noun": "word",
    "verb": "word",
    "adjective": "word",
    "topic": "topic",
    "topic-normal": "topic",
    "topic-starter": "topic",
    "topic-noun": "topic",
    "topic-verb": "topic",
    "topic-adjective": "topic",
}
const DEFAULT_BOARD = "-OLqvyYjEIPALztTqM1N"
const QUICK_TALK = "-OGKBtJUfonWnJijpL2O"

/**@type {Text2Speech} */
let Text2Speech = null;
let TOPICS = {};
let NAMES = {};

/**
 * @param {string} id;
 * @return {Promise<GTopic>}
 */
export async function getTopic(id){
    let topic = null;
    if (id in TOPICS) {
        topic = TOPICS[id]
    } else {
        topic = (await FB.get(FB.ref(`grid-topics/${id}`))).val();
        TOPICS[id] = topic;
    }
    return topic;
}


async function addTopicOwnerName(id) {
    let topic = await getTopic(id);
    if (topic && !("ownerName" in topic)) {
        let name = " - ";
        if (topic.owner in NAMES) {
            name = NAMES[topic.owner];
        } else {
            let [first, last, display] = await Promise.all([
                FB.get(FB.ref(`users/${topic.owner}/info/firstName`)),
                FB.get(FB.ref(`users/${topic.owner}/info/lastName`)),
                FB.get(FB.ref(`users/${topic.owner}/info/displayName`))
            ]);
            name = display.val() || `${first.val()} ${last.val()}`.trim();
            NAMES[topic.owner] = name;
        }
        topic.ownerName = name;
    }
    return topic;
}

const databaseWatchers = [];
let watchingAll = false;
export async function getAllTopics(uid) {
    if (!watchingAll) {
        while (databaseWatchers.length > 0) databaseWatchers.pop()();
        let publicQuery = FB.query(FB.ref(`grid-topics`), FB.orderByChild('public'),FB.equalTo(true));
        let ownedQuery = FB.query(FB.ref(`grid-topics`), FB.orderByChild('owner'), FB.equalTo(uid));
        let proms = [["public", publicQuery], ["owned", ownedQuery]].map(async ([type, query]) => {
            let allTopics = (await FB.get(query)).val() || {};
            await Promise.all(Object.keys(allTopics).map(async (topicUID) => {
                    TOPICS[topicUID] = allTopics[topicUID];
                    await addTopicOwnerName(topicUID);
            }))
    
            databaseWatchers.push(FB.onChildAdded(query, (snapshot) => {
                let topicUID = snapshot.key;
                TOPICS[topicUID] = snapshot.val();
                addTopicOwnerName(topicUID);

            }));
    
            databaseWatchers.push(FB.onChildChanged(query, (snapshot) => {
                let topicUID = snapshot.key;
                TOPICS[topicUID] = snapshot.val();
                addTopicOwnerName(topicUID);
            }));
    
            databaseWatchers.push(FB.onChildRemoved(query, (snapshot) => {
                let topicUID = snapshot.key;
                if (topicUID in TOPICS) {
                    delete TOPICS[topicUID]
                    // callUpdates();
                }
            }));
        });
        await Promise.all(proms);
        watchingAll = true;
    }

    let all = {};
    Object.keys(TOPICS).forEach(id => {
        all[id] = TOPICS[id];
    });

    return all;
}


/**
 * @param {string} id;
 * @return {boolean}
 */
export function hasTopic(id) {
    return id in TOPICS;
}


/**
 * @param {string[]} topics;
 * @return {Promise<Object.<string, GTopic>>}
 */
export async function getTopics(topics) {
    let topicsById = {};
    try {
        let gtopics = await Promise.all(topics.map(topic => getTopic(topic)));
        topics.forEach((id, i) => topicsById[id] = gtopics[i])
    } catch (e) {
        console.warn(e);
    }
    return topicsById;
}

/** get grid size returns the number of columns and rows in the grid
 * given by the grid size string provided. 
 * @param {GridSize} string
 * 
 * @return {[number, number]}
 */
export function getGridSize(string) {
    let size = [4,3];
    if (typeof string === "string" && string in GRID_SIZES) {
        size = GRID_SIZES[string]();
    }
    return size;
}

/** Search topics.
 * @param {phrase} string
 * @return {Promise<TopicSearchResults>}
 */
export async function searchTopics(phrase){
    let results = await FB.callFunction("gridTopics-search", {text: phrase});
    return results.data;
}

/**
 * Retreive the entire connected component of topics, for which contains
 *  the root topic id provided.
 * 
 * @param {string} rootTopicUID
 * 
 * @return {Promise<Object.<string, GTopic>>}
 */
export async function getTopicCC(rootTopicUID){
    /** @type {Object.<string, GTopic>} */
    let topics = {};

    /** @type {Set.<GTopic>} */
    let topicsToFetch = new Set([rootTopicUID])
    while (topicsToFetch.size > 0) {
        
        // Get all topics to fetch.
        await Promise.all([...topicsToFetch].map(async id => {
            let topic = await getTopic(id);
            topics[id] = topic;
        }));

        // Combine each topics items into a single array.
        let allItems = Object.values(topics).flatMap(topic => topic.items);

        // Filter on items of topic type and map to the topic ids those items link to.
        let linkedTopics = allItems.filter(item => item.type === "topic").map(item => item.topicUID);

        // Filter the linked topics to topics not all ready fetched.
        let nonFetchedLinkedTopics = linkedTopics.filter(id => !(id in topics));

        // The set of these topics will now be the next set of topics to fetch.
        topicsToFetch = new Set(nonFetchedLinkedTopics);

        // This process will repeat until there are no more 
        // topics with links to un fetched topics.
    }

    return topics;
}

/** 
 * @param {GItem} item 
 * @return {string}
 */
function getUtt(item) {
    return  (item.utterance || item.displayValue).trim().toLowerCase()
}


/**
 * @return {GItemType}
 */
export function isTopicItem(itemType) {
    return itemType in GITEM_TYPES && GITEM_TYPES[itemType] === "topic";
}


/**
 * Load utterances for a given topic
 * @param {GTopic} topic
 * @return {Promise}
 */
export async function loadTopicUtterances(topic) {
    let allPhrases = topic.items.filter(i => !i.hidden).map(item => getUtt(item));
    if (Text2Speech) {
        await Text2Speech.loadUtterances(allPhrases);
    }
}

/** 
 * @param {GItem}  item
 * @return {Promise<string>} url of utterance mp3 file
*/
export async function getUtterance(item, text2speech){
    let url = null;
    if (Text2Speech && !item.hidden) {
        let utt = getUtt(item);
        url = await Text2Speech.getUtteranceURL(utt);
    }
    return url;
}    

export async function getDefaultBoard() {
    let topicsDefault = await getTopicCC(DEFAULT_BOARD);
    
    return [DEFAULT_BOARD, topicsDefault]
}

export async function getQuickTalk() {
    let quickTalk = await getTopic(QUICK_TALK);
    return [QUICK_TALK, quickTalk]
}

export async function speakUtterance(item){
    if (Text2Speech) {
        await Text2Speech.speak(getUtt(item))
    }
}

export function setText2SpeechModule(text2speech) {
    Text2Speech = text2speech;
}