// index.js - Chronos V66.40 (Decoration Restored & Lorebook Bar)
// Part 1: Config & Data

const extensionName = "Chronos_Ultimate_V40";

// =================================================================
// 0. HIDDEN PROMPTS
// =================================================================

const HIDDEN_SUMMARY_PROMPT = `
[Instruction]: You are a "Narrative Archivist". Your job is to analyze the conversation history and summarize the current "Plot Route" and "Relationship Status".
1. Identify the current romantic or storyline route (e.g., Drama, Fluff, Enemies-to-Lovers).
2. Summarize key events that just happened.
3. Update the context memory for future consistency.
Output Format: "Route: [Type] | Status: [Summary]" - Keep it concise.
`;

const BASE_FRIEND_PROMPT = `
[Usage]: Always active. Use HTML format.
You are roleplaying as the specific characters defined by the user.
- If Mode is 'Group': Characters interact with each other and the Operator.
- If Mode is 'Route': Focus ONLY on the selected character's perspective and their specific history with the Operator.
- Maintain persistent memory of the 'Current Plot' defined in the summary.
`;

// =================================================================
// 1. STATE & STORAGE MANAGEMENT
// =================================================================

let dragConfig = {
    orbUnlocked: false, 
    panelUnlocked: false 
};

let uiState = {
    showNumpad: false, // ใช้ Toggle List Lorebook
    viewingId: null,
    numpadValue: "ID...",
    isPanelBuilt: false,
    friendMode: false,
    showCharSettings: false,
    chatMode: 'group',
    selectedCharId: null,
    editingCharId: null
};

// เก็บข้อมูล Lorebook
let lorebookState = {
    totalEntries: 0,
    activeEntries: [],
    activeCount: 0
};

let globalData = {
    characters: [
        { id: 1, name: "Kirin", color: "#C5A059", personality: "Cold, Observer, Loves Operator." },
        { id: 2, name: "WhiteCat", color: "#f0f0f0", personality: "Jealous, Possessive, Mocking." }
    ],
    routes: { "default": { summary: "New timeline started.", plot: "None" } },
    currentRouteId: "default"
};

let friendChatHistory = []; 

let lastRenderData = {
    saved: -1,
    range: "",
    total: -1,
    load: -1,
    max: -1,
    msgCount: -1,
    activeLore: -1,
    totalLore: -1
};

// --- Storage Functions ---

const loadGlobalData = () => {
    const saved = localStorage.getItem('chronos_global_db_v1');
    if (saved) globalData = JSON.parse(saved);
};

const saveGlobalData = () => {
    localStorage.setItem('chronos_global_db_v1', JSON.stringify(globalData));
};

loadGlobalData();

// --- Helpers ---

const getChronosTokenizer = () => {
    try {
        if (typeof SillyTavern !== 'undefined' && SillyTavern.Tokenizers) {
            const ctx = SillyTavern.getContext();
            const model = ctx?.model || SillyTavern.settings?.model;
            return SillyTavern.Tokenizers.getTokenizerForModel(model);
        }
        return null;
    } catch (e) { return null; }
};

const stripHtmlToText = (html) => {
    if (!html) return "";
    let text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<\/div>/gi, '\n').replace(/<\/h[1-6]>/gi, '\n');
    return text.replace(/<[^>]+>/g, '').replace(/&lt;[^&]+&gt;/g, '').replace(/\n\s*\n/g, '\n\n').trim();
};

// index.js - Part 2: Logic Core

// =================================================================
// 2. HOOKS
// =================================================================

const optimizePayload = (data) => {
    const processText = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
            return `[System Content:\n${stripHtmlToText(text)}]`;
        }
        return text;
    };
    if (data.body?.messages) {
        data.body.messages.forEach(msg => { msg.content = processText(msg.content); });
    } else if (data.body?.prompt) {
        data.body.prompt = processText(data.body.prompt);
    }
    setTimeout(() => { lastRenderData.msgCount = -1; updateUI(); }, 1000);
    return data;
};

// =================================================================
// 3. CALCULATOR & SCANNER
// =================================================================

