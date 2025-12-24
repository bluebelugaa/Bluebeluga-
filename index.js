// index.js - Chronos V34 (The Memory Master) 🧠🛡️

const extensionName = "Chronos_V34_MemoryMaster";

// =================================================================
// 1. Logic: Tokenizer Wrapper (เรียกใช้ของระบบ SillyTavern)
// =================================================================
const getSysTokenCount = (text) => {
    if (!text) return 0;
    try {
        // เรียกใช้ Tokenizer ตัวเดียวกับหน้าจอแชท
        if (typeof SillyTavern !== 'undefined' && SillyTavern.Tokenizers && typeof SillyTavern.Tokenizers.encode === 'function') {
            return SillyTavern.Tokenizers.encode(text).length;
        }
        // Fallback
        if (typeof GPTTokenizer_Encoding_Encode === 'function') {
            return GPTTokenizer_Encoding_Encode(text).length;
        }
        return Math.round(text.length / 3); 
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
// 2. Logic: Calculator (Memory & Savings)
// =================================================================
const calculateStats = () => {
    if (typeof SillyTavern === 'undefined') return { memory: 0, totalMsgs: 0, saved: 0, usage: 0, max: 0 };
    
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    const maxTokens = context.max_context || 8192;
    
    // 1. หา Base Token (ของที่ลบไม่ได้) โดยการหักลบ
    // เราเริ่มจากยอดรวมดิบ (Raw) ที่ระบบบอก
    let systemRawTotal = context.tokens || 0;
    if (systemRawTotal === 0 && document.getElementById('token_count_bar')) {
        const text = document.getElementById('token_count_bar').innerText;
        const match = text.match(/(\d+)/);
        if (match) systemRawTotal = parseInt(match[1]);
    }

    // 2. คำนวณส่วนต่าง (Savings) และ Real Usage
    let totalSaved = 0;
    let chatRealTokens = []; // เก็บขนาดจริงของแต่ละข้อความไว้คำนวณ Memory

    chat.forEach(msg => {
        const rawLen = getSysTokenCount(msg.mes) + 5; // +5 metadata
        
        let cleanContent = msg.mes;
        if (cleanContent.includes('<') && cleanContent.includes('>')) {
            const clean = stripHtmlToText(cleanContent);
            cleanContent = `[System Content:\n${clean}]`;
        }
        const realLen = getSysTokenCount(cleanContent) + 5;
        
        const diff = Math.max(0, rawLen - realLen);
        totalSaved += diff;
        
        chatRealTokens.push(realLen);
    });

    const realUsage = systemRawTotal - totalSaved;

    // 3. คำนวณ Memory Depth (จำได้กี่ข้อความ)
    // ประมาณการ Base Token = RealUsage - ผลรวมของ Chat จริง
    const totalChatReal = chatRealTokens.reduce((a, b) => a + b, 0);
    const estimatedBase = Math.max(0, realUsage - totalChatReal);

    let currentLoad = estimatedBase;
    let rememberedCount = 0;

    // วนลูปจาก "ล่าสุด" ย้อนกลับไป "อดีต"
    for (let i = chatRealTokens.length - 1; i >= 0; i--) {
        if (currentLoad + chatRealTokens[i] < maxTokens) {
            currentLoad += chatRealTokens[i];
            rememberedCount++;
        } else {
            break; // เต็มแล้ว จำข้อความเก่ากว่านี้ไม่ได้
        }
    }

    return {
        memory: rememberedCount,
        totalMsgs: chat.length,
        saved: totalSaved,
        usage: realUsage,
        max: maxTokens
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
            position: fixed; top: 80px; right: 70px; width: 300px; 
            background: rgba(15, 0, 20, 0.98); border: 2px solid #D500F9;
            color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 11px;
            display: none; z-index: 999999; border-radius: 12px;
            box-shadow: 0 10px 50px #000; backdrop-filter: blur(5px);
        }
        .ins-header { background: linear-gradient(90deg, #330044, #5c007a); color: #fff; padding: 8px 10px; font-weight: bold; border-bottom: 1px solid #D500F9; display: flex; justify-content: space-between; }
        .control-zone { display: flex; gap: 10px; padding: 5px 10px; background: #220033; border-bottom: 1px solid #550077; font-size: 10px; color: #00E676; }
        
        .dashboard-zone { background: #000; padding: 10px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; }
        
        .ins-body { padding: 10px; }
        .search-row { display: flex; gap: 5px; margin-bottom: 10px; }
        .search-input { background: #222; border: 1px solid #D500F9; color: #fff; padding: 3px; width: 50px; border-radius: 3px; }
        .search-btn { background: #D500F9; color: #000; border: none; padding: 3px 8px; cursor: pointer; border-radius: 3px; font-weight:bold;}
        
        .msg-list { max-height: 100px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #111; }
        .msg-item { padding: 5px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #aaa; }
        .msg-item:hover { background: #330044; color: #fff; }
        
        /* กล่องส่องข้อความที่หายไป กลับมาแล้ว */
        #view-target { margin-top: 10px; border-top: 1px solid #333; padding-top: 10px; }
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
    const stats = calculateStats();

    let listHtml = chat.slice(-5).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        const preview = msg.mes.substring(0, 20).replace(/</g, '&lt;');
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">#${actualIdx} ${msg.is_user ? '👤' : '🤖'} ${preview}...</div>`;
    }).join('');

    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🧠 MEMORY MASTER V34</span>
            <span style="cursor:pointer;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        
        <div class="control-zone">
            <label style="display:flex;gap:5px;cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}>🔓Orb</label>
            <label style="display:flex;gap:5px;cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}>🔓Win</label>
        </div>

        <div class="dashboard-zone">
            <div class="dash-row">
                <span style="color:#aaa;">🧠 จำได้ (Memory):</span>
                <b style="color:#E040FB;">${stats.memory} / ${stats.totalMsgs} ข้อความ</b>
            </div>
            
            <div class="dash-row">
                <span style="color:#aaa;">🛡️ ประหยัดรวม (Saved):</span>
                <b style="color:#00E676;">-${stats.saved} Tokens</b>
            </div>

            <div class="dash-row" style="margin-top:8px; font-size:10px; color:#555;">
                <span>Usage: ${stats.usage} / ${stats.max}</span>
            </div>
        </div>

        <div class="ins-body">
            <div class="search-row">
                <span>ID:</span> <input type="number" id="chronos-search-id" class="search-input">
                <button class="search-btn" onclick="searchById()">Check</button>
            </div>
            
            <div style="font-size:9px; color:#aaa; margin-bottom:3px;">ล่าสุด 5 ข้อความ:</div>
            <div class="msg-list">${listHtml}</div>
            
            <div id="view-target">
                <div style="color:#555; text-align:center; padding:20px; border:1px dashed #333; margin-top:5px;">
                    คลิกข้อความด้านบน<br>เพื่อดูรายละเอียด
                </div>
            </div>
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
    
    // ใช้ Tokenizer ของระบบ นับแบบเป๊ะๆ
    const rawTokens = getSysTokenCount(msg.mes); 
    
    const cleanText = stripHtmlToText(msg.mes);
    const aiViewText = `[System Content:\n${cleanText}]`;
    const cleanTokens = getSysTokenCount(aiViewText); 
    
    const saved = rawTokens - cleanTokens;

    document.getElementById('view-target').innerHTML = `
        <div style="margin-bottom:3px; color:#D500F9;">ข้อความ ID: #${index}</div>
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

