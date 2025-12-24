// index.js - Chronos V33 (The Mirror Protocol) 🪞✨

const extensionName = "Chronos_V33_Mirror";

// =================================================================
// 1. Logic: Tokenizer Wrapper (เรียกใช้ของระบบ)
// =================================================================
const getSysTokenCount = (text) => {
    if (!text) return 0;
    try {
        // พยายามเรียก Tokenizer ตัวเดียวกับที่หน้าจอ SillyTavern ใช้
        if (typeof SillyTavern !== 'undefined' && SillyTavern.Tokenizers && typeof SillyTavern.Tokenizers.encode === 'function') {
            return SillyTavern.Tokenizers.encode(text).length;
        }
        // Fallback (เผื่อหาไม่เจอ)
        if (typeof GPTTokenizer_Encoding_Encode === 'function') {
            return GPTTokenizer_Encoding_Encode(text).length;
        }
        return Math.round(text.length / 3); // กันตาย
    } catch (e) {
        return 0;
    }
};

const stripHtmlToText = (html) => {
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
// 2. Logic: The Mirror Calculator (สูตรใหม่)
// =================================================================
const calculateMirrorStats = () => {
    if (typeof SillyTavern === 'undefined') return { raw: 0, real: 0, saved: 0, max: 0 };
    
    const context = SillyTavern.getContext();
    
    // 1. ดึงค่า Raw จาก SillyTavern โดยตรง (เลขนี้ต้องตรงกับหน้าจอ 100%)
    // SillyTavern เก็บค่า token ปัจจุบันไว้ใน context.tokens หรือ context.token_count
    let systemRawTokens = context.tokens || 0; 
    
    // เผื่อบางเวอร์ชันใช้ชื่ออื่น
    if (systemRawTokens === 0 && document.getElementById('token_count_bar')) {
        // ดึงจากหน้าจอ UI โดยตรงเลยถ้าหาตัวแปรไม่เจอ
        const text = document.getElementById('token_count_bar').innerText;
        const match = text.match(/(\d+)/);
        if (match) systemRawTokens = parseInt(match[1]);
    }

    // 2. คำนวณส่วนต่าง (Savings)
    // เราจะวนลูปดูว่า ใน Chat History มี HTML ให้ตัดเท่าไหร่
    const chat = context.chat || [];
    let totalSavedTokens = 0;
    let latestMsgSaved = 0;

    chat.forEach((msg, index) => {
        const originalContent = msg.mes;
        
        // ถ้ามี HTML
        if (originalContent.includes('<') && originalContent.includes('>')) {
            // 1. นับแบบมี HTML (Raw)
            const rawCount = getSysTokenCount(originalContent);
            
            // 2. นับแบบตัดแล้ว (Clean)
            const cleanText = stripHtmlToText(originalContent);
            const finalContent = `[System Content:\n${cleanText}]`; // Format ที่เราจะส่ง
            const cleanCount = getSysTokenCount(finalContent);
            
            // 3. หาผลต่าง
            const diff = rawCount - cleanCount;
            
            if (diff > 0) {
                totalSavedTokens += diff;
                // เช็คว่าเป็นข้อความล่าสุดไหม
                if (index === chat.length - 1) {
                    latestMsgSaved = diff;
                }
            }
        }
    });

    // 3. สรุปยอด
    const realTokens = systemRawTokens - totalSavedTokens;

    return {
        raw: systemRawTokens,     // ยอดดิบ (จากระบบ)
        real: realTokens,         // ยอดจริง (หลังหักลบ)
        saved: totalSavedTokens,  // ประหยัดไปได้
        latest: latestMsgSaved,   // ล่าสุด
        max: context.max_context || 8192
    };
};

// =================================================================
// UI
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 150px; right: 20px; width: 35px; height: 35px;
            background: rgba(10, 0, 15, 0.9); border: 2px solid #D500F9; border-radius: 50%;
            z-index: 999999; cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 18px; color: #E040FB; box-shadow: 0 0 15px rgba(213, 0, 249, 0.6);
            user-select: none; animation: spin-slow 4s linear infinite;
        }
        #chronos-orb:hover { border-color: #00E676; color: #00E676; box-shadow: 0 0 25px #00E676; }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        #chronos-inspector {
            position: fixed; top: 80px; right: 70px; width: 320px; 
            background: rgba(15, 0, 20, 0.98); border: 2px solid #D500F9;
            color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 11px;
            display: none; z-index: 999999; border-radius: 12px;
            box-shadow: 0 10px 50px #000; backdrop-filter: blur(5px);
        }
        .ins-header { background: linear-gradient(90deg, #330044, #5c007a); color: #fff; padding: 8px 10px; font-weight: bold; border-bottom: 1px solid #D500F9; display: flex; justify-content: space-between; }
        .control-zone { display: flex; gap: 10px; padding: 5px 10px; background: #220033; border-bottom: 1px solid #550077; font-size: 10px; color: #00E676; }
        
        .dashboard-zone { background: #000; padding: 10px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .sub-row { display: flex; justify-content: space-between; margin-bottom: 2px; padding-left: 10px; color: #777; font-size: 10px; }
        
        .ins-body { padding: 10px; }
        .search-row { display: flex; gap: 5px; margin-bottom: 10px; }
        .search-input { background: #222; border: 1px solid #D500F9; color: #fff; padding: 3px; width: 50px; border-radius: 3px; }
        .search-btn { background: #D500F9; color: #000; border: none; padding: 3px 8px; cursor: pointer; border-radius: 3px; font-weight:bold;}
        .msg-list { max-height: 100px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #111; }
        .msg-item { padding: 5px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #aaa; }
        .msg-item:hover { background: #330044; color: #fff; }
        .view-area { background: #000; color: #00E676; padding: 8px; height: 120px; overflow-y: auto; font-size: 10px; white-space: pre-wrap; border: 1px solid #5c007a; border-radius: 4px; }
        .stat-badge { display: flex; justify-content: space-between; margin-top: 5px; background: #222; padding: 5px; border-radius: 4px; }
    `;
    document.head.appendChild(style);
};

let dragConfig = { orbUnlocked: false, panelUnlocked: false };

const createUI = () => {
    const old = document.getElementById('chronos-orb'); if (old) old.remove();
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

const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    const chat = SillyTavern.getContext().chat || [];
    const stats = calculateMirrorStats();

    let listHtml = chat.slice(-5).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        const preview = msg.mes.substring(0, 20).replace(/</g, '&lt;');
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">#${actualIdx} ${msg.is_user ? '👤' : '🤖'} ${preview}...</div>`;
    }).join('');

    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🪞 MIRROR PROTOCOL V33</span>
            <span style="cursor:pointer;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        
        <div class="control-zone">
            <label style="display:flex;gap:5px;cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}>🔓Orb</label>
            <label style="display:flex;gap:5px;cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}>🔓Win</label>
        </div>

        <div class="dashboard-zone">
            <div class="dash-row" style="border-bottom:1px solid #333; padding-bottom:5px; margin-bottom:5px;">
                <span style="color:#FF9800;">🟠 Raw (System):</span>
                <b style="color:#FF9800;">${stats.raw} Tok</b>
            </div>
            
            <div class="sub-row">
                <span>🛡️ Total Saved:</span>
                <span style="color:#E040FB;">-${stats.saved}</span>
            </div>
            
            <div class="dash-row" style="margin-top:10px; border-top:1px solid #555; padding-top:5px;">
                <span style="color:#00E676;">🟢 Real (To Send):</span>
                <b style="color:#00E676;">${stats.real} / ${stats.max}</b>
            </div>
            <div style="font-size:9px; color:#555; text-align:right;">
                (Mirror Mode: 100% Sync with UI)
            </div>
        </div>

        <div class="ins-body">
            <button onclick="renderInspector()" style="width:100%; margin-bottom:10px; background:#333; color:#fff; border:none; padding:5px; cursor:pointer;">🔄 Refresh Stats</button>
            <div class="search-row">
                <span>ID:</span> <input type="number" id="chronos-search-id" class="search-input">
                <button class="search-btn" onclick="searchById()">Check</button>
            </div>
            <div class="msg-list">${listHtml}</div>
            <div id="view-target"></div>
        </div>
    `;
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
        const clientX = e.clientX || e.touches[0].clientX; const clientY = e.clientY || e.touches[0].clientY;
        pos3 = clientX; pos4 = clientY;
        document.onmouseup = dragEnd; document.onmousemove = dragAction;
        document.ontouchend = dragEnd; document.ontouchmove = dragAction;
        elm.setAttribute('data-dragging', 'true');
    };
    const dragAction = (e) => {
        const clientX = e.clientX || e.touches[0].clientX; const clientY = e.clientY || e.touches[0].clientY;
        pos1 = pos3 - clientX; pos2 = pos4 - clientY; pos3 = clientX; pos4 = clientY;
        elm.style.top = (elm.offsetTop - pos2) + "px"; elm.style.left = (elm.offsetLeft - pos1) + "px";
        e.preventDefault();
    };
    const dragEnd = () => {
        document.onmouseup = null; document.onmousemove = null; document.ontouchend = null; document.ontouchmove = null;
        setTimeout(() => elm.setAttribute('data-dragging', 'false'), 100);
    };
    elm.onmousedown = dragStart; elm.ontouchstart = dragStart;
};

window.searchById = () => {
    const id = parseInt(document.getElementById('chronos-search-id').value);
    const chat = SillyTavern.getContext().chat || [];
    if (isNaN(id) || id < 0 || id >= chat.length) { alert("Invalid ID"); return; }
    viewAIVersion(id);
};

window.viewAIVersion = (index) => {
    const chat = SillyTavern.getContext().chat;
    const msg = chat[index].mes;
    const rawTokens = getSysTokenCount(msg.mes); // ใช้ System Tokenizer
    const cleanText = stripHtmlToText(msg.mes);
    const aiViewText = `[System Content:\n${cleanText}]`;
    const cleanTokens = getSysTokenCount(aiViewText); // ใช้ System Tokenizer
    const saved = rawTokens - cleanTokens;

    document.getElementById('view-target').innerHTML = `
        <div style="margin-bottom:3px; color:#D500F9;">ID: #${index}</div>
        <div class="view-area">${aiViewText}</div>
        <div class="stat-badge">
            <span>Raw: <b>${rawTokens}</b></span>
            <span style="color:#00E676;">Real: <b>${cleanTokens}</b></span>
            <span style="color:#E040FB;">Save: <b>${saved > 0 ? saved : 0}</b></span>
        </div>
    `;
};

const optimizePayload = (data) => {
    const process = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) return `[System Content:\n${stripHtmlToText(text)}]`;
        return text;
    };
    if (data.body && data.body.messages) data.body.messages.forEach(msg => msg.content = process(msg.content));
    else if (data.body && data.body.prompt) data.body.prompt = process(data.body.prompt);
    return data;
};

injectStyles();
setTimeout(createUI, 1500);
if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    }