const findMaxContext = (contextObj) => {
    let max = 0;
    if (contextObj.max_context && contextObj.max_context > 0) max = parseInt(contextObj.max_context);
    else if (typeof SillyTavern !== 'undefined' && SillyTavern.settings?.context_size) max = parseInt(SillyTavern.settings.context_size);
    if (max === 0) max = 4096;
    return max;
};

// สแกน Lorebook (World Info)
const scanLorebooks = () => {
    let context = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() || {} : {};
    const chat = context.chat || [];
    
    // เอาข้อความล่าสุดมาเช็ค Key
    let textToScan = "";
    if (chat.length > 0) textToScan += (chat[chat.length - 1].mes || "") + "\n";
    if (chat.length > 1) textToScan += (chat[chat.length - 2].mes || "") + "\n";
    textToScan = textToScan.toLowerCase();

    let entries = [];
    if (context.world_info) entries = context.world_info;
    else if (typeof SillyTavern.world_info !== 'undefined') entries = Object.values(SillyTavern.world_info);

    let activeList = [];
    let totalCount = 0;

    if (entries) {
        entries.forEach(entry => {
            if (entry.disable) return; // ข้ามอันที่ปิดอยู่
            totalCount++;
            
            // เช็ค Keywords
            let keys = [];
            if (Array.isArray(entry.keys)) keys = entry.keys;
            else if (typeof entry.keys === 'string') keys = entry.keys.split(',').map(k => k.trim()).filter(k => k);
            else if (entry.key) keys = entry.key.split(',').map(k => k.trim()).filter(k => k);

            let triggered = null;
            // เช็คว่า Keywords ตรงกับข้อความล่าสุดไหม
            for (let k of keys) {
                if (textToScan.includes(k.toLowerCase())) {
                    triggered = k;
                    break;
                }
            }
            
            const isConstant = entry.constant || (entry.position && entry.position.includes('constant'));
            
            if (triggered || isConstant) {
                activeList.push({
                    name: entry.comment || entry.name || "Untitled",
                    trigger: isConstant ? "[Constant]" : triggered,
                    content: entry.content
                });
            }
        });
    }

    lorebookState.totalEntries = totalCount;
    lorebookState.activeEntries = activeList;
    lorebookState.activeCount = activeList.length;
    
    return lorebookState;
};

// คำนวณ Token
const calculateStats = () => {
    let chat = [], context = {};
    if (typeof SillyTavern !== 'undefined') {
        context = SillyTavern.getContext() || {};
        chat = context.chat || [];
    }

    const tokenizer = getChronosTokenizer();
    const quickCount = (text) => tokenizer ? tokenizer.encode(text).length : Math.ceil((text||"").length / 3);

    let totalSaved = 0;

    chat.forEach((msg) => {
        const rawMsg = msg.mes || "";
        let rawCount = quickCount(rawMsg);
        let cleanCount = rawCount;
        if (/<[^>]+>/.test(rawMsg)) {
            const cleanText = stripHtmlToText(rawMsg);
            cleanCount = quickCount(`[System Content:\n${cleanText}]`);
            if (rawCount > cleanCount) totalSaved += (rawCount - cleanCount);
        }
    });

    // เรียก Scan Lorebook ทุกครั้ง
    scanLorebooks();

    return {
        savedTokens: totalSaved,
        totalMsgs: chat.length
    };
};

// index.js - Part 3: Interaction

// =================================================================
// 4. INTERACTION
// =================================================================

window.toggleDrag = (type, state) => {
    if (type === 'orb') dragConfig.orbUnlocked = state;
    else if (type === 'panel') dragConfig.panelUnlocked = state;
};

// ใช้ปุ่มนี้เปิดดูรายการ Lorebook
window.toggleLorebookView = () => {
    uiState.showNumpad = !uiState.showNumpad;
    renderLorebookList(); 
};

window.setViewingId = (id) => {
    let chat = SillyTavern.getContext()?.chat || [];
    if (isNaN(id) || id < 0 || id >= chat.length) return;
    uiState.viewingId = id;
    renderViewerSection();
};

window.closeViewer = () => {
    uiState.viewingId = null;
    renderViewerSection();
};

