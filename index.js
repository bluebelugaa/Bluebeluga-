// index.js - Chronos V13 (The Decoder - Fix Zero Token) 🟣🔓

const extensionName = "Chronos_V13_Decoder";

let stats = {
    enabled: true,
    totalSaved: 0,
    lastSaved: 0
};

// =================================================================
// 1. Logic: The Universal Stripper (ฉบับแก้รหัสลับ)
// =================================================================
const stripHtmlToText = (rawHtml) => {
    // ขั้นแรก: แปลงรหัสลับ &lt; เป็น < ให้หมดก่อน (สำคัญมาก!)
    let text = rawHtml.replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    // จากนั้นค่อยลบ HTML Tag ตามปกติ
    text = text.replace(/<br\s*\/?>/gi, '\n')
               .replace(/<\/p>/gi, '\n\n')
               .replace(/<\/div>/gi, '\n')
               .replace(/<\/h[1-6]>/gi, '\n');
    
    // ลบ Tag ที่เหลือทั้งหมด
    text = text.replace(/<[^>]+>/g, '');
    
    // จัดระเบียบ
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    return text;
};

const estimateTokens = (chars) => Math.round(chars / 3.5);

// =================================================================
// 2. UI: Psycho Neon Orb (Size 30px & Dual Stats)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 120px; right: 20px;
            width: 30px; height: 30px;
            background: rgba(10, 0, 10, 0.9);
            border: 2px solid #D500F9;
            border-radius: 50%;
            z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; color: #E040FB;
            box-shadow: 0 0 10px rgba(213, 0, 249, 0.6);
            transition: all 0.3s;
            user-select: none;
            backdrop-filter: blur(4px);
        }
        #chronos-orb:hover { 
            transform: scale(1.15); 
            box-shadow: 0 0 20px #D500F9; border-color: #fff;
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

        /* Popup 2 บรรทัด */
        .token-popup {
            position: fixed;
            background: rgba(18, 0, 24, 0.95);
            border: 1px solid #D500F9;
            padding: 8px 12px; border-radius: 8px;
            pointer-events: none; z-index: 1000000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5);
            animation: floatUp 3s ease-out forwards;
            display: flex; flex-direction: column; align-items: flex-start;
        }
        .popup-row-latest { color: #00E676; font-weight: bold; font-size: 14px; text-shadow: 0 1px 2px black; }
        .popup-row-total { color: #E1BEE7; font-size: 10px; margin-top: 2px; border-top: 1px solid rgba(213, 0, 249, 0.3); padding-top: 2px; width: 100%; }
        @keyframes floatUp {
            0% { transform: translateY(0); opacity: 1; }
            100% { transform: translateY(-60px); opacity: 0; }
        }

        #chronos-panel {
            position: fixed; top: 120px; right: 60px;
            width: 260px; padding: 12px;
            background: #120018; border: 1px solid #D500F9;
            color: #E1BEE7; font-family: monospace; font-size: 11px;
            display: none; z-index: 999999;
            border-radius: 6px;
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
        panel.innerHTML = `
            <strong style="color:#E040FB;">CHRONOS V13</strong><br>
            ล่าสุด: <b style="color:#00E676;">+${stats.lastSaved}</b> Tok<br>
            รวม: <b style="color:#E040FB;">${stats.totalSaved}</b> Tok
        `;
    };

    document.body.appendChild(orb);
    document.body.appendChild(panel);
};

const showFloatingNumber = (amount, total, x, y) => {
    const el = document.createElement('div');
    el.className = 'token-popup';
    el.innerHTML = `
        <div class="popup-row-latest">⚡ +${amount} Tokens</div>
        <div class="popup-row-total">📦 รวมสะสม: ${total}</div>
    `;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
};

// =================================================================
// 3. Logic: Execution (แก้เงื่อนไขการจับโค้ด)
// =================================================================
const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    const orb = document.getElementById('chronos-orb');
    if (orb) orb.classList.add('working');

    let charsSaved = 0;

    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            // เช็คทั้ง <...> และ &lt;...&gt; (จับหมดทุกรูปแบบ)
            if (msg.content && (/<[^>]+>/.test(msg.content) || /&lt;[^&]+&gt;/.test(msg.content))) {
                
                const oldLen = msg.content.length;
                
                // ใช้ฟังก์ชันถอดรหัสและล้างโค้ด
                const cleanText = stripHtmlToText(msg.content);
                
                // ใส่ Placeholder แทน
                msg.content = `[System Content: ${cleanText.substring(0, 20)}...]\n${cleanText}`;

                const newLen = msg.content.length;
                charsSaved += (oldLen - newLen);
            }
        });
    }

    if (charsSaved > 0) {
        const tokens = estimateTokens(charsSaved);
        stats.lastSaved = tokens;
        stats.totalSaved += tokens;
        
        if (orb) {
            const rect = orb.getBoundingClientRect();
            showFloatingNumber(tokens, stats.totalSaved, rect.left - 100, rect.top - 20);
        }
        console.log(`[Chronos] Saved +${tokens}`);
    } else {
        // Debug: ถ้าเป็น 0 ให้แจ้งเตือนใน Console ว่าทำไม (เฉพาะคนเขียนโค้ดเห็น)
        console.log("[Chronos] No HTML detected in this request.");
    }

    setTimeout(() => {
        if (orb) orb.classList.remove('working');
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
    console.log('[Chronos V13] Decoder Loaded.');
}

