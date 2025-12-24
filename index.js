// index.js - Chronos V60 (Final Fusion) 💎🌌
// UI: Neon V47 (Strictly Preserved)
// Logic: V59 Smart Counter + Manual Input Field

const extensionName = "Chronos_V60_FinalFusion";

// =================================================================
// 1. GLOBAL STATE
// =================================================================
let userManualLimit = 0; // ค่าที่คุณกรอกเอง

const getChronosTokenizer = () => {
    try {
        const ctx = SillyTavern.getContext();
        const model = ctx?.model || ctx?.settings?.model || SillyTavern?.settings?.model;
        return model ? SillyTavern.Tokenizers.getTokenizerForModel(model) : null;
    } catch (e) { return null; }
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
// 2. HOOKS (Smart Logic)
// =================================================================
const optimizePayload = (data) => {
    const processText = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
            return `[System Content:\n${stripHtmlToText(text)}]`;
        }
        return text;
    };
    if (data.body?.messages) {
        data.body.messages.forEach(msg => msg.content = processText(msg.content));
    } else if (data.body?.prompt) {
        data.body.prompt = processText(data.body.prompt);
    }
    setTimeout(() => {
        const ins = document.getElementById('chronos-inspector');
        if (ins && ins.style.display === 'block') renderInspector();
    }, 500);
    return data;
};

// =================================================================
// 3. CALCULATOR (V59 Logic)
// =================================================================
const calculateStats = () => {
    if (typeof SillyTavern === 'undefined') return { memoryRange: "Syncing...", original: 0, optimized: 0, saved: 0, max: 0 };
    
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    const tokenizer = getChronosTokenizer();
    const quickCount = (text) => (tokenizer && typeof tokenizer.encode === 'function') ? tokenizer.encode(text).length : Math.round(text.length / 3);

    // --- A. SAVINGS ---
    let totalSavings = 0;
    chat.forEach((msg) => {
        const rawMsg = msg.mes || "";
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(rawMsg)) {
            const rawLen = quickCount(rawMsg);
            const cleanMsg = `[System Content:\n${stripHtmlToText(rawMsg)}]`;
            const optLen = quickCount(cleanMsg);
            totalSavings += Math.max(0, rawLen - optLen);
        }
    });

    // --- B. BASE LOAD (Logic "ตัวหน้า" ที่แม่นยำจาก V59) ---
    let stTotalTokens = context.tokens || 0;
    
    // Fallback: Read DOM if ST returns 0
    if (stTotalTokens === 0) {
        const tokenCounterEl = document.getElementById('token_counter') || document.querySelector('.token-counter');
        if (tokenCounterEl) {
            const text = tokenCounterEl.innerText || "";
            const parts = text.split('/');
            if (parts.length > 0) {
                const domCurrent = parseInt(parts[0].replace(/[^0-9]/g, ''));
                if (!isNaN(domCurrent) && domCurrent > 0) stTotalTokens = domCurrent;
            }
        }
    }
    // Final Fallback: Manual Count
    if (stTotalTokens === 0 && chat.length > 0) {
         let manualChat = 0;
         chat.forEach(m => manualChat += quickCount(m.mes));
         stTotalTokens = manualChat + 2000;
    }

    // --- C. MAX CONTEXT (Manual Input Priority) ---
    let maxTokens = 8192;

    if (userManualLimit > 0) {
        maxTokens = userManualLimit;
    } else {
        // Auto logic as backup
        const isUnlocked = SillyTavern.settings?.unlock_context || SillyTavern.settings?.unlocked_context;
        if (isUnlocked) {
            if (SillyTavern.settings?.context_size > 8192) maxTokens = parseInt(SillyTavern.settings.context_size);
            else maxTokens = 1000000;
        } else {
            if (SillyTavern.settings?.context_size) maxTokens = parseInt(SillyTavern.settings.context_size);
            else if (context.max_context) maxTokens = parseInt(context.max_context);
        }
        if (stTotalTokens > maxTokens) maxTokens = stTotalTokens;
    }

    const finalOptimizedLoad = Math.max(0, stTotalTokens - totalSavings);

    let memoryRangeText = "Healthy";
    const percent = maxTokens > 0 ? (finalOptimizedLoad / maxTokens) : 0;
    if (percent > 1) memoryRangeText = "Overflow";
    else if (percent > 0.9) memoryRangeText = "Critical";

    return {
        memoryRange: memoryRangeText,
        original: stTotalTokens,
        optimized: finalOptimizedLoad,
        saved: totalSavings,
        max: maxTokens,
        source: userManualLimit > 0 ? "Manual" : "Auto"
    };
};