window.closePanel = () => { 
    const ins = document.getElementById('chronos-inspector');
    const orb = document.getElementById('chronos-orb');
    if (ins) ins.style.display = 'none';
    if (orb) orb.classList.remove('active'); 
};

// --- Character Settings Logic ---

window.toggleCharSettings = () => {
    uiState.showCharSettings = !uiState.showCharSettings;
    renderFriendBody();
};

window.saveNewCharacter = () => {
    const name = document.getElementById('new-char-name').value;
    const desc = document.getElementById('new-char-desc').value;
    const color = document.getElementById('new-char-color').value;
    if (name && desc) {
        globalData.characters.push({ id: Date.now(), name, color, personality: desc });
        saveGlobalData(); renderFriendBody();
    }
};

window.deleteCharacter = (id) => {
    globalData.characters = globalData.characters.filter(c => c.id !== id);
    saveGlobalData(); renderFriendBody();
};

window.setChatMode = (mode, charId = null) => {
    uiState.chatMode = mode; uiState.selectedCharId = charId;
    renderFriendBody();
};

const generateHiddenSummary = async (chatText) => {
    try {
        if (typeof SillyTavern.Generate === 'function') {
            const result = await SillyTavern.Generate([
                { role: 'system', content: HIDDEN_SUMMARY_PROMPT },
                { role: 'user', content: `Analyze: ${chatText}` }
            ], { quiet: true });
            globalData.routes[globalData.currentRouteId] = { summary: result, timestamp: Date.now() };
            saveGlobalData();
        }
    } catch(e) {}
};

window.toggleTabMode = () => {
    uiState.friendMode = !uiState.friendMode;
    const controls = document.getElementById('panel-controls');
    const tabBtn = document.getElementById('holo-tab-btn');
    document.getElementById('view-normal').style.display = uiState.friendMode ? 'none' : 'block';
    document.getElementById('view-friend').style.display = uiState.friendMode ? 'flex' : 'none';
    if (controls) controls.style.display = uiState.friendMode ? 'none' : 'flex';
    if (tabBtn) {
        tabBtn.innerText = uiState.friendMode ? 'STATS' : 'SYSTEM';
        tabBtn.style.color = '#00E676';
        tabBtn.style.boxShadow = uiState.friendMode ? '0 -5px 15px rgba(0, 230, 118, 0.4)' : '0 -4px 10px rgba(0, 230, 118, 0.2)';
    }
    if (uiState.friendMode) renderFriendBody();
};

window.sendFriendMsg = async () => {
    const input = document.getElementById('friend-input');
    const log = document.getElementById('friend-log');
    const txt = input.value.trim();
    if (!txt) return;
    input.value = ''; 
    log.innerHTML += `<div style="text-align:right; margin:5px; color:#aaa;"><b>Op:</b> ${txt}</div>`;
    friendChatHistory.push({ role: 'user', content: `[message] ${txt}` });
    generateHiddenSummary(txt);
    
    // Basic Friend Logic
    let sys = BASE_FRIEND_PROMPT + "\n[Chars]:";
    if (uiState.chatMode === 'group') globalData.characters.forEach(c => sys += `\n${c.name} (${c.personality})`);
    else { const c = globalData.characters.find(x=>x.id===uiState.selectedCharId); if(c) sys += `\n${c.name} (${c.personality})`; }
    
    const loadId = 'load-' + Date.now();
    log.innerHTML += `<div id="${loadId}" style="color:#00E676; font-size:10px;">Processing...</div>`;
    try {
        let reply = typeof SillyTavern.Generate === 'function' ? await SillyTavern.Generate([{role:'system',content:sys}, ...friendChatHistory, {role:'user',content:txt}], {quiet:true}) : "API Error";
        document.getElementById(loadId).remove();
        friendChatHistory.push({ role: 'assistant', content: reply });
        log.innerHTML += `<div style="margin:5px; padding:5px; border-radius:4px; background:#222;">${reply}</div>`;
    } catch(e) { document.getElementById(loadId).innerText = "Err"; }
    log.scrollTop = log.scrollHeight;
};

// index.js - Part 4: UI Renderer

// =================================================================
// 5. CORE RENDERER
// =================================================================

