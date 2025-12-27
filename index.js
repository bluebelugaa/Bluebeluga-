// index.js - Chronos V67 (Save & Range Edition) 🌌
// Update Log:
// - Memory Status -> Total Tokens Saved (Accumulated)
// - Load Display -> Context Range (Start Index -> Latest Index)
// - Chat Clean -> Total Message Count

const extensionName = "Chronos_V67_SaveRange";

// =================================================================
// 1. GLOBAL STATE
// =================================================================
let userManualLimit = 0; 
let dragConfig = { orbUnlocked: false, panelUnlocked: false };

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
// 3. CALCULATOR (New Logic)
// =================================================================
const calculateStats = () => {
    if (typeof SillyTavern === 'undefined') return { savedTokens: 0, contextRange: "Wait...", totalMsgs: 0, percent: 0 };
    
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    const tokenizer = getChronosTokenizer();
    // Helper function for counting tokens
    const quickCount = (text) => (tokenizer && typeof tokenizer.encode === 'function') ? tokenizer.encode(text).length : Math.round(text.length / 3);

    // --- A. CALCULATE TOTAL SAVED TOKENS ---
    let totalSaved = 0;
    chat.forEach((msg) => {
        const rawMsg = msg.mes || "";
        const rawTokens = quickCount(rawMsg);
        
        // ถ้ามี HTML ให้เทียบกับแบบ Clean
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(rawMsg)) {
            const cleanMsg = `[System Content:\n${stripHtmlToText(rawMsg)}]`;
            const cleanTokens = quickCount(cleanMsg);
            if (rawTokens > cleanTokens) {
                totalSaved += (rawTokens - cleanTokens);
            }
        }
    });

    // --- B. CALCULATE CONTEXT RANGE (Start -> End) ---
    // หายอด Max Context ที่แท้จริง
    let maxTokens = 8192;
    if (userManualLimit > 0) {
        maxTokens = userManualLimit;
    } else {
        const isUnlocked = SillyTavern.settings?.unlock_context || SillyTavern.settings?.unlocked_context;
        if (isUnlocked && SillyTavern.settings?.context_size > 8192) {
            maxTokens = parseInt(SillyTavern.settings.context_size);
        } else if (context.max_context) {
            maxTokens = parseInt(context.max_context);
        }
    }

    // หายอด System Overhead (Persona + World Info etc) โดยประมาณ
    // เราจะวนลูปย้อนหลังจากข้อความล่าสุด เพื่อดูว่าใส่ข้อความได้กี่อันจนกว่าจะเต็ม Max
    let currentUsage = 0;
    // ประมาณการ System Base (ถ้าดึงไม่ได้ให้ตีเป็น 0 ไปก่อน แล้วนับแค่ Chat)
    // ปกติ context.tokens คือยอดรวมทั้งหมด ถ้าเราอยากรู้ว่าเริ่มจำตรงไหน ให้วนลูปย้อนกลับ
    
    let endIndex = chat.length - 1;
    let startIndex = 0;
    let accumulatedTokens = 0;
    
    // สมมติว่า System Prompt กินที่ไปประมาณนึง (ถ้าคำนวณเป๊ะไม่ได้ ให้เผื่อไว้)
    // แต่เพื่อความแม่นยำในมุมมอง User: นับย้อนหลังจนกว่า Token รวมจะเกิน Max
    
    // เราต้องใช้ "System Overhead" ที่ ST จองไว้ก่อน
    // วิธีที่ง่ายที่สุด: ใช้ (context.tokens - token_chat_รวม) เป็น base แต่ถ้า context.tokens ยังไม่อัปเดตอาจเพี้ยน
    // ดังนั้นใช้วิธีนับย้อนหลังเพียวๆ เทียบกับ Max Limit เลย
    
    // *เทคนิค*: เราจะหาว่า System Tokens อื่นๆ กินไปเท่าไหร่ โดยเอา (Total Usage - Chat Usage ทั้งหมดที่อยู่ใน context)
    // แต่อันนี้ซับซ้อนไปสำหรับ Client Script เล็กๆ -> ใช้วิธีวนลูปนับ Token ข้อความย้อนหลังจนเต็ม Max ดีที่สุด
    
    // ดึง Padding ของ System (World Info + Persona)
    // เนื่องจากเราเข้าถึง internal prompt ไม่ได้ ให้ assume ว่า user อยากรู้ว่า "แชท" จำได้กี่ข้อความ
    // โดยหักลบ current total usage ออกจาก chat tokens ไม่ได้ง่ายๆ
    // -> ใช้วิธีดูว่า Total Usage ตอนนี้ เต็ม Limit หรือยัง?
    
    const totalCurrentLoad = context.tokens || 0;
    const isFull = totalCurrentLoad >= maxTokens; 

    if (!isFull) {
        // ถ้ายังไม่เต็ม แสดงว่าจำได้ตั้งแต่ข้อความแรก (หรือตามที่ User ลบไป)
        startIndex = 0; 
    } else {
        // ถ้าเต็มแล้ว ต้องหาจุดตัด
        // วนลูปจากล่างขึ้นบน
        let tempSum = 0;
        // เผื่อที่ให้ System Prompt ประมาณ 1000 tokens หรือคำนวณจาก (Total - ChatTokens)
        // เพื่อความชัวร์ ให้เริ่มนับย้อนหลัง
        for (let i = chat.length - 1; i >= 0; i--) {
            let msgContent = chat[i].mes;
            // คำนวณแบบ Clean เพราะ Chronos ส่งแบบ Clean ไป
            if (/<[^>]+>/.test(msgContent)) {
                msgContent = `[System Content:\n${stripHtmlToText(msgContent)}]`;
            }
            const tks = quickCount(msgContent);
            
            if ((accumulatedTokens + tks) > maxTokens) {
                startIndex = i + 1; // ข้อความก่อนหน้านี้คือจุดที่เกิน
                break;
            }
            accumulatedTokens += tks;
            startIndex = i; // ยังใส่ได้อยู่
        }
    }
    
    const contextRange = (chat.length === 0) ? "No Chat" : `#${startIndex} ➔ #${endIndex}`;
    const percent = maxTokens > 0 ? (totalCurrentLoad / maxTokens) : 0;

    return {
        savedTokens: totalSaved,
        contextRange: contextRange,
        totalMsgs: chat.length,
        percent: Math.min(percent * 100, 100),
        rawLoad: totalCurrentLoad,
        maxLoad: maxTokens
    };
};

