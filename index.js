// index.js - Chronos V23 (Psycho Drifter) 🌀🟣🖐️

const extensionName = "Chronos_V23_Drifter";

// =================================================================
// 1. Logic: Stripper & Token Count
// =================================================================
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

const estimateTokens = (chars) => Math.round(chars / 3.5);

// =================================================================
// 2. UI: Psycho Neon Style (Draggable)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        /* --- ลูกแก้วพายุหมุน --- */
        #chronos-orb {
            position: fixed; top: 150px; right: 20px;
            width: 35px; height: 35px;
            background: rgba(10, 0, 15, 0.9);
            border: 2px solid #D500F9; border-radius: 50%;
            z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 18px; color: #E040FB;
            box-shadow: 0 0 15px rgba(213, 0, 249, 0.6);
            user-select: none; touch-action: none; /* กันเลื่อนจอ */
            animation: spin-slow 4s linear infinite; /* หมุนตลอดเวลา */
            transition: transform 0.2s, box-shadow 0.3s;
        }
        
        /* Effect ตอนเอาเมาส์ชี้ หรือ กดค้าง */
        #chronos-orb:hover, #chronos-orb:active {
            border-color: #00E676; color: #00E676;
            box-shadow: 0 0 25px #00E676;
        }

        @keyframes spin-slow { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
        }

        /* --- หน้าต่าง Inspector (ลากได้) --- */
        #chronos-inspector {
            position: fixed; top: 100px; right: 70px;
            width: 300px; 
            background: rgba(15, 0, 20, 0.95);
            border: 2px solid #D500F9;
            color: #E1BEE7; font-family: 'Courier New', monospace; font-size: 11px;
            display: none; z-index: 999999; border-radius: 12px;
            box-shadow: 0 10px 50px #000; overflow: hidden;
            backdrop-filter: blur(5px);
        }

        /* ส่วนหัว (ใช้จับลาก) */
        .ins-header { 
            background: linear-gradient(90deg, #330044, #5c007a); 
            color: #fff; padding: 8px 10px; font-weight: bold; 
            border-bottom: 1px solid #D500F9;
            display: flex; justify-content: space-between; align-items: center;
            cursor: default; /* เปลี่ยนเป็น move ถ้าติ๊กถูก */
        }

        /* โซนปุ่มควบคุมการย้าย */
        .control-zone {
            display: flex; gap: 10px; padding: 8px; background: #220033;
            border-bottom: 1px solid #550077;
            font-size: 10px; color: #00E676;
        }
        .control-checkbox { cursor: pointer; display: flex; align-items: center; gap: 5px; }
        
        /* ช่องค้นหา & List */
        .ins-body { padding: 10px; max-height: 70vh; overflow-y: auto; }
        
        .search-row { display: flex; gap: 5px; margin-bottom: 10px; }
        .search-input { background: #000; border: 1px solid #D500F9; color: #fff; padding: 4px; width: 60px; border-radius: 4px; }
        .search-btn { background: #D500F9; color: #000; border: none; padding: 4px 10px; cursor: pointer; font-weight: bold; border-radius: 4px; }
        
        .msg-list { max-height: 120px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #111; }
        .msg-item { padding: 6px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #aaa; }
        .msg-item:hover { background: #330044; color: #fff; }

        .view-area { background: #000; color: #00E676; padding: 10px; height: 150px; overflow-y: auto; font-size: 10px; white-space: pre-wrap; border: 1px solid #5c007a; border-radius: 4px; }
    `;
    document.head.appendChild(style);
};

// ตัวแปรเก็บสถานะการลาก
let dragConfig = {
    orbUnlocked: false,
    panelUnlocked: false
};

const createUI = () => {
    const old = document.getElementById('chronos-orb');
    if (old) old.remove();
    const oldPanel = document.getElementById('chronos-inspector');
    if (oldPanel) oldPanel.remove();

    const orb = document.createElement('div');
    orb.id = 'chronos-orb';
    orb.innerHTML = '🌀'; // สัญลักษณ์พายุ
    
    const ins = document.createElement('div');
    ins.id = 'chronos-inspector';
    
    document.body.appendChild(orb);
    document.body.appendChild(ins);

    // คลิกเพื่อเปิด/ปิด (ถ้าไม่ได้ลาก)
    orb.onclick = (e) => {
        if (orb.getAttribute('data-dragging') === 'true') return;
        ins.style.display = (ins.style.display === 'none') ? 'block' : 'none';
        if (ins.style.display === 'block') renderInspector();
    };

    // ติดตั้งระบบลาก
    makeDraggable(orb, 'orb');
    makeDraggable(ins, 'panel');
};

const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    const chat = SillyTavern.getContext().chat || [];
    
    // รายการข้อความล่าสุด
    let listHtml = chat.slice(-10).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        const preview = msg.mes.substring(0, 25).replace(/</g, '&lt;');
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">#${actualIdx} ${msg.is_user ? '👤' : '🤖'} ${preview}...</div>`;
    }).join('');

    // HTML ของหน้าต่าง (รวมปุ่มติ๊กถูก)
    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🌀 PSYCHO INSPECTOR</span>
            <span style="cursor:pointer;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        
        <div class="control-zone">
            <label class="control-checkbox">
                <input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}> 
                🔓 ย้ายลูกแก้ว
            </label>
            <label class="control-checkbox">
                <input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}> 
                🔓 ย้ายหน้าต่าง
            </label>
        </div>

        <div class="ins-body">
            <div class="search-row">
                <input type="number" id="chronos-search-id" class="search-input" placeholder="ID">
                <button class="search-btn" onclick="searchById()">ส่อง</button>
            </div>

            <div class="msg-list">${listHtml}</div>
            <div id="view-target">
                <div style="color:#555; text-align:center; margin-top:40px;">- เลือกข้อความเพื่อตรวจสอบ -</div>
            </div>
        </div>
    `;
};

// ฟังก์ชันเปิด/ปิดโหมดลาก
window.toggleDrag = (type, isChecked) => {
    if (type === 'orb') dragConfig.orbUnlocked = isChecked;
    if (type === 'panel') {
        dragConfig.panelUnlocked = isChecked;
        const header = document.getElementById('panel-header');
        if(header) header.style.cursor = isChecked ? 'move' : 'default';
    }
};

// ฟังก์ชันลากขั้นเทพ (รองรับ Touch & Mouse)
const makeDraggable = (elm, type) => {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    const dragStart = (e) => {
        // เช็คก่อนว่าอนุญาตให้ลากไหม
        if (type === 'orb' && !dragConfig.orbUnlocked) return;
        if (type === 'panel' && !dragConfig.panelUnlocked) return;

        // ถ้าเป็น Panel ต้องลากที่ Header เท่านั้น
        if (type === 'panel' && !e.target.classList.contains('ins-header') && !e.target.parentElement.classList.contains('ins-header')) return;

        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        
        pos3 = clientX;
        pos4 = clientY;
        
        document.onmouseup = dragEnd;
        document.onmousemove = dragAction;
        document.ontouchend = dragEnd;
        document.ontouchmove = dragAction;

        elm.setAttribute('data-dragging', 'true'); // บอกว่ากำลังลากนะ
    };

    const dragAction = (e) => {
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;

        pos1 = pos3 - clientX;
        pos2 = pos4 - clientY;
        pos3 = clientX;
        pos4 = clientY;

        elm.style.top = (elm.offsetTop - pos2) + "px";
        elm.style.left = (elm.offsetLeft - pos1) + "px";
        
        // ป้องกันการเลือก Text ตอนลาก
        e.preventDefault(); 
    };

    const dragEnd = () => {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
        
        // ดีเลย์นิดนึงก่อนปลดสถานะ (เพื่อกันไม่ให้มันนับเป็น Click)
        setTimeout(() => {
            elm.setAttribute('data-dragging', 'false');
        }, 100);
    };

    elm.onmousedown = dragStart;
    elm.ontouchstart = dragStart;
};

// --- Logic การส่อง (เหมือนเดิม) ---
window.searchById = () => {
    const idInput = document.getElementById('chronos-search-id');
    const id = parseInt(idInput.value);
    const chat = SillyTavern.getContext().chat || [];
    if (isNaN(id) || id < 0 || id >= chat.length) { alert("ไม่พบข้อความ ID นี้"); return; }
    viewAIVersion(id);
};

window.viewAIVersion = (index) => {
    const chat = SillyTavern.getContext().chat;
    const msg = chat[index].mes;
    const rawTokens = estimateTokens(msg.length);

    const cleanText = stripHtmlToText(msg);
    const aiViewText = `[System Content:\n${cleanText}]`;
    const cleanTokens = estimateTokens(aiViewText.length);
    const saved = rawTokens - cleanTokens;

    const target = document.getElementById('view-target');
    target.innerHTML = `
        <div style="margin-bottom:3px; color:#D500F9;">ข้อความ ID: #${index}</div>
        <div class="view-area">${aiViewText}</div>
        <div style="display:flex; justify-content:space-between; margin-top:5px; background:#222; padding:5px; border-radius:4px;">
            <span>เดิม: <b>${rawTokens}</b></span>
            <span style="color:#00E676;">ตัดแล้ว: <b>${cleanTokens}</b></span>
            <span style="color:#E040FB;">ประหยัด: <b>${saved > 0 ? saved : 0}</b></span>
        </div>
    `;
};

// =================================================================
// 3. Execution (ตัดจริงตอนส่ง)
// =================================================================
const optimizePayload = (data) => {
    const process = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
            return `[System Content:\n${stripHtmlToText(text)}]`;
        }
        return text;
    };
    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => msg.content = process(msg.content));
    } else if (data.body && data.body.prompt) {
        data.body.prompt = process(data.body.prompt);
    }
    return data;
};

// =================================================================
// 4. Start
// =================================================================
injectStyles();
setTimeout(createUI, 1500);

if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
}