const buildBaseUI = () => {
    const ins = document.getElementById('chronos-inspector');
    if (!ins) return;
    
    ins.innerHTML = `
        <div id="holo-tab-btn" onclick="toggleTabMode()">SYSTEM</div>
        <div class="ins-header" id="panel-header">
            <span>🚀 CHRONOS V66.40</span>
            <span id="btn-close-panel" style="cursor:pointer; color:#ff4081;" onclick="closePanel()">✖</span>
        </div>
        
        <div class="control-zone" id="panel-controls">
            <div class="switch-row">
                <label class="neon-switch">
                    <input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <span class="switch-label">Orb</span>
            </div>
            <div class="switch-row">
                <label class="neon-switch">
                    <input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
                <span class="switch-label">Win</span>
            </div>
        </div>

        <div id="view-normal" style="display: ${uiState.friendMode ? 'none' : 'block'};">
            <div class="dashboard-zone">
                <div class="dash-row" style="border-bottom: 1px dashed #333; padding-bottom: 8px; margin-bottom: 8px;">
                    <span style="color:#aaa;">🔋 Tokens Saved</span>
                    <span class="dash-val" style="color:#E040FB;" id="disp-saved">0 T</span>
                </div>
                
                <div class="dash-row" style="align-items:center; cursor:pointer;" onclick="toggleLorebookView()">
                    <span style="color:#fff;">📘 Check Lorebook</span>
                    <button style="background:#330044; border:1px solid #D500F9; color:#fff; font-size:10px; padding:2px 8px; cursor:pointer;">VIEW LIST</button>
                </div>
                
                <div class="progress-container">
                    <div class="progress-bar" id="disp-bar" style="width: 0%"></div>
                </div>
                
                <div class="dash-row" style="margin-top:5px;">
                     <span style="font-size:9px; color:#aaa;">Entries Active : Total</span>
                     <span style="font-size:11px; color:#00E676; font-weight:bold;" id="disp-lore-ratio">0 : 0</span>
                </div>
            </div>

            <div class="ins-body">
                <div id="section-lorebook" style="display:none; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:10px;"></div>
                
                <div id="section-viewer"></div>
                <div style="font-size:9px; color:#666; margin-bottom:4px; text-transform:uppercase; margin-top:5px;">Recent Messages</div>
                <div class="msg-list" id="section-list"></div>
            </div>
        </div>

        <div id="view-friend" style="display: ${uiState.friendMode ? 'flex' : 'none'}; flex-direction: column; height: 380px;">
            <div style="padding:5px 10px; background:#222; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:10px; color:#aaa;">MODE: ${uiState.chatMode.toUpperCase()}</span>
                <button onclick="toggleCharSettings()" style="background:none; border:none; color:#C5A059; cursor:pointer;">⚙️ Setup</button>
            </div>
            <div id="friend-body-content" style="flex:1; overflow-y:auto;"></div>
            <div style="padding:8px; background:#222; display:flex; gap:5px; border-top:1px solid #00E676;">
                <input type="text" id="friend-input" style="flex:1; background:#000; border:1px solid #444; color:#fff; padding:5px; font-size:12px;" placeholder="Message..." onkeydown="if(event.key==='Enter') sendFriendMsg()">
                <button onclick="sendFriendMsg()" style="background:#00E676; border:none; color:#000; font-weight:bold; cursor:pointer; padding:0 10px;">➤</button>
            </div>
        </div>
    `;
    uiState.isPanelBuilt = true;
    if (uiState.friendMode) renderFriendBody();
};

const renderLorebookList = () => {
    const container = document.getElementById('section-lorebook');
    if (!container) return;
    if (!uiState.showNumpad) { container.style.display = 'none'; return; }
    
    container.style.display = 'block';
    const active = lorebookState.activeEntries || [];
    
    if (active.length === 0) {
        container.innerHTML = `<div style="color:#666; font-size:11px; text-align:center;">No Active World Info</div>`;
        return;
    }

    let html = `<div style="font-size:10px; color:#00E676; margin-bottom:5px;">✅ WORKING (${active.length})</div>`;
    active.forEach(entry => {
        html += `<div style="background:#111; padding:5px; margin-bottom:3px; border-left:2px solid #00E676; font-size:11px;">
            <div style="color:#fff;">${entry.name}</div>
            <div style="color:#aaa; font-size:9px;">Trig: ${entry.trigger}</div>
        </div>`;
    });
    container.innerHTML = html;
};

