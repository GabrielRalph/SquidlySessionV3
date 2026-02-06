import { filterAndSort, SearchWindow, SearchBar } from "../../Utilities/search.js";
import { relURL } from "../../Utilities/usefull-funcs.js";
import { Features, OccupiableWindow } from "../features-interface.js";
import { SvgPlus } from "../../SvgPlus/4.js";
import { GridIcon, GridLayout } from "../../Utilities/Buttons/grid-icon.js";
import { KeyboardPanel } from "./keyboard-panel.js";


const ChatList = [
    // TODO: Add chat URLs when available
]

class ChatSearch extends SearchWindow {
    constructor(chats) {
        super();
        this.chats = chats;
        this.styles = {
            background: "white",
        }
    }

    reset(imm) {
        this.closeIcon = "close";
        this.resetSearchItems(imm)
    }

    async getSearchResults(searchPhrase) {
        let chats = this.chats;
        /** @type {Answer[]} */
        let items = chats.map(q => {
            return {
                app: q,
                icon: {
                    symbol: q.icon,
                    type: "image",
                },
            }
        })
        items = filterAndSort(items, searchPhrase, ({ app: { title, subtitle } }) => [title, subtitle]);
        return items;
    }
}

/**
 * ChatMessage class - Unified message representation
 * Handles message display, hover effects, and URL detection
 */
class ChatMessage extends SvgPlus {
    constructor(message, currentUser) {
        super("div");
        this.class = "chat-message";
        this.message = message;
        this.currentUser = currentUser;
        this.isSent = message.senderId === currentUser;
        this.messageType = this.isSent ? 'sent' : 'received';

        this.build();
    }

    build() {
        // Set message attributes
        this.setAttribute("class", `message ${this.messageType}`);
        this.setAttribute("data-message-id", this.message.id);

        // Create message-content container first
        const messageContent = this.createChild("div", { class: "message-content" });

        // Create message bubble with URL detection
        const bubble = messageContent.createChild("div", { class: "message-bubble" });
        this._renderMessageText(bubble, this.message.text || '');

        // Create message meta (timestamp) - hidden by default, shown on hover
        // For received: meta after content (right side)
        // For sent: meta before content in DOM, but row-reverse will put it on left
        this.meta = this.createChild("div", { class: "message-meta" });
        this._updateMeta();

        // Add hover listeners
        this._setupHoverListeners();
    }

    _updateMeta() {
        const timestamp = this.message.timestamp
            ? new Date(this.message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
        const status = this.message.status || 'Sent';
        this.meta.textContent = timestamp ? `${timestamp} · ${status}` : status;
    }

    /**
     * Render message text with URL detection and linkification
     */
    _renderMessageText(container, text) {
        // URL regex pattern - matches http://, https://, and www. URLs
        const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
        const parts = text.split(urlPattern);

        // Strategy pattern: URL vs text rendering
        const renderPart = (part) => {
            if (!part) return;

            urlPattern.lastIndex = 0;
            return urlPattern.test(part)
                ? this._renderUrl(container, part)
                : this._renderText(container, part);
        };

        parts.forEach(renderPart);
        container.style.whiteSpace = 'pre-line';
    }

    _renderUrl(container, part) {
        const url = part.startsWith('http') ? part : `https://${part}`;
        const link = container.createChild("a", {
            href: url,
            target: "_blank",
            rel: "noopener noreferrer",
            class: "message-link"
        });
        link.textContent = part;
    }

    _renderText(container, part) {
        const lines = part.split('\n');
        lines.forEach((line, i) => {
            i > 0 && container.appendChild(document.createElement('br'));
            line && container.appendChild(document.createTextNode(line));
        });
    }

    /**
     * Setup hover listeners to show/hide timestamp
     */
    _setupHoverListeners() {
        // Show meta on hover
        this.events = {
            mouseenter: () => {
                this.meta.style.opacity = '1';
                this.meta.style.visibility = 'visible';
            },
            mouseleave: () => {
                this.meta.style.opacity = '0';
                this.meta.style.visibility = 'hidden';
            }
        };
    }
}

class ChatHistory extends SvgPlus {
    constructor(feature) {
        super("div");
        this.class = "chat-history";
        this.feature = feature;
        this.currentUser = 'host';
        this.loadedMessageIds = new Set();
        this.messages = [];
        this.messageContainer = null;
        this.scrollAmount = 100; // Pixels to scroll per button click

        this.setupScrollContainer();
    }

