// index.js - Chronos V35 (System Sync & Fix View) 🔗🛠️

const extensionName = "Chronos_V35_SystemSync";

// เราเก็บ config ไว้เผื่อ fallback แต่หลักๆ จะใช้ของระบบ
let config = {
    fallbackThaiDivisor: 1.3,
    fallbackEngDivisor: 3.5
};

// =================================================================
// 1. Logic: Tokenizer (เรียกใช้ของ SillyTavern โดยตรง)
// =================================================================
const getSysTokenCount = (text) => {
    if (!text) return 0;
    try {
        // 1. พยายามเรียก Tokenizer ของ SillyTavern
        if (typeof SillyTavern !== 'undefined' && SillyTavern.Tokenizers && typeof SillyTavern.Tokenizers.encode === 'function') {
            return SillyTavern.Tokenizers.encode(text).length;
        }
        // 2. Fallback ทั่วไป
        if (typeof GPTTokenizer_Encoding_Encode === 'function') {
            return GPTTokenizer_Encoding_Encode(text).length;
        }
        
        // 3. ถ้าหาไม่เจอจริงๆ ค่อยใช้สูตรหาร (กันตาย)
        const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
        const otherChars = text.length - thaiChars;
        return Math.round(thaiChars / config.fallbackThaiDivisor) + Math.round(otherChars / config.fallbackEngDivisor);

    } catch (e) {
        console.error("Tokenizer Error:", e);
        return 0;
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
// 2. Logic: Calculator (ดึงค่าจาก Context ระบบ)
// =================================================================
const calculateSystemStats = () => {
    if (typeof SillyTavern === 'undefined') return { used: 0, max: 0, saved: 0 };
    
    const context = SillyTavern.getContext();
    
    // 1. ดึง Max Context จากการตั้งค่า SillyTavern โดยตรง
    const maxTokens = context.max_context || 2048; // ถ้าหาไม่เจอใช้ค่า default ต่ำๆ
    
    // 2. ดึง Current Tokens ที่ SillyTavern นับไว้แล้ว (รวมทุกอย่าง)
    let currentUsed = context.tokens || 0;
    
    // ถ้าหาใน context ไม่เจอ ให้พยายามดึงจาก UI Bar
    if (currentUsed === 0 && document.getElementById('token_count_bar')) {
        const text = document.getElementById('token_count_bar').innerText;
        const match = text.match(/(\d+)/);
        if (match) currentUsed = parseInt(match[1]);
    }

    // 3. คำนวณยอดที่ Extension ช่วยประหยัด (Saved)
    // โดยการวนลูปเช็คว่า HTML หายไปกี่ Token
    let totalSaved = 0;
    const chat = context.chat || [];

    chat.forEach(msg => {
        if (msg.mes && msg.mes.includes('<') && msg.mes.includes('>')) {
            const rawCount = getSysTokenCount(msg.mes);
            
            const cleanText = stripHtmlToText(msg.mes);
            const finalContent = `[System Content:\n${cleanText}]`;
            const realCount = getSysTokenCount(finalContent);
            
            const diff = Math.max(0, rawCount - realCount);
            totalSaved += diff;
        }
    });

    return {
        used: currentUsed,  // ยอดที่ Silly เห็น (Raw)
        real: currentUsed - totalSaved, // ยอดจริงที่จะส่ง (Real)
        max: maxTokens,     // ขีดจำกัดที่ตั้งไว้
        saved: totalSaved   // ยอดที่ประหยัดได้
    };
};

// =================================================================
// 3. UI System
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
        .progress-bg { width: 100%; height: 6px; background: #333; border-radius: 3px; overflow: hidden; margin-top: 5px; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #00E676, #00C853); width: 0%; transition: width 0.5s; }

        .ins-body { padding: 10px; }
        .search-row { display: flex; gap: 5px; margin-bottom: 10px; }
        .search-input { background: #222; border: 1px solid #D500F9; color: #fff; padding: 3px; width: 50px; border-radius: 3px; }
        .search-btn { background: #D500F9; color: #000; border: none; padding: 3px 8px; cursor: pointer; border-radius: 3px; font-weight:bold;}
        
        .msg-list { max-height: 100px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #111; }
        .msg-item { padding: 5px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #aaa; }
        .msg-item:hover { background: #330044; color: #fff; }
        
        /* แก้ไข CSS ส่วน View ให้แสดงผลชัดเจน */
        #view-target-wrapper { margin-top:10px; border-top:1px solid #333; padding-top:10px; display:none; }
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
    const stats = calculateSystemStats();
    
    const percent = stats.max > 0 ? Math.min((stats.real / stats.max) * 100, 100) : 0;

    // สร้างลิสต์ข้อความ (แก้ไข onclick ให้ส่ง index ที่ถูกต้อง)
    let listHtml = chat.slice(-5).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        // Escape HTML tags ใน preview เพื่อไม่ให้พัง
        const preview = (msg.mes || "").substring(0, 20).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">#${actualIdx} ${msg.is_user ? '👤' : '🤖'} ${preview}...</div>`;
    }).join('');

    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🔗 SYSTEM SYNC V35</span>
            <span style="cursor:pointer;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        
        <div class="control-zone">
            <label style="display:flex;gap:5px;cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}>🔓Orb</label>
            <label style="display:flex;gap:5px;cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}>🔓Win</label>
        </div>

        <div class="dashboard-zone">
            <div class="dash-row">
                <span style="color:#aaa;">Context (Setting):</span>
                <span style="color:#E040FB;">${stats.max} Tok</span>
            </div>
            
            <div class="dash-row">
                <span style="color:#FF9800;">🟠 Silly Sees:</span>
                <b style="color:#FF9800;">${stats.used}</b>
            </div>
            
            <div class="dash-row">
                <span style="color:#00E676;">🟢 Real Send:</span>
                <b style="color:#00E676;">${stats.real}</b>
            </div>
            <div style="font-size:9px; color:#777; text-align:right;">(Saved: ${stats.saved})</div>

            <div class="progress-bg">
                <div class="progress-fill" style="width: ${percent}%"></div>
            </div>
        </div>

        <div class="ins-body">
            <div class="search-row">
                <span>ID:</span> <input type="number" id="chronos-search-id" class="search-input">
                <button class="search-btn" onclick="searchById()">Check</button>
            </div>
            
            <div style="font-size:9px; color:#aaa; margin-bottom:2px;">Last 5 Messages:</div>
            <div class="msg-list">${listHtml}</div>
            
            <div id="view-target-wrapper">
                <div id="view-target-content"></div>
            </div>
        </div>
    `;
};

// ฟังก์ชันลาก (คงเดิม)
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

// =================================================================
// 4. View Logic (แก้ไขใหม่ให้ทำงานได้แน่นอน)
// =================================================================
window.searchById = () => {
    const idInput = document.getElementById('chronos-search-id');
    const id = parseInt(idInput.value);
    const chat = SillyTavern.getContext().chat || [];
    if (isNaN(id) || id < 0 || id >= chat.length) { alert("Invalid ID"); return; }
    viewAIVersion(id);
};

window.viewAIVersion = (index) => {
    // ต้องดึง Context ใหม่ทุกครั้ง เพื่อให้ได้ข้อมูลล่าสุด
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    const msg = chat[index];

    if (!msg) {
        alert("ไม่พบข้อความ");
        return;
    }

    // เปิด wrapper
    const wrapper = document.getElementById('view-target-wrapper');
    if (wrapper) wrapper.style.display = 'block';

    const contentDiv = document.getElementById('view-target-content');
    if (!contentDiv) return;

    // คำนวณสด
    const rawTokens = getSysTokenCount(msg.mes);
    
    const cleanText = stripHtmlToText(msg.mes);
    const aiViewText = `[System Content:\n${cleanText}]`;
    const cleanTokens = getSysTokenCount(aiViewText);
    const saved = rawTokens - cleanTokens;

    contentDiv.innerHTML = `
        <div style="margin-bottom:3px; color:#D500F9;">ID: #${index}</div>
        <div class="view-area">${aiViewText}</div>
        <div class="stat-badge">
            <span>Raw: <b>${rawTokens}</b></span>
            <span style="color:#00E676;">Real: <b>${cleanTokens}</b></span>
            <span style="color:#E040FB;">Save: <b>${saved > 0 ? saved : 0}</b></span>
        </div>
    `;
};

// =================================================================
// 5. Execution Hook (ตัวตัดจริง)
// =================================================================
const optimizePayload = (data) => {
    const process = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) return `[System Content:\n${stripHtmlToText(text)}]`;
        return text;
    };
    if (data.body && data.body.messages) data.body.messages.forEach(msg => msg.content = process(msg.content));
    else if (data.body && data.body.prompt) data.body.prompt = process(data.body.prompt);
    
    // อัปเดตหน้าจอ Inspector (ถ้าเปิดอยู่) หลังส่งข้อความ
    setTimeout(() => {
        const ins = document.getElementById('chronos-inspector');
        if (ins && ins.style.display === 'block') renderInspector();
    }, 1000);
    
    return data;
};

injectStyles();
setTimeout(createUI, 1500);
if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
                                                    }