const renderFriendBody = () => {
    const container = document.getElementById('friend-body-content');
    if (!container) return;
    if (uiState.showCharSettings) {
        let html = `<div style="padding:10px;"><button onclick="setChatMode('group')" class="mode-btn">Group</button>`;
        globalData.characters.forEach(c=>html+=`<button onclick="setChatMode('route',${c.id})" class="mode-btn" style="color:${c.color}">${c.name}</button>`);
        html += `<div style="margin-top:10px;"><input id="new-char-name" placeholder="Name" style="width:100%; margin-bottom:5px;"><input id="new-char-color" type="color"><textarea id="new-char-desc" placeholder="Desc" style="width:100%;"></textarea><button onclick="saveNewCharacter()" style="width:100%;">Add</button></div></div>`;
        container.innerHTML = html;
    } else {
        container.innerHTML = `<div id="friend-log" style="padding:10px; font-size:12px; color:#ccc;">System Ready.</div>`;
    }
};

// index.js - Part 5: Update Loop & Full CSS

const updateUI = () => {
    const ins = document.getElementById('chronos-inspector');
    if (!ins || ins.style.display === 'none') return;
    if (!uiState.isPanelBuilt || ins.innerHTML === "") buildBaseUI();
    if (uiState.friendMode) return;

    // คำนวณ Stats
    const stats = calculateStats();
    const fmt = (n) => (n ? n.toLocaleString() : "0");

    // 1. อัปเดต Saved Tokens
    if (stats.savedTokens !== lastRenderData.saved) {
        const el = document.getElementById('disp-saved');
        if (el) el.innerText = `${fmt(stats.savedTokens)} T`;
        lastRenderData.saved = stats.savedTokens;
    }

    // 2. อัปเดต Lorebook Bar & Ratio (Active : Total)
    if (lorebookState.activeCount !== lastRenderData.activeLore || lorebookState.totalEntries !== lastRenderData.totalLore) {
        // อัปเดตข้อความ "5 : 20"
        const elRatio = document.getElementById('disp-lore-ratio');
        if (elRatio) elRatio.innerText = `${lorebookState.activeCount} : ${lorebookState.totalEntries}`;
        
        // อัปเดตหลอดสีรุ้ง
        let percent = lorebookState.totalEntries > 0 ? (lorebookState.activeCount / lorebookState.totalEntries) * 100 : 0;
        const elBar = document.getElementById('disp-bar');
        if (elBar) elBar.style.width = `${percent}%`;

        lastRenderData.activeLore = lorebookState.activeCount;
        lastRenderData.totalLore = lorebookState.totalEntries;
    }

    // 3. รีเฟรชหน้า List Lorebook ถ้าเปิดอยู่
    if (uiState.showNumpad) renderLorebookList();

    // 4. Render Message List (คืนค่าระบบแชท)
    renderListSection();
};

const renderListSection = () => {
    const container = document.getElementById('section-list');
    let chat = SillyTavern.getContext()?.chat || [];
    if (chat.length === 0) { container.innerHTML = `<div style="padding:5px; color:#666; font-size:10px;">No messages</div>`; return; }
    
    // Check if chat updated
    if (chat.length === lastRenderData.msgCount) return;
    lastRenderData.msgCount = chat.length;

    container.innerHTML = chat.slice(-5).reverse().map((msg, i) => {
        const idx = chat.length - 1 - i;
        const activeClass = (uiState.viewingId === idx) ? 'msg-active' : ''; 
        return `<div class="msg-item ${activeClass}" onclick="setViewingId(${idx})"><span style="color:#D500F9;">#${idx}</span> ${msg.is_user?'👤':'🤖'} ${(msg.mes||"").substring(0,20).replace(/</g,'&lt;')}...</div>`;
    }).join('');
};