// =================================================================
// 4. UI RENDERER (Updated Display)
// =================================================================
window.updateManualLimit = (val) => {
    userManualLimit = parseInt(val);
    renderInspector();
};

const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    if (!ins || ins.style.display === 'none') return;

    const msgListEl = ins.querySelector('.msg-list');
    const prevScrollTop = msgListEl ? msgListEl.scrollTop : 0;

    const chat = SillyTavern.getContext().chat || [];
    const stats = calculateStats();
    
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
    const placeholder = fmt(stats.maxLoad);

    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🚀 CHRONOS V67 (Save & Range)</span>
            <span style="cursor:pointer; color:#ff4081;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        
        <div class="control-zone">
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}> Move Orb</label>
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}> Move Win</label>
        </div>

        <div class="dashboard-zone">
            <div class="dash-row" style="border-bottom: 1px dashed #333; padding-bottom: 8px; margin-bottom: 8px;">
                <span style="color:#aaa;">💸 Tokens Saved</span>
                <span class="dash-val" style="color:#00E676;">${fmt(stats.savedTokens)} Tks</span>
            </div>

            <div class="dash-row" style="align-items:center;">
                <span style="color:#fff;">👁️ Context Range</span>
                <div style="display:flex; align-items:center; gap:5px;">
                    <span class="dash-val" style="color:#E040FB;">${stats.contextRange}</span>
                    <input type="number" 
                           value="${inputValue}" 
                           placeholder="Max"
                           onchange="updateManualLimit(this.value)"
                           title="Manual Max Context Limit"
                           style="width: 50px; background: #222; border: 1px solid #444; color: #888; border-radius: 3px; font-size: 9px; padding: 2px; text-align:center;">
                </div>
            </div>

            <div class="progress-container">
                <div class="progress-bar" style="width: ${stats.percent}%"></div>
            </div>
            
            <div style="text-align:right; font-size:9px; color:#aaa; margin-top:3px;">
                Total Msgs: <span style="color:#fff;">${fmt(stats.totalMsgs)}</span>
            </div>
        </div>

        <div class="ins-body">
            <div style="display:flex; gap:5px; margin-bottom:10px;">
                <input type="number" id="chronos-search-id" placeholder="ID..." style="background:#222; border:1px solid #444; color:#fff; width:60px; padding:4px; border-radius:3px;">
                <button onclick="searchById()" style="background:#D500F9; border:none; color:#000; padding:4px 10px; border-radius:3px; cursor:pointer; font-weight:bold;">INSPECT</button>
            </div>
            
            <div style="font-size:9px; color:#666; margin-bottom:4px; text-transform:uppercase;">Recent Messages</div>
            <div class="msg-list">${listHtml}</div>
            
            <div id="view-target-wrapper">
                <div id="view-target-content"></div>
            </div>
        </div>
    `;

    if (msgListEl) msgListEl.scrollTop = prevScrollTop;
};

// =================================================================
// 5. STYLES (Neon V47 - Strictly Preserved)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 150px; right: 20px; width: 40px; height: 40px;
            background: radial-gradient(circle, rgba(20,0,30,0.9) 0%, rgba(0,0,0,1) 100%);
            border: 2px solid #D500F9; border-radius: 50%;
            z-index: 2147483647; 
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 20px; color: #E040FB; 
            box-shadow: 0 0 15px rgba(213, 0, 249, 0.6), inset 0 0 10px rgba(213, 0, 249, 0.3);
            user-select: none; 
            animation: spin-slow 4s linear infinite;
            transition: transform 0.2s;
        }
        #chronos-orb:hover { transform: scale(1.1); border-color: #00E676; color: #00E676; box-shadow: 0 0 25px #00E676; }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        #chronos-inspector {
            position: fixed; top: 80px; right: 70px; width: 320px; 
            background: rgba(10, 10, 12, 0.95); 
            border: 1px solid #D500F9; border-top: 3px solid #D500F9;
            color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 12px;
            display: none; 
            z-index: 2147483647;
            border-radius: 8px;
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
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #D500F9; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
};

// =================================================================
// 6. UTILS
// =================================================================
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
    const context = SillyTavern.getContext(); 
    const chat = context.chat || [];
    const msg = chat[index];
    if (!msg) return;
    const wrapper = document.getElementById('view-target-wrapper');
    if (wrapper) wrapper.style.display = 'block';
    const contentDiv = document.getElementById('view-target-content');
    if (!contentDiv) return;
    
    let cleanText = stripHtmlToText(msg.mes);
    let aiViewText = msg.mes; 
    if (/<[^>]+>|&lt;[^&]+&gt;/.test(msg.mes)) {
        aiViewText = `[System Content:\n${cleanText}]`;
    }
    contentDiv.innerHTML = `<div class="view-area">${aiViewText.replace(/</g, '&lt;')}</div>`;
};

// =================================================================
// 7. INITIALIZATION
// =================================================================
const createUI = () => {
    const oldOrb = document.getElementById('chronos-orb'); if (oldOrb) oldOrb.remove();
    const oldPanel = document.getElementById('chronos-inspector'); if (oldPanel) oldPanel.remove();
    const orb = document.createElement('div'); orb.id = 'chronos-orb'; orb.innerHTML = '🌀';
    const ins = document.createElement('div'); ins.id = 'chronos-inspector';
    document.body.appendChild(orb); document.body.appendChild(ins);
    orb.onclick = (e) => {
        if (orb.getAttribute('data-dragging') === 'true') return;
        ins.style.display = (ins.style.display === 'none') ? 'block' : 'none';
        if (ins.style.display === 'block') renderInspector();
    };
    makeDraggable(orb, 'orb'); makeDraggable(ins, 'panel');
};

(function() {
    injectStyles();
    setTimeout(createUI, 2000); 
    if (typeof SillyTavern !== 'undefined') {
        SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
        SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
        setInterval(() => {
            const ins = document.getElementById('chronos-inspector');
            if (ins && ins.style.display === 'block') renderInspector();
        }, 2000);
    }
})();
        