    setupScrollContainer() {
        // Create scrollable container with proper styling
        this.messageContainer = this.createChild("div");
        this.messageContainer.classList.add("message-container");
        // Ensure it's scrollable and constrained
        this.messageContainer.style.overflowY = 'auto';
        this.messageContainer.style.overflowX = 'hidden';
        this.messageContainer.style.flex = '1 1 0';
        this.messageContainer.style.minHeight = '0';
        this.messageContainer.style.height = '100%';
        this.messageContainer.style.maxHeight = '100%';
        this.messageContainer.style.boxSizing = 'border-box';
        this.messageContainer.style.position = 'relative';

        // Force transparent scrollbar via inline style (as fallback)
        // Note: CSS custom properties for scrollbar don't work inline, but we ensure class is applied
        this.messageContainer.setAttribute('data-scrollbar-transparent', 'true');
    }

    createMessageElement(message) {
        // Guard clause: early return if no container
        if (!this.messageContainer) return null;

        // Factory pattern: use ChatMessage class for unified message representation
        const chatMessage = new ChatMessage(message, this.currentUser);
        this.messageContainer.appendChild(chatMessage);

        return chatMessage;
    }

    /** Sort comparator: both parties' messages by time, one by one (oldest first). */
    _messageOrder(a, b) {
        const ta = Number(a.timestamp) || 0;
        const tb = Number(b.timestamp) || 0;
        if (ta !== tb) return ta - tb;
        return (a.id || '').localeCompare(b.id || '');
    }

    renderMessages() {
        if (!this.messageContainer) return;

        this.messageContainer.innerHTML = '';
        this.messages.forEach(message => this.createMessageElement(message));
        this.scrollToBottom();
    }

    addMessage(message) {
        // Guard clause: early return for invalid or duplicate messages
        if (!message?.id || this.loadedMessageIds.has(message.id)) return;

        this.loadedMessageIds.add(message.id);
        this.messages.push(message);
        // Both parties sorted by time (one by one), then re-render
        this.messages.sort((a, b) => this._messageOrder(a, b));
        this.messageContainer && (this.renderMessages(), this.scrollToBottom());
    }

    loadMessages(messages) {
        // Clear existing messages
        this.loadedMessageIds.clear();
        this.messages = [];

        // Sort by timestamp so both parties are interleaved chronologically
        const sorted = [...messages].sort((a, b) => this._messageOrder(a, b));
        sorted.forEach(msg => {
            this.loadedMessageIds.add(msg.id);
            this.messages.push(msg);
        });

        // Render all messages
        this.renderMessages();
    }

    init(user, userName) {
        this.currentUser = user || 'host';
    }

    scrollUp() {
        if (!this.messageContainer) return;
        const currentScroll = this.messageContainer.scrollTop ?? 0;
        this.messageContainer.scrollTop = Math.max(0, currentScroll - this.scrollAmount);
    }

    scrollDown() {
        // Guard clause with early return
        if (!this.messageContainer) return;

        // Functional approach: calculate scroll position
        const currentScroll = this.messageContainer.scrollTop ?? 0;
        const maxScroll = this.messageContainer.scrollHeight - this.messageContainer.clientHeight;
        this.messageContainer.scrollTop = Math.min(maxScroll, currentScroll + this.scrollAmount);
    }

    scrollToBottom() {
        this.messageContainer && requestAnimationFrame(() => {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        });
    }
}

class ChatWindow extends OccupiableWindow {
    constructor(feature, sdata) {

        super("chat-window");
        this.feature = feature;
        this.sdata = sdata;

        this.build();
    }

    build() {
        this.grid = this.createChild(GridLayout, {
            style: { position: "absolute", top: "var(--gap)", left: "var(--gap)", right: "var(--gap)", bottom: "var(--gap)" }
        }, 4, 5);
        this.search = this.createChild(ChatSearch, {
            style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }
        });

        // Create keyboard panel as a child of ChatWindow (like Quiz's search/quizView)
        this.keyboardPanel = this.createChild(KeyboardPanel, {}, this.feature);

        // Single source of truth: both inputBar and keyboard panel stay in sync
        this.feature._inputDraft = '';
        this.feature._onKeyboardInputChange = (value) => {
            this.feature._inputDraft = value ?? '';
            if (this.inputBar) this.inputBar.value = this.feature._inputDraft;
        };
        this.feature._syncDraftToKeyboardPanel = (v, force = false) => {
            this.feature._inputDraft = v ?? '';
            const k = this.keyboardPanel;
            if ((force || k?.shown) && k?.chatInput) {
                k.chatInput.value = this.feature._inputDraft;
                k._updateWordSuggestions();
            }
        };

        // Create chat history (red rectangle area for messages)
        this.chatHistory = this.createChild(ChatHistory, {}, this.feature);