const renderViewerSection = () => {
    const container = document.getElementById('section-viewer');
    if (uiState.viewingId === null) { container.innerHTML = ""; return; }
    let chat = SillyTavern.getContext()?.chat || [];
    const msg = chat[uiState.viewingId];
    if (msg) {
        let text = /<[^>]+>/.test(msg.mes) ? `[System Content:\n${stripHtmlToText(msg.mes)}]` : msg.mes;
        container.innerHTML = `<div class="viewer-container"><div class="viewer-header"><span style="color:#D500F9;">#${uiState.viewingId} Content<span><button class="close-btn" onclick="closeViewer()">CLOSE</button></div><div class="view-area">${text.replace(/</g, '&lt;')}</div></div>`;
    }
};

// คืนค่า CSS เต็มรูปแบบเพื่อการตกแต่งที่สวยงาม
const injectStyles = () => {
    const exist = document.getElementById('chronos-style');
    if (exist) exist.remove();
    const style = document.createElement('style');
    style.id = 'chronos-style';
    style.innerHTML = `
        /* --- ORB --- */
        #chronos-orb {
            position: fixed; top: 150px; right: 20px; width: 38px; height: 38px;
            background: radial-gradient(circle, rgba(20,0,30,0.95) 0%, rgba(0,0,0,1) 100%);
            border: 2px solid #D500F9; border-radius: 50%; z-index: 2147483648; cursor: move;
            display: flex; align-items: center; justify-content: center; font-size: 18px; color: #E040FB;
            box-shadow: 0 0 15px rgba(213, 0, 249, 0.6); animation: spin-slow 4s linear infinite;
            touch-action: none !important; user-select: none; -webkit-user-select: none;
        }
        #chronos-orb.active { border-color: #00E676 !important; color: #00E676 !important; box-shadow: 0 0 25px #00E676, inset 0 0 10px #00E676 !important; transform: scale(1.1); }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        /* --- WINDOW --- */
        #chronos-inspector {
            position: fixed; top: 80px; right: 70px; width: 320px;
            background: rgba(10, 10, 12, 0.98); border: 1px solid #D500F9; border-top: 3px solid #D500F9;
            color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 12px; display: none; z-index: 2147483647;
            border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,0.9); backdrop-filter: blur(10px);
            overflow: visible; touch-action: none !important;
        }
        #holo-tab-btn {
            position: absolute; top: -24px; right: 20px; background: #000; color: #00E676; font-size: 11px;
            font-weight: 800; padding: 4px 15px; border-radius: 4px 4px 0 0; border: 1px solid #00E676; border-bottom: none; z-index: 10; cursor: pointer;
            box-shadow: 0 -4px 10px rgba(0, 230, 118, 0.2); transition: 0.2s;
        }
        #holo-tab-btn:hover { text-shadow: 0 0 5px #00E676; box-shadow: 0 -5px 15px rgba(0, 230, 118, 0.5); }
        .ins-header { background: linear-gradient(90deg, #4A0072, #2a0040); color: #fff; padding: 15px; font-weight: bold; display: flex; justify-content: space-between; border-bottom: 1px solid #D500F9; touch-action: none !important; user-select: none; }
        
        /* --- CONTROLS --- */
        .control-zone { display: flex; gap: 15px; padding: 10px; background: #150518; border-bottom: 1px solid #330044; align-items: center; }
        .switch-row { display: flex; align-items: center; gap: 8px; } .switch-label { font-size: 11px; color: #ccc; }
        .neon-switch { position: relative; display: inline-block; width: 30px; height: 16px; } .neon-switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .4s; border-radius: 16px; border: 1px solid #555; }
        .slider:before { position: absolute; content: ""; height: 10px; width: 10px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background-color: #2a0040; border-color: #00E676; } input:checked + .slider:before { transform: translateX(14px); background-color: #00E676; box-shadow: 0 0 5px #00E676; }
        
        /* --- DASHBOARD --- */
        .dashboard-zone { background: #050505; padding: 15px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; align-items: center; }
        .dash-val { font-weight: bold; font-size: 13px; }
        
        /* --- RAINBOW BAR --- */
        .progress-container { width: 100%; height: 6px; background: #222; border-radius: 3px; margin-top: 8px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #D500F9, #00E676); width: 0%; transition: width 0.4s ease-out; }
        
        /* --- LIST & FRIEND --- */
        .ins-body { padding: 10px; background: #111; max-height: 400px; overflow-y: auto; }
        .mode-btn { background: #111; border: 1px solid #444; color: #aaa; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 10px; }
        .mode-btn.active { background: #222; border-color: #fff; color: #fff; box-shadow: 0 0 5px rgba(255,255,255,0.2); }
        .msg-list { max-height: 120px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #0a0a0a; border-radius: 4px; }
        .msg-item { padding: 8px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #888; border-left: 3px solid transparent; transition: 0.2s; }
        .msg-item:hover { background: #330044; color: #fff; }
        .msg-active { background: linear-gradient(90deg, #330044, #1a0520); color: #fff; border-left: 3px solid #00E676; transform: translateX(6px); }
        .viewer-container { margin-bottom: 10px; border: 1px solid #D500F9; border-radius: 4px; background: #080808; overflow: hidden; }
        .viewer-header { background: #1a0520; padding: 5px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }
        .close-btn { background: #ff4081; color: #fff; border: none; font-size: 9px; padding: 2px 6px; border-radius: 2px; cursor: pointer; }
        .view-area { padding: 8px; height: 120px; overflow-y: auto; color: #00E676; white-space: pre-wrap; word-wrap: break-word; font-size: 11px; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #111; } ::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
    `;
    document.head.appendChild(style);
};

