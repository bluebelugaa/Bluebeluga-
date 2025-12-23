// index.js - Chronos V9 (Portable & Draggable) 🟣🌪️

const extensionName = "Chronos_V9_Draggable";

let stats = {
    enabled: true,
    totalSaved: 0
};

// =================================================================
// 1. Logic: Universal Stripper (เครื่องโม่แป้ง HTML)
// =================================================================
const stripHtmlToText = (html) => {
    let text = html.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/p>/gi, '\n\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/h[1-6]>/gi, '\n');
    text = text.replace(/<[^>]+>/g, ''); // ลบ HTML Tags ทั้งหมด
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    return text;
};

const estimateTokens = (chars) => Math.round(chars / 3.5);

// =================================================================
// 2. UI: ลูกแก้วสีม่วง (เล็กลง + ลากได้)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; 
            top: 100px; right: 20px; /* ตำแหน่งเริ่มต้น */
            width: 45px; height: 45px; /* เล็กลง */
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #D500F9;
            border-radius: 50%;
            z-index: 999999; 
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; color: #E040FB;
            box-shadow: 0 0 10px rgba(213, 0, 249, 0.5);
            backdrop-filter: blur(4px);
            touch-action: none; /* ห้ามเลื่อนหน้าจอตอนลากปุ่ม */
            user-select: none;
            cursor: grab;
        }
        #chronos-orb:active { cursor: grabbing; border-color: #fff; }
        
        /* Effect ตัวเลขเด้ง */
        .token-popup {
            position: fixed;
            color: #00E676; font-weight: bold; font-size: 14px;
            pointer-events: none; z-index: 1000000;
            text-shadow: 0 1px 2px black;
            animation: floatUp 1.5s ease-out forwards;
        }
        @keyframes floatUp {
            0% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(-50px); opacity: 0; }
        }

        #chronos-panel {
            position: fixed; top: 150px; right: 80px;
            width: 250px; padding: 10px;
            background: #121212; border: 1px solid #D500F9;
            color: #eee; font-family: monospace; font-size: 10px;
            display: none; z-index: 999998;
            box-shadow: 0 5px 20px #000;
        }
    `;
    document.head.appendChild(style);
};

const createUI = () => {
    const old = document.getElementById('chronos-orb');
    if (old) old.remove();

    const orb = document.createElement('div');
    orb.id = 'chronos-orb';
    orb.innerHTML = '🌀';
    
    const panel = document.createElement('div');
    panel.id = 'chronos-panel';
    
    document.body.appendChild(orb);
    document.body.appendChild(panel);

    // ทำให้ลากได้
    makeDraggable(orb);

    // คลิกเพื่อเปิดเมนู (ต้องเช็คว่าไม่ได้ลากอยู่)
    orb.onclick = (e) => {
        if (orb.getAttribute('data-dragging') === 'true') return;
        panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
        renderPanel(panel);
    };
};

const makeDraggable = (elm) => {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let isDragging = false;

    const dragMouseDown = (e) => {
        e.preventDefault();
        // รองรับทั้งเมาส์และนิ้วสัมผัส
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;

        pos3 = clientX;
        pos4 = clientY;
        isDragging = false;
        elm.setAttribute('data-dragging', 'false');

        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        document.ontouchend = closeDragElement;
        document.ontouchmove = elementDrag;
    };

    const elementDrag = (e) => {
        isDragging = true;
        elm.setAttribute('data-dragging', 'true');
        
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;

        pos1 = pos3 - clientX;
        pos2 = pos4 - clientY;
        pos3 = clientX;
        pos4 = clientY;

        elm.style.top = (elm.offsetTop - pos2) + "px";
        elm.style.left = (elm.offsetLeft - pos1) + "px";
        
        // ย้าย panel ตามไปด้วย (ให้อยู่ใกล้ๆ กัน)
        const panel = document.getElementById('chronos-panel');
        if (panel) {
            panel.style.top = (elm.offsetTop + 50) + "px";
            panel.style.left = (elm.offsetLeft - 200) + "px"; // ให้เมนูออกทางซ้าย
        }
    };

    const closeDragElement = () => {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
        
        // หน่วงเวลาเล็กน้อยเพื่อให้ onclick รู้ว่าพึ่งจบการลาก
        setTimeout(() => {
            elm.setAttribute('data-dragging', 'false');
        }, 100);
    };

    elm.onmousedown = dragMouseDown;
    elm.ontouchstart = dragMouseDown;
};

const renderPanel = (panel) => {
    panel.innerHTML = `
        <strong style="color:#D500F9;">CHRONOS V9</strong><br>
        Saved Tokens: <b style="color:#00E676;">${stats.totalSaved}</b><br>
        <div style="font-size:9px; color:#777; margin-top:5px;">
            (ลากลูกแก้วเพื่อย้ายตำแหน่ง)
        </div>
    `;
};

// ฟังก์ชันแสดงตัวเลขเด้ง (Visual Feedback)
const showFloatingNumber = (amount, x, y) => {
    const el = document.createElement('div');
    el.className = 'token-popup';
    el.innerHTML = `+${amount} Tok`;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500); // ลบทิ้งเมื่ออนิเมชั่นจบ
};

// =================================================================
// 3. Logic: ตัดจริง (Execution)
// =================================================================
const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    let charsSaved = 0;

    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            if (msg.content && /<[^>]+>/.test(msg.content)) {
                const oldLen = msg.content.length;
                
                // ล้างบาง HTML
                const cleanText = stripHtmlToText(msg.content);
                msg.content = `[System Content: ${cleanText.substring(0, 20)}...]` + cleanText; // เก็บ text ไว้

                const newLen = msg.content.length;
                charsSaved += (oldLen - newLen);
            }
        });
    }

    if (charsSaved > 0) {
        const tokens = estimateTokens(charsSaved);
        stats.totalSaved += tokens;
        
        // แสดงตัวเลขเด้งที่ลูกแก้ว
        const orb = document.getElementById('chronos-orb');
        if (orb) {
            const rect = orb.getBoundingClientRect();
            showFloatingNumber(tokens, rect.left, rect.top - 20);
        }
        console.log(`[Chronos V9] Saved ~${tokens} tokens.`);
    }

    return data;
};

// =================================================================
// 4. Start
// =================================================================
injectStyles();
setTimeout(createUI, 1000);

if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    console.log('[Chronos V9] Draggable Loaded.');
}