// =================================================================
// 4. UI RENDERER (V47 Structure + Input Field)
// =================================================================
window.updateManualLimit = (val) => {
    userManualLimit = parseInt(val);
    renderInspector();
};

const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    if (!ins || ins.style.display === 'none') return;

    // Scroll Lock Logic (From V47)
    const msgListEl = ins.querySelector('.msg-list');
    const prevScrollTop = msgListEl ? msgListEl.scrollTop : 0;

    const chat = SillyTavern.getContext().chat || [];
    const stats = calculateStats();
    
    const percent = stats.max > 0 ? Math.min((stats.optimized / stats.max) * 100, 100) : 0;
    
    let listHtml = chat.slice(-5).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        const preview = (msg.mes || "").substring(0, 25).replace(/</g, '&lt;');
        const roleIcon = msg.is_user ? '👤' : '🤖';
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">
                    <span style="color:#D500F9;">#${actualIdx}</span> ${roleIcon} ${preview}...
                </div>`;
    }).join('');

    const fmt = (n) => n.toLocaleString();
    const inputValue = userManualLimit > 0 ? userManualLimit : '';
    const placeholder = stats.source === 'Auto' ? fmt(stats.max) : 'Auto';

    // HTML Structure based on V47 + Input Field
    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🚀 CHRONOS V60 (Polished)</span>
            <span style="cursor:pointer; color:#ff4081;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        
        <div class="control-zone">
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}> Move Orb</label>
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}> Move Win</label>
        </div>

        <div class="dashboard-zone">
            <div class="dash-row" style="border-bottom: 1px dashed #333; padding-bottom: 8px; margin-bottom: 8px;">
                <span style="color:#aaa;">🧠 Status</span>
                <span class="dash-val" style="color:#E040FB;">${stats.memoryRange}</span>
            </div>
            
            <div class="dash-row">
                <span style="color:#aaa;">🛡️ Tokens Saved</span>
                <span class="dash-val" style="color:#00E676;">-${fmt(stats.saved)} toks</span>
            </div>

            <div class="dash-row" style="align-items:center;">
                <span style="color:#fff;">🔋 Load (Real)</span>
                <div style="display:flex; align-items:center; gap:5px;">
                    <span class="dash-val" style="color:#fff;">${fmt(stats.optimized)} / </span>
                    <input type="number" 
                           value="${inputValue}" 
                           placeholder="${placeholder}"
                           onchange="updateManualLimit(this.value)"
                           style="width: 70px; background: #222; border: 1px solid #444; color: #fff; border-radius: 3px; font-size: 11px; padding: 2px; text-align:right;">
                </div>
            </div>

            <div class="progress-container">
                <div class="progress-bar" style="width: ${percent}%"></div>
            </div>
            
            <div style="text-align:right; font-size:9px; color:#555; margin-top:3px;">
                Src: ${stats.source}
            </div>
        </div>

        <div class="ins-body">
            <div style="display:flex; gap:5px; margin-bottom:10px;">
                <input type="number" id="chronos-search-id" placeholder="Msg ID..." style="background:#222; border:1px solid #444; color:#fff; width:60px; padding:4px; border-radius:3px;">
                <button onclick="searchById()" style="background:#D500F9; border:none; color:#000; padding:4px 10px; border-radius:3px; cursor:pointer; font-weight:bold;">INSPECT</button>
            </div>
            
            <div style="font-size:9px; color:#666; margin-bottom:4px; text-transform:uppercase;">Recent Messages</div>
            <div class="msg-list">${listHtml}</div>
            
            <div id="view-target-wrapper">
                <div id="view-target-content"></div>
            </div>
        </div>
    `;

    if (newMsgListEl) newMsgListEl.scrollTop = prevScrollTop;
};

