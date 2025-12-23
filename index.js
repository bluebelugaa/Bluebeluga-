// index.js - Chronos V12 (Dual Stat Popup) 🟣⚡

const extensionName = "Chronos_V12_DualStats";

let stats = {
    enabled: true,
    totalSaved: 0,
    lastSaved: 0
};

// =================================================================
// 1. Logic: Universal Stripper (เครื่องโม่แป้ง HTML)
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
// 2. UI: Psycho Neon Orb (Size 30px)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 120px; right: 20px;
            
            /* ขนาด 30px (ใหญ่กว่า Mini +5px) */
            width: 30px; height: 30px;
            
            /* ธีมสีม่วงนีออน */
            background: rgba(10, 0, 10, 0.9);
            border: 2px solid #D500F9;
            border-radius: 50%;
            
            z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            
            /* ไอคอน */
            font-size: 16px; 
            color: #E040FB;
            
            box-shadow: 0 0 10px rgba(213, 0, 249, 0.6);
            transition: all 0.3s;
            user-select: none;
            backdrop-filter: blur(4px);
        }

        #chronos-orb:hover { 
            transform: scale(1.15); 
            box-shadow: 0 0 20px #D500F9;
            border-color: #fff;
        }

        #chronos-orb.working { 
            background: #D500F9; color: #000;
            animation: pulse-neon 0.8s infinite;
        }
        
        @keyframes pulse-neon { 
            0% { box-shadow: 0 0 5px #D500F9; } 
            50% { box-shadow: 0 0 20px #E040FB; transform: scale(1.1); } 
            100% { box-shadow: 0 0 5px #D500F9; } 
        }

        /* --- Panel เมนู (กดดูได้) --- */
        #chronos-panel {
            position: fixed; top: 120px; right: 60px;
            width: 260px; padding: 12px;
            background: #120018; /* ดำอมม่วง */
            border: 1px solid #D500F9;
            color: #E1BEE7;
            font-family: monospace; font-size: 11px;
            display: none; z-index: 999999;
            box-shadow: 0 5px 20px rgba(0,0,0,0.8);
            border-radius: 6px;
        }
        .preview-box {
            background: #2a0033; border: 1px solid #5c007a; color: #D500F9;
            padding: 8px; margin-top: 5px; max-height: 150px; overflow: auto;
            white-space: pre-wrap; font-size: 10px;
        }
        
        /* --- Popup แจ้งเตือน (ป้าย 2 บรรทัด) --- */
        .token-popup {
            position: fixed;
            background: rgba(18, 0, 24, 0.95); /* พื้นหลังดำม่วง */
            border: 1px solid #D500F9;
            padding: 8px 12px;
            border-radius: 8px;
            pointer-events: none; z-index: 1000000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5);
            
            /* Animation ลอยขึ้น */
            animation: floatUp 3s ease-out forwards;
            
            display: flex; flex-direction: column; align-items: flex-start;
        }
        
        .popup-row-latest {
            color: #00E676; /* สีเขียว (ยอดล่าสุด) */
            font-weight: bold; font-size: 14px;
            text-shadow: 0 1px 2px black;
        }
        
        .popup-row-total {
            color: #E1BEE7; /* สีม่วงอ่อน (ยอดรวม) */
            font-size: 10px;
            margin-top: 2px;
            border-top: 1px solid rgba(213, 0, 249, 0.3);
            padding-top: 2px; width: 100%;
        }

        @keyframes floatUp {
            0% { transform: translateY(0); opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translateY(-60px); opacity: 0; }
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

    orb.onclick = () => {
        panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
        renderPanel(panel);
    };

    document.body.appendChild(orb);
    document.body.appendChild(panel);
};

const renderPanel = (panel) => {
    panel.innerHTML = `
        <strong style="color:#E040FB;">CHRONOS V12</strong><br>
        <div style="margin-top:5px; border-bottom:1px solid #5c007a; padding-bottom:5px;">
            ล่าสุด: <b style="color:#fff;">+${stats.lastSaved}</b> Tok<br>
            รวมทั้งหมด: <b style="color:#00E676;">${stats.totalSaved}</b> Tok
        </div>
        <button onclick="checkLatestConversion()" style="width:100%; padding:5px; background:#330044; color:#E040FB; border:1px solid #D500F9; margin-top:10px; cursor:pointer;">
            🔍 Preview (AI View)
        </button>
        <div id="preview-area" class="preview-box">...</div>
    `;
};

// ฟังก์ชันแสดงตัวเลขเด้ง (แบบ 2 บรรทัด)
const showFloatingNumber = (amount, total, x, y) => {
    const el = document.createElement('div');
    el.className = 'token-popup';
    
    // สร้าง HTML 2 บรรทัด
    el.innerHTML = `
        <div class="popup-row-latest">⚡ +${amount} Tokens</div>
        <div class="popup-row-total">📦 รวมสะสม: ${total}</div>
    `;
    
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    
    // ลบทิ้งเมื่ออนิเมชั่นจบ (3 วินาที)
    setTimeout(() => el.remove(), 3000);
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
// 3. Logic: Execution
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
                msg.content = `[Display Content:\n${cleanText}]`;

                const newLen = msg.content.length;
                charsSaved += (oldLen - newLen);
            }
        });
    }

    if (charsSaved > 0) {
        const tokens = estimateTokens(charsSaved);
        stats.lastSaved = tokens;
        stats.totalSaved += tokens;
        
        // สั่งให้เด้งแจ้งเตือนทั้ง 2 ยอด
        if (orb) {
            const rect = orb.getBoundingClientRect();
            // ให้เด้งออกทางซ้ายของลูกแก้ว (จะได้ไม่ตกขอบขวา)
            showFloatingNumber(tokens, stats.totalSaved, rect.left - 100, rect.top - 20);
        }
        console.log(`[Chronos] Saved +${tokens} | Total: ${stats.totalSaved}`);
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
    console.log('[Chronos V12] Dual Stats Loaded.');
}

