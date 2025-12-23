// index.js - Chronos V8 (Ruined City Edition - Mini) 🏙️🌫️

const extensionName = "Chronos_Ruins_Mini";

let stats = {
    enabled: true,
    totalSaved: 0,
    status: "Ready"
};

// =================================================================
// 1. Logic: The Universal Stripper (เครื่องโม่แป้ง HTML - คงเดิม)
// =================================================================
const stripHtmlToText = (html) => {
    let text = html.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/p>/gi, '\n\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/h[1-6]>/gi, '\n');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    return text;
};

const estimateTokens = (chars) => Math.round(chars / 3.5);

// =================================================================
// 2. UI: ลูกแก้วธีมเมืองร้าง (จิ๋วลง 3 เท่า)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 120px; right: 20px;
            /* ย่อขนาดลงประมาณ 3 เท่า (จาก 60px -> 22px) */
            width: 22px; height: 22px;
            
            /* ธีมเมืองร้างสีเทา */
            background: #2b2b2b; /* พื้นหลังสีเทาเข้มเกือบดำ */
            border: 1px solid #757575; /* ขอบสีเทาด้าน */
            border-radius: 4px; /* เหลี่ยมมนๆ เหมือนตึก */
            
            z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            
            /* ไอคอน */
            font-size: 12px; 
            color: #b0b0b0; /* สีควันบุหรี่ */
            
            box-shadow: 0 2px 5px rgba(0,0,0,0.8);
            transition: all 0.3s;
            user-select: none;
            opacity: 0.7; /* จางๆ ให้กลืนไปกับฉาก */
        }

        /* ตอนเอาเมาส์ชี้ */
        #chronos-orb:hover { 
            transform: scale(1.1); 
            opacity: 1; 
            border-color: #fff;
            box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
        }

        /* ตอนทำงาน (Working) - กระพริบสีขาวหม่นๆ */
        #chronos-orb.working { 
            background: #424242; 
            color: #fff;
            animation: pulse-gray 1s infinite;
        }
        
        @keyframes pulse-gray { 
            0% { box-shadow: 0 0 0 rgba(100,100,100,0); } 
            50% { box-shadow: 0 0 10px rgba(150,150,150,0.5); } 
            100% { box-shadow: 0 0 0 rgba(100,100,100,0); } 
        }

        #chronos-panel {
            position: fixed; top: 120px; right: 50px; /* ขยับตำแหน่งให้ตรงปุ่มเล็ก */
            width: 250px; padding: 10px;
            background: #1a1a1a; 
            border: 1px solid #555; /* กรอบสีเทา */
            color: #ccc; /* ตัวหนังสือสีเทาอ่อน */
            font-family: monospace; font-size: 10px;
            display: none; z-index: 999999;
            box-shadow: 0 5px 20px #000;
            max-height: 80vh; overflow-y: auto;
        }
        .preview-box {
            background: #000; border: 1px solid #333; color: #aaa;
            padding: 8px; margin-top: 5px; max-height: 150px; overflow: auto;
            white-space: pre-wrap; font-size: 9px;
        }
        
        /* Effect ตัวเลขเด้งแบบดาร์กๆ */
        .token-popup {
            position: fixed;
            color: #bdbdbd; /* สีเทาสว่าง */
            font-weight: bold; font-size: 10px;
            pointer-events: none; z-index: 1000000;
            text-shadow: 0 1px 2px black;
            animation: floatUp 2s ease-out forwards;
        }
        @keyframes floatUp {
            0% { transform: translateY(0); opacity: 0.8; }
            100% { transform: translateY(-30px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
};

const createUI = () => {
    const old = document.getElementById('chronos-orb');
    if (old) old.remove();

    const orb = document.createElement('div');
    orb.id = 'chronos-orb';
    
    // ไอคอนเมือง (Cityscape) แต่เราปรับสีใน CSS ให้ดูเป็นเมืองร้าง
    orb.innerHTML = '🏙️'; 
    
    const panel = document.createElement('div');
    panel.id = 'chronos-panel';

    orb.onclick = () => {
        panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
        renderPanel(panel);
    };

    document.body.appendChild(orb);
    document.body.appendChild(panel);
};

const renderPanel = (panel) => {
    panel.innerHTML = `
        <strong style="color:#bdbdbd;">CHRONOS RUINS</strong><br>
        Saved: <b style="color:#fff;">${stats.totalSaved}</b> Tok<br>
        -----------------------------<br>
        <button onclick="checkLatestConversion()" style="width:100%; padding:4px; background:#333; color:#ccc; border:1px solid #555; cursor:pointer; font-size: 10px;">
            🔍 Preview Text
        </button>
        <div style="margin-top:5px; color:#777;">AI sees:</div>
        <div id="preview-area" class="preview-box">...</div>
    `;
};

// ฟังก์ชันแสดงตัวเลขเด้ง
const showFloatingNumber = (amount, x, y) => {
    const el = document.createElement('div');
    el.className = 'token-popup';
    el.innerHTML = `+${amount}`;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
};

window.checkLatestConversion = () => {
    if (typeof SillyTavern === 'undefined') return;
    const context = SillyTavern.getContext();
    const chat = context.chat || [];
    let lastMsg = "";
    for (let i = chat.length - 1; i >= 0; i--) {
        if (!chat[i].is_user) { lastMsg = chat[i].mes; break; }
    }
    if (!lastMsg) {
        document.getElementById('preview-area').innerText = "No bot message";
        return;
    }
    if (lastMsg.includes('<') && lastMsg.includes('>')) {
        const cleanText = stripHtmlToText(lastMsg);
        document.getElementById('preview-area').innerText = cleanText;
    } else {
        document.getElementById('preview-area').innerText = "(No HTML)";
    }
};

// =================================================================
// 3. Logic: ตัดจริงตอนส่ง (Execution - คงเดิม)
// =================================================================
const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    const orb = document.getElementById('chronos-orb');
    if (orb) orb.classList.add('working');

    let charsSaved = 0;

    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            if (msg.content && /<[^>]+>/.test(msg.content)) {
                
                const oldLen = msg.content.length;
                const cleanText = stripHtmlToText(msg.content);
                msg.content = `[System/Display Content:\n${cleanText}]`;

                const newLen = msg.content.length;
                charsSaved += (oldLen - newLen);
            }
        });
    }

    if (charsSaved > 0) {
        const tokens = estimateTokens(charsSaved);
        stats.totalSaved += tokens;
        
        // เด้งตัวเลข
        if (orb) {
            const rect = orb.getBoundingClientRect();
            showFloatingNumber(tokens, rect.left, rect.top - 20);
        }
        console.log(`[Chronos] Saved ~${tokens} tokens.`);
    }

    setTimeout(() => {
        if (orb) orb.classList.remove('working');
        const panel = document.getElementById('chronos-panel');
        if(panel && panel.style.display === 'block') renderPanel(panel);
    }, 1000);

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
    console.log('[Chronos] Ruined City Loaded.');
}

