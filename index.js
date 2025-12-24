// index.js - Chronos V49 (True Sight) 👁️💎
// Logic: Manual Count on Startup + HTML Stripping
// Fixes: 0 Tokens on start, Max Context detection for Unlocked mode

const extensionName = "Chronos_V49_TrueSight";

// =================================================================
// 1. HELPERS & TOKENIZER
// =================================================================
const getChronosTokenizer = () => {
    try {
        const ctx = SillyTavern.getContext();
        const model = ctx?.model || ctx?.settings?.model || SillyTavern?.settings?.model;
        if (!model) return null;
        return SillyTavern.Tokenizers.getTokenizerForModel(model);
    } catch (e) {
        return null;
    }
};

const stripHtmlToText = (html) => {
    if (!html) return "";
    let text = html.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/p>/gi, '\n\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/h[1-6]>/gi, '\n');
    text = text.replace(/<[^>]+>/g, ''); 
    text = text.replace(/&lt;[^&]+&gt;/g, ''); 
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    return text;
};

// =================================================================
// 2. HOOKS (Intercept & Save)
// =================================================================
let LAST_PAYLOAD_TOKENS = 0; // เก็บค่าล่าสุดที่ส่งจริง

const optimizePayload = (data) => {
    // 1. Process Function
    const processText = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
            return `[System Content:\n${stripHtmlToText(text)}]`;
        }
        return text;
    };

    // 2. Modify Payload (Strip HTML)
    if (data.body?.messages) {
        data.body.messages.forEach(msg => {
            msg.content = processText(msg.content);
        });
    } else if (data.body?.prompt) {
        data.body.prompt = processText(data.body.prompt);
    }

    // 3. Count Sent Tokens (The Real Value)
    try {
        const tokenizer = getChronosTokenizer();
        if (tokenizer) {
            if (data.body?.messages && data.body.messages.length > 0) {
                // Approximate total based on last message to update state
                const lastMsg = data.body.messages[data.body.messages.length - 1];
                LAST_PAYLOAD_TOKENS = tokenizer.encode(lastMsg.content).length; 
            }
        }
    } catch (e) {}

    // 4. Force UI Refresh
    setTimeout(() => {
        const ins = document.getElementById('chronos-inspector');
        if (ins && ins.style.display === 'block') renderInspector();
    }, 500);
    
    return data;
};

// =================================================================
// 3. CORE CALCULATOR (The Brain)
// =================================================================
const calculateStats = () => {
    if (typeof SillyTavern === 'undefined') return { memoryRange: "Loading...", original: 0, optimized: 0, saved: 0, max: 0 };
    
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    const tokenizer = getChronosTokenizer();
    
    // Helper function to count (Fallback to char count if tokenizer fails)
    const quickCount = (text) => (tokenizer && typeof tokenizer.encode === 'function') ? tokenizer.encode(text).length : Math.round(text.length / 3);

    // --- A. FIND REAL MAX CONTEXT ---
    let maxTokens = 8192; // Default fallback
    const candidateValues = [];
    
    // 1. Settings (Unlocked Check)
    if (SillyTavern.settings) {
        if (SillyTavern.settings.context_size) candidateValues.push(parseInt(SillyTavern.settings.context_size));
        if (SillyTavern.settings.max_context) candidateValues.push(parseInt(SillyTavern.settings.max_context));
    }
    // 2. Main API (Server Limit)
    if (SillyTavern.main_api && SillyTavern.main_api.max_context) {
        candidateValues.push(parseInt(SillyTavern.main_api.max_context));
    }
    // 3. Context Object
    if (context.max_context) candidateValues.push(parseInt(context.max_context));
    
    // Pick the highest reasonable number
    const validValues = candidateValues.filter(v => typeof v === 'number' && v > 512);
    if (validValues.length > 0) maxTokens = Math.max(...validValues);


    // --- B. CALCULATE LOAD (Manual Scan) ---
    // เราต้องนับเองใหม่หมด เพื่อแก้ปัญหาค่าเริ่มต้นเป็น 0 และเพื่อเทียบ Saved Tokens
    
    let totalRaw = 0;       // แบบมี HTML (ST เดิม)
    let totalOptimized = 0; // แบบตัด HTML (ของเรา)
    let memoryRangeText = "-";
    
    let currentFill = 0;
    let startMsgIndex = -1;
    let rememberedCount = 0;
    const systemOverhead = 200; // ค่าเผื่อ System Prompt คร่าวๆ
    const availableForChat = maxTokens - systemOverhead;

    // Iterate backwards to find context window
    for (let i = chat.length - 1; i >= 0; i--) {
        const rawMsg = chat[i].mes || "";
        const rawLen = quickCount(rawMsg);
        
        // Optimize Logic
        let cleanMsg = rawMsg;
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(rawMsg)) {
            const txt = stripHtmlToText(rawMsg);
            cleanMsg = `[System Content:\n${txt}]`;
        }
        const optLen = quickCount(cleanMsg);

        // Accumulate Totals
        totalRaw += rawLen;
        totalOptimized += optLen;

        // Check Context Window
        if (currentFill + optLen <= availableForChat) {
            currentFill += optLen;
            startMsgIndex = i;
            rememberedCount++;
        }
    }

    // Determine Memory Label
    if (chat.length > 0) {
        if (rememberedCount >= chat.length) memoryRangeText = `All (#0 - #${chat.length - 1})`;
        else if (startMsgIndex !== -1) memoryRangeText = `#${startMsgIndex} ➔ #${chat.length - 1}`;
        else memoryRangeText = "Overflow";
    }

    // ถ้ามีการส่งค่าจริง (LAST_PAYLOAD) ให้ใช้ค่า Update ล่าสุดผสมกับค่าที่นับได้
    // แต่เพื่อความเสถียร ใช้ค่าที่นับเอง (totalOptimized) จะแม่นกว่าในหน้าจอรวม
    
    return {
        memoryRange: memoryRangeText,
        original: totalRaw,
        optimized: totalOptimized,
        saved: Math.max(0, totalRaw - totalOptimized),
        max: maxTokens,
        source: "Live Calc"
    };
};