        // Create message bar (SearchBar for input)
        this.inputBar = this.createChild(SearchBar);

        // Replace input with textarea for multi-line input
        this.inputBar?.input && this.inputBar?.content && this._setupTextarea();

        // Make SearchBar clickable to focus textarea
        this.inputBar?.content && (this.inputBar.content.events = {
            "click": () => this.inputBar?.input?.focus()
        });
    }

    _setupTextarea() {
        const oldInput = this.inputBar.input;
        const textarea = this.inputBar.content.createChild("textarea");
        textarea.setAttribute("placeholder", "Type a message...");
        oldInput?.value && (textarea.value = oldInput.value);

        // Key handlers - strategy pattern
        const keyHandlers = {
            Escape: (e) => {
                textarea.blur();
                e.preventDefault();
            }
        };

        textarea.events = {
            "focusin": () => this.inputBar.toggleAttribute("hover", true),
            "focusout": () => this.inputBar.toggleAttribute("hover", false),
            "keydown": (e) => {
                const handler = keyHandlers[e.key];
                handler && handler(e);
            },
            "input": () => this.feature._syncDraftToKeyboardPanel(this.inputBar?.value ?? '')
        };

        oldInput.remove();
        this.inputBar.input = textarea;

        let closeIcon = new GridIcon({
            symbol: "close",
            displayValue: "Exit",
            type: "action",
            events: {
                "access-click": async (e) => {
                    e.waitFor(Promise.all([
                        this.feature.session.openWindow("default"),
                        this.feature.close()
                    ]))
                }
            }
        }, "chat");

        closeIcon.styles = {
            "--shadow-color": "transparent",
            "pointer-events": "all",
        }

        let sendIcon = new GridIcon({
            symbol: "send",
            displayValue: "Send",
            type: "action",
            events: {
                "access-click": async (e) => {
                    const text = this.inputBar?.value ?? '';
                    this.inputBar.value = '';
                    this.feature._inputDraft = '';
                    this.feature._sendMessage(text).catch(error => {
                        console.error("[Chat] Error sending message:", error);
                    });
                }
            }
        }, "chat");
        sendIcon.styles = {
            "--shadow-color": "transparent",
            "pointer-events": "all",
        }

        // Keyboard button
        let pullUp = new GridIcon({
            symbol: "upArrow",
            displayValue: "Keyboard",
            type: "action",
            events: {
                "access-click": (e) => {
                    this.feature._handleKeyboardButton(e);
                }
            }
        }, "chat");
        pullUp.styles = {
            "--shadow-color": "transparent",
            "pointer-events": "all",
        }

        let upScrollIcon = new GridIcon({
            symbol: "upArrow",
            displayValue: "Scroll Up",
            type: "action",
            events: {
                "access-click": () => this.chatHistory?.scrollUp()
            }
        }, "chat");
        upScrollIcon.styles = {
            "--shadow-color": "transparent",
            "pointer-events": "all",
        }

        let downScrollIcon = new GridIcon({
            symbol: "downArrow",
            displayValue: "Scroll Down",
            type: "action",
            events: {
                "access-click": () => this.chatHistory?.scrollDown()
            }
        }, "chat");
        downScrollIcon.styles = {
            "--shadow-color": "transparent",
            "pointer-events": "all",
        }


        this.grid.add(closeIcon, 0, 0);
        this.grid.add(sendIcon, 3, 4);
        this.grid.add(this.inputBar, 3, 1, 3, 3);
        this.grid.add(pullUp, 3, 0);
        this.grid.add(upScrollIcon, 1, 0);
        this.grid.add(downScrollIcon, 2, 0);
        this.grid.add(this.chatHistory, 0, 1, 2, 4);
    }

    // Send data to chat history
    // Message handlers - strategy pattern
    _messageHandlers = {
        init: (data) => this.chatHistory?.init(data.user, data.userName),
        loadMessages: (data) => this.chatHistory?.loadMessages(data.messages || []),
        newMessage: (data) => this.chatHistory?.addMessage(data.message)
    };

    sendMessage(data) {
        const handler = this._messageHandlers[data.mode];
        handler && handler(data);
    }

    static get usedStyleSheets() {
        return [
            relURL("./chat.css", import.meta),
            relURL("./keyboard-panel.css", import.meta), // Include keyboard panel styles (KeyboardPanel is a child of ChatWindow)
            ...SearchWindow.usedStyleSheets,
            GridIcon.styleSheet,
        ]
    }
    static get fixToolBarWhenOpen() { return true }
}