const createUI = () => {
    const oldOrb = document.getElementById('chronos-orb'); if (oldOrb) oldOrb.remove();
    const oldPanel = document.getElementById('chronos-inspector'); if (oldPanel) oldPanel.remove();
    const orb = document.createElement('div'); orb.id = 'chronos-orb'; orb.innerHTML = '🌌';
    const ins = document.createElement('div'); ins.id = 'chronos-inspector';
    document.body.appendChild(orb); document.body.appendChild(ins);
    const togglePanel = () => { if (ins.style.display === 'none' || ins.style.display === '') { ins.style.display = 'block'; orb.classList.add('active'); updateUI(); } else { ins.style.display = 'none'; orb.classList.remove('active'); } };
    makeDraggable(orb, 'orb', togglePanel); makeDraggable(ins, 'panel', null); 
};

const makeDraggable = (elm, type, clickCallback) => {
    let offsetX = 0, offsetY = 0, isDragging = false, hasMoved = false;
    const start = (e) => {
        if (e.target.id === 'btn-close-panel') return;
        if (type === 'panel' && !e.target.classList.contains('ins-header') && !e.target.parentElement.classList.contains('ins-header')) return;
        if (e.type === 'touchstart') { e.stopPropagation(); e.preventDefault(); } else { e.preventDefault(); }
        const c = e.touches ? e.touches[0] : e;
        offsetX = c.clientX - elm.getBoundingClientRect().left; offsetY = c.clientY - elm.getBoundingClientRect().top;
        isDragging = true; hasMoved = false;
    };
    const move = (e) => {
        if (!isDragging) return;
        if ((type === 'orb' && !dragConfig.orbUnlocked) || (type === 'panel' && !dragConfig.panelUnlocked)) return;
        if (e.type === 'touchmove') { e.stopPropagation(); e.preventDefault(); }
        hasMoved = true;
        const c = e.touches ? e.touches[0] : e;
        elm.style.left = (c.clientX - offsetX) + "px"; elm.style.top = (c.clientY - offsetY) + "px";
    };
    const end = () => { isDragging = false; if (!hasMoved && clickCallback) clickCallback(); };
    elm.onmousedown = start; document.onmousemove = move; document.onmouseup = end;
    elm.addEventListener('touchstart', start, {passive:false}); elm.addEventListener('touchmove', move, {passive:false}); elm.addEventListener('touchend', end);
};

(function() { injectStyles(); setTimeout(createUI, 2000); if (typeof SillyTavern !== 'undefined' && SillyTavern.extension_manager) { SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload); SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload); } setInterval(updateUI, 2000); })();