// =================================================================
// 4. UI RENDERER (Preserves Scroll)
// =================================================================
const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    if (!ins || ins.style.display === 'none') return;

    // 1. Lock Scroll
    const msgListEl = ins.querySelector('.msg-list');
    const prevScrollTop = msgListEl ? msgListEl.scrollTop : 0;

    // 2. Get Data
    const chat = SillyTavern.getContext().chat || [];
    const stats = calculateStats();
    const percent = stats.max > 0 ? Math.min((stats.optimized / stats.max) * 100, 100) : 0;

    // 3. Build List
    let listHtml = chat.slice(-5).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        const preview = (msg.mes || "").substring(0, 30).replace(/</g, '&lt;');
        const roleIcon = msg.is_user ? '👤' : '🤖';
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">
                    <span style="color:#D500F9; font-weight:bold;">#${actualIdx}</span> ${roleIcon} ${preview}...
                </div>`;
    }).join('');

    // 4. Update HTML
    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🚀 CHRONOS V49 (True Sight)</span>
            <span style="cursor:pointer; color:#ff4081;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        
        <div class="control-zone">
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}> Orb</label>
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}> Win</label>
        </div>

        <div class="dashboard-zone">
            <div class="dash-row">
                <span style="color:#aaa;">🧠 Memory Span</span>
                <span class="dash-val" style="color:#E040FB;">${stats.memoryRange}</span>
            </div>
            
            <div class="dash-row">
                <span style="color:#aaa;">✂️ HTML Cut</span>
                <span class="dash-val" style="color:#00E676;">-${stats.saved} toks</span>
            </div>

            <div class="dash-row">
                <span style="color:#fff;">🔋 Load (Optimized)</span>
                <span class="dash-val" style="color:#fff;">${stats.optimized} / ${stats.max}</span>
            </div>

            <div class="progress-container">
                <div class="progress-bar" style="width: ${percent}%"></div>
            </div>
        </div>

        <div class="ins-body">
            <div class="msg-list">${listHtml}</div>
            <div id="view-target-wrapper"><div id="view-target-content"></div></div>
        </div>
    `;

    // 5. Restore Scroll & Handlers
    const newMsgListEl = ins.querySelector('.msg-list');
    if (newMsgListEl) newMsgListEl.scrollTop = prevScrollTop;
};

// =================================================================
// 5. UI SETUP & UTILS (Draggable, Styles, Etc)
// =================================================================
let dragConfig = { orbUnlocked: false, panelUnlocked: false };