// =================================================================
// 5. STYLES (Strictly V47 Style)
// =================================================================
let dragConfig = { orbUnlocked: false, panelUnlocked: false };

const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        /* ORB STYLES */
        #chronos-orb {
            position: fixed; top: 150px; right: 20px; width: 40px; height: 40px;
            background: radial-gradient(circle, rgba(20,0,30,0.9) 0%, rgba(0,0,0,1) 100%);
            border: 2px solid #D500F9; border-radius: 50%;
            z-index: 999999; cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 20px; color: #E040FB; 
            box-shadow: 0 0 15px rgba(213, 0, 249, 0.6), inset 0 0 10px rgba(213, 0, 249, 0.3);
            user-select: none; 
            animation: spin-slow 4s linear infinite;
            transition: transform 0.2s;
        }
        #chronos-orb:hover { transform: scale(1.1); border-color: #00E676; color: #00E676; box-shadow: 0 0 25px #00E676; }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* INSPECTOR PANEL */
        #chronos-inspector {
            position: fixed; top: 80px; right: 70px; width: 320px; 
            background: rgba(10, 10, 12, 0.95); 
            border: 1px solid #D500F9; border-top: 3px solid #D500F9;
            color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 12px;
            display: none; z-index: 999999; border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8); backdrop-filter: blur(10px);
            overflow: hidden;
        }
        .ins-header { 
            background: linear-gradient(90deg, #4A0072, #2a0040); 
            color: #fff; padding: 10px; font-weight: bold; letter-spacing: 1px; display: flex; justify-content: space-between; 
            border-bottom: 1px solid #D500F9;
        }
        .control-zone { display: flex; gap: 15px; padding: 6px 10px; background: #1a0520; color: #00E676; font-size: 11px; border-bottom: 1px solid #330044; }
        .dashboard-zone { background: #050505; padding: 15px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; align-items: center; }
        .dash-val { font-weight: bold; font-size: 13px; }
        .progress-container { width: 100%; height: 6px; background: #222; border-radius: 3px; margin-top: 8px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #D500F9, #00E676); width: 0%; transition: width 0.4s ease-out; }
        
        .ins-body { padding: 10px; background: #111; max-height: 400px; overflow-y: auto;}
        .msg-list { max-height: 120px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #0a0a0a; border-radius: 4px; }
        .msg-item { padding: 6px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #888; transition: 0.2s;}
        .msg-item:hover { background: #330044; color: #fff; padding-left: 10px;}
        
        #view-target-wrapper { margin-top:10px; border-top:1px dashed #444; padding-top:10px; display:none; animation: fade-in 0.3s; }
        .view-area { background: #080808; color: #00E676; padding: 10px; height: 140px; overflow-y: auto; border: 1px solid #333; border-radius: 4px; margin-top: 5px; white-space: pre-wrap; word-wrap: break-word; }
        .stat-badge { display: flex; justify-content: space-between; margin-top: 5px; background: #222; padding: 6px; border-radius: 4px; border: 1px solid #333; }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #D500F9; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
};

window.toggleDrag = (type, isChecked) => {
    if (type === 'orb') dragConfig.orbUnlocked = isChecked;
    if (type === 'panel') {
        dragConfig.panelUnlocked = isChecked;
        const header = document.getElementById('panel-header');
        if(header) header.style.cursor = isChecked ? 'move' : 'default';
    }
};

const makeDraggable = (elm, type) => {
    let pos1=0, pos2=0, pos3=0, pos4=0;
    const dragStart = (e) => {
        if (type === 'orb' && !dragConfig.orbUnlocked) return;
        if (type === 'panel' && !dragConfig.panelUnlocked) return;
        if (type === 'panel' && !e.target.classList.contains('ins-header') && !e.target.parentElement.classList.contains('ins-header')) return;
        
        const clientX = e.clientX || e.touches[0].clientX; 
        const clientY = e.clientY || e.touches[0].clientY;
        pos3 = clientX; pos4 = clientY;
        
        document.onmouseup = dragEnd; document.onmousemove = dragAction;
        document.ontouchend = dragEnd; document.ontouchmove = dragAction;
        elm.setAttribute('data-dragging', 'true');
    };
    const dragAction = (e) => {
        const clientX = e.clientX || e.touches[0].clientX; 
        const clientY = e.clientY || e.touches[0].clientY;
        pos1 = pos3 - clientX; pos2 = pos4 - clientY; 
        pos3 = clientX; pos4 = clientY;
        elm.style.top = (elm.offsetTop - pos2) + "px"; 
        elm.style.left = (elm.offsetLeft - pos1) + "px";
        e.preventDefault();
    };
    const dragEnd = () => {
        document.onmouseup = null; document.onmousemove = null; 
        document.ontouchend = null; document.ontouchmove = null;
        setTimeout(() => elm.setAttribute('data-dragging', 'false'), 100);
    };
    elm.onmousedown = dragStart; elm.ontouchstart = dragStart;
};

window.searchById = () => {
    const idInput = document.getElementById('chronos-search-id');
    const id = parseInt(idInput.value);
    const chat = SillyTavern.getContext().chat || [];
    if (isNaN(id) || id < 0 || id >= chat.length) { alert("Invalid ID"); return; }
    viewAIVersion(id);
};

window.viewAIVersion = (index) => {
    const chat = SillyTavern.getContext().chat || [];
    const msg = chat[index];
    if (!msg) return;

    const wrapper = document.getElementById('view-target-wrapper');
    if (wrapper) wrapper.style.display = 'block';

    const contentDiv = document.getElementById('view-target-content');
    if (!contentDiv) return;

    const tokenizer = getChronosTokenizer();
    const quickCount = (text) => (tokenizer && typeof tokenizer.encode === 'function') ? tokenizer.encode(text).length : Math.round(text.length / 2.7);

    const rawTokens = quickCount(msg.mes);
    let cleanText = stripHtmlToText(msg.mes);
    let aiViewText = msg.mes; 
    
    if (/<[^>]+>|&lt;[^&]+&gt;/.test(msg.mes)) {
        aiViewText = `[System Content:\n${cleanText}]`;
    }

    const cleanTokens = quickCount(aiViewText);
    const saved = Math.max(0, rawTokens - cleanTokens);

    contentDiv.innerHTML = `
        <div style="margin-bottom:3px; color:#D500F9; font-weight:bold; font-size:10px;">
            TARGET ID: #${index} (${msg.is_user ? 'USER' : 'AI'})
        </div>
        <div class="view-area">${aiViewText.replace(/</g, '&lt;')}</div>
        <div class="stat-badge">
            <span style="color:#aaa;">Raw: ${rawTokens}</span>
            <span style="color:#00E676;">Sent: ${cleanTokens}</span>
            <span style="color:#E040FB;">Saved: -${saved}</span>
        </div>
    `;
};

// =================================================================
// 6. INITIALIZATION
// =================================================================
(function() {
    injectStyles();
    setTimeout(createUI, 2000); 

    if (typeof SillyTavern !== 'undefined') {
        console.log(`[${extensionName}] Ready. Live Monitoring + Manual Input.`);
        
        SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
        SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);

        // 🔥 Auto-refresh loop
        setInterval(() => {
            const ins = document.getElementById('chronos-inspector');
            if (ins && ins.style.display === 'block') {
                renderInspector();
            }
        }, 2000);
    }
})();
    