export default class ChatFeature extends Features {
    constructor(session, sdata) {
        super(session, sdata)
        this.chatWindow = new ChatWindow(this, sdata);
        this.chatWindow.open = this.open.bind(this);
        this.chatWindow.close = this.close.bind(this);
        // keyboardPanel is now a child of chatWindow (created in ChatWindow.build())
    }

    async open() {
        await Promise.all([
            this.chatWindow.root.show(),
            this.chatWindow.search.hide()
        ]);

        // Initialize session and UI after window is shown
        await this._initSession();
        await this._initChatUI();
    }

    async close() {
        await this.chatWindow.root.hide()
    }



    async initialise() {

        this.session.toolBar.addMenuItem("share", {
            name: "chat",
            symbol: "msg",
            index: 300,
            onSelect: e => e.waitFor(this.session.openWindow("chat")),
        })


        // Note: We don't use onValue listener for selected_chat like Apps does
        // because Chat doesn't need remote synchronization of window state
        // The window state is managed entirely by session.openWindow()
    }

    // Keyboard button handlers - strategy pattern
    _keyboardHandlers = {
        true: async (keyboardPanel) => {
            // keyboard-open class is removed in keyboardPanel.hide() before animation starts
            await keyboardPanel.hide(500);
        },
        false: async (keyboardPanel) => {
            // keyboard-open class is added in keyboardPanel.show() before animation starts
            await keyboardPanel.show(500, true);
        }
    };

    async _handleKeyboardButton(e) {
        const keyboardPanel = this.chatWindow.keyboardPanel;
        if (!keyboardPanel) return;
        if (!keyboardPanel.shown) this._syncDraftToKeyboardPanel(this._inputDraft ?? this.chatWindow.inputBar?.value ?? '', true);
        const handler = this._keyboardHandlers[keyboardPanel.shown];
        handler && await handler(keyboardPanel);
    }

    // User name mapping - factory pattern
    _userNameMap = {
        host: "Host",
        participant: "Participant"
    };

    async _sendMessage(text) {
        const trimmed = text != null ? String(text).trim() : '';
        if (!trimmed) return false;

        const messageData = {
            senderId: this.sdata.me,
            senderName: this._userNameMap[this.sdata.me] ?? "Participant",
            text: trimmed,
            timestamp: Date.now(),
            status: "sent",
            messageType: "text"
        };

        try {
            const messageKey = this.sdata.push("messages");
            await this.sdata.set(`messages/${messageKey}`, messageData);
            console.log(`[Chat] Message sent by ${this.sdata.me}: ${messageKey}`);
            return true; // Return true to indicate success
        } catch (error) {
            console.error("[Chat] Error sending message:", error);
            return false; // Return false to indicate failure
        }
    }

    async _initChatUI() {
        // Initialize chat UI with user data
        this.chatWindow.sendMessage({
            mode: "init",
            user: this.sdata.me,
            userName: this._userNameMap[this.sdata.me] ?? "Participant"
        });

        // Load existing messages (order by time is applied in ChatHistory.loadMessages)
        try {
            const messages = await this.sdata.get("messages");
            messages && this.chatWindow.sendMessage({
                mode: "loadMessages",
                messages: Object.entries(messages).map(([key, value]) => ({ id: key, ...value }))
            });
        } catch (error) {
            console.error("[Chat] Error loading messages:", error);
        }

        // Listen for new messages
        this.sdata.onChildAdded("messages", (message, messageKey) => {
            this.chatWindow.sendMessage({
                mode: "newMessage",
                message: { id: messageKey, ...message }
            });
        });
    }

    async _initSession() {
        console.log("[Chat] Initializing session in Firebase...");
        try {
            const metadata = await this.sdata.get("metadata");
            const metadataHandlers = {
                true: async () => console.log("[Chat] Session metadata already exists"),
                false: async () => {
                    console.log("[Chat] Creating new session metadata...");
                    await this.sdata.set("metadata", {
                        createdBy: this.sdata.me,
                        createdAt: Date.now(),
                        type: "direct"
                    });
                    console.log("[Chat] Session metadata created");
                }
            };
            const handler = metadataHandlers[!!metadata];
            handler && await handler();

            console.log("[Chat] Adding current user to participants...");
            await this.sdata.set(`participants/${this.sdata.me}`, true);
            console.log("[Chat] Session initialized successfully");
        } catch (error) {
            console.error("[Chat] Error initializing session:", error);
        }
    }


    static get name() {
        return "chat"
    }

    static get layers() {
        return {
            chatWindow: {
                type: "area",
                area: "fullAspectArea",
                index: 60
            }
        }
    }

    static get firebaseName() {
        return "chat"
    }

    static async loadResources() {
        await ChatWindow.loadStyleSheets();
    }
}