const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb { position: fixed; top: 150px; right: 20px; width: 40px; height: 40px; background: #000; border: 2px solid #D500F9; border-radius: 50%; z-index: 999999; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #E040FB; animation: spin-slow 10s linear infinite; }
        #chronos-inspector { position: fixed; top: 80px; right: 70px; width: 300px; background: rgba(10, 10, 15, 0.98); border: 1px solid #D500F9; color: #ccc; font-family: sans-serif; font-size: 11px; display: none; z-index: 999999; border-radius: 6px; box-shadow: 0 10px 40px rgba(0,0,0,0.9); }
        .ins-header { background: #2a0040; color: #fff; padding: 8px; font-weight: bold; display: flex; justify-content: space-between; cursor: default; }
        .control-zone { padding: 4px 8px; background: #15051a; border-bottom: 1px solid #300a3d; display: flex; gap: 10px; }
        .dashboard-zone { padding: 10px; background: #080808; border-bottom: 1px solid #222; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .dash-val { font-family: 'Consolas', monospace; font-weight: bold; font-size: 12px; }
        .progress-container { width: 100%; height: 4px; background: #333; margin-top: 5px; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #D500F9, #00E676); transition: width 0.3s; }
        .ins-body { padding: 8px; max-height: 300px; overflow-y: auto; }
        .msg-list { max-height: 100px; overflow-y: auto; border: 1px solid #333; background: #111; margin-bottom: 8px; }
        .msg-item { padding: 4px; border-bottom: 1px solid #222; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #777; }
        .msg-item:hover { background: #330044; color: #fff; }
        .view-area { background: #000; color: #00E676; padding: 8px; border: 1px solid #333; height: 100px; overflow-y: auto; white-space: pre-wrap; margin-top: 4px; font-family: 'Consolas', monospace; }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
};

window.toggleDrag = (type, v) => {
    if (type === 'orb') dragConfig.orbUnlocked = v;
    if (type === 'panel') { dragConfig.panelUnlocked = v; document.getElementById('panel-header').style.cursor = v ? 'move' : 'default'; }
};

const makeDraggable = (elm, type) => {
    let pos1=0, pos2=0, pos3=0, pos4=0;
    const dragStart = (e) => {
        if ((type === 'orb' && !dragConfig.orbUnlocked) || (type === 'panel' && !dragConfig.panelUnlocked)) return;
        if (type === 'panel' && !e.target.closest('.ins-header')) return;
        e.preventDefault();
        pos3 = e.clientX || e.touches?.[0].clientX; pos4 = e.clientY || e.touches?.[0].clientY;
        document.onmouseup = dragEnd; document.onmousemove = dragAction;
        document.ontouchend = dragEnd; document.ontouchmove = dragAction;
        elm.setAttribute('data-dragging', 'true');
    };
    const dragAction = (e) => {
        const cx = e.clientX || e.touches?.[0].clientX; const cy = e.clientY || e.touches?.[0].clientY;
        pos1 = pos3 - cx; pos2 = pos4 - cy; pos3 = cx; pos4 = cy;
        elm.style.top = (elm.offsetTop - pos2) + "px"; elm.style.left = (elm.offsetLeft - pos1) + "px";
    };
    const dragEnd = () => {
        document.onmouseup = null; document.onmousemove = null; document.ontouchend = null; document.ontouchmove = null;
        setTimeout(()=>elm.setAttribute('data-dragging', 'false'), 100);
    };
    elm.onmousedown = dragStart; elm.ontouchstart = dragStart;
};

window.viewAIVersion = (index) => {
    const chat = SillyTavern.getContext().chat || [];
    const msg = chat[index];
    if (!msg) return;
    const wrapper = document.getElementById('view-target-wrapper');
    const content = document.getElementById('view-target-content');
    wrapper.style.display = 'block';
    
    let text = msg.mes;
    if (/<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
        text = `[System Content:\n${stripHtmlToText(text)}]`;
    }
    content.innerHTML = `<div class="view-area">${text.replace(/</g, '&lt;')}</div>`;
};

const createUI = () => {
    const orb = document.createElement('div'); orb.id = 'chronos-orb'; orb.innerHTML = '🌀';
    const ins = document.createElement('div'); ins.id = 'chronos-inspector';
    document.body.append(orb, ins);
    orb.onclick = () => {
        if (orb.getAttribute('data-dragging') === 'true') return;
        ins.style.display = ins.style.display === 'none' ? 'block' : 'none';
        if (ins.style.display === 'block') renderInspector();
    };
    makeDraggable(orb, 'orb'); makeDraggable(ins, 'panel');
};

// =================================================================
// 6. INIT
// =================================================================
(function() {
    injectStyles();
    setTimeout(createUI, 1500); 

    if (typeof SillyTavern !== 'undefined') {
        console.log(`[${extensionName}] Ready.`);
        // Hooks
        SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
        SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
        
        // 🔥 AUTO-UPDATE LOOP (แก้ปัญหาไม่ Realtime)
        setInterval(() => {
            if (document.getElementById('chronos-inspector')?.style.display === 'block') {
                renderInspector();
            }
        }, 2000);
    }
})();
            
