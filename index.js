// index.js - Chronos Edition 🔮

const extensionName = "Chronos_TimeSaver";

// ตัวแปรเก็บสถิติ
let stats = {
    enabled: true,
    lastSavedTokens: 0,
    lastSavedChars: 0,
    totalSavedTokens: 0,
    lastMessageTimestamp: "Ready"
};

// =================================================================
// 🎨 ส่วนดีไซน์: สร้างลูกแก้ว Chronos (CSS Art)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        /* อนิเมชั่นหายใจ (Breathing) */
        @keyframes chronos-pulse {
            0% { box-shadow: 0 0 10px rgba(0, 191, 255, 0.4); transform: scale(1); }
            50% { box-shadow: 0 0 25px rgba(0, 191, 255, 0.8), 0 0 10px rgba(0, 255, 255, 0.6) inset; transform: scale(1.05); }
            100% { box-shadow: 0 0 10px rgba(0, 191, 255, 0.4); transform: scale(1); }
        }

        /* อนิเมชั่นตอนทำงาน (Active) */
        @keyframes chronos-flash {
            0% { background: linear-gradient(135deg, #00C853, #69F0AE); }
            100% { background: linear-gradient(135deg, #0288D1, #26C6DA); }
        }

        /* ดีไซน์ลูกแก้ว */
        #chronos-orb {
            position: fixed;
            top: 15vh; /* สูงจากด้านบน 15% ของหน้าจอ (มุมขวาบน) */
            right: 20px;
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #0288D1, #26C6DA); /* สีฟ้าครามไล่ระดับ */
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.3);
            cursor: pointer;
            z-index: 2147483647; /* อยู่บนสุดเสมอ */
            animation: chronos-pulse 3s infinite ease-in-out; /* ใส่ Effect หายใจ */
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            backdrop-filter: blur(5px);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            user-select: none;
        }

        #chronos-orb:hover {
            transform: rotate(15deg) scale(1.1);
        }

        /* หน้าต่างข้อมูล (Glassmorphism HUD) */
        #chronos-hud {
            position: fixed;
            top: 15vh;
            right: 80px; /* อยู่ซ้ายของลูกแก้ว */
            width: 220px;
            padding: 15px;
            background: rgba(16, 26, 38, 0.85); /* สีน้ำเงินเข้มโปร่งแสง */
            backdrop-filter: blur(10px); /* กระจกฝ้า */
            border: 1px solid rgba(0, 191, 255, 0.3);
            border-radius: 12px;
            color: #E0F7FA;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 13px;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            z-index: 2147483647;
            display: none;
            opacity: 0;
            transform: translateX(20px);
            transition: opacity 0.3s, transform 0.3s;
        }

        #chronos-hud.visible {
            display: block;
            opacity: 1;
            transform: translateX(0);
        }

        .hud-label { color: #81D4FA; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
        .hud-value { font-size: 1.2em; font-weight: bold; color: #FFFFFF; text-shadow: 0 0 5px rgba(0, 191, 255, 0.5); }
    `;
    document.head.appendChild(style);
};

// =================================================================
// 🖥️ ส่วนสร้าง UI
// =================================================================
const createChronosUI = () => {
    // ลบของเก่าถ้ามี
    const oldOrb = document.getElementById('chronos-orb');
    if (oldOrb) oldOrb.remove();
    const oldHud = document.getElementById('chronos-hud');
    if (oldHud) oldHud.remove();

    // 1. สร้างลูกแก้ว
    const orb = document.createElement('div');
    orb.id = 'chronos-orb';
    orb.innerHTML = '⏳'; // ไอคอนนาฬิกาทรายข้างใน
    
    // 2. สร้าง HUD (หน้าต่างข้อมูล)
    const hud = document.createElement('div');
    hud.id = 'chronos-hud';
    
    // ฟังก์ชันกดเปิด/ปิด
    orb.onclick = () => {
        if (hud.classList.contains('visible')) {
            hud.classList.remove('visible');
            setTimeout(() => hud.style.display = 'none', 300); // รอ animation จบ
        } else {
            updateHudContent(hud);
            hud.style.display = 'block';
            // เล็กน้อยเพื่อให้ transition ทำงาน
            setTimeout(() => hud.classList.add('visible'), 10);
        }
    };

    document.body.appendChild(orb);
    document.body.appendChild(hud);
    console.log('[Chronos] UI Created');
};

const updateHudContent = (panel) => {
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px;">
            <span style="font-weight: bold; color: #00E5FF;">💠 CHRONOS SYSTEM</span>
            <span style="font-size: 10px; opacity: 0.7;">V.2.0</span>
        </div>
        
        <div style="margin-bottom: 8px;">
            <div class="hud-label">LAST ACTION</div>
            <div style="font-size: 11px; opacity: 0.8;">${stats.lastMessageTimestamp}</div>
        </div>

        <div style="margin-bottom: 8px;">
            <div class="hud-label">TOKENS SAVED</div>
            <div class="hud-value">+${stats.lastSavedTokens} <small style="font-size:0.6em; font-weight:normal;">(${stats.lastSavedChars} chars)</small></div>
        </div>

        <div style="margin-top: 10px; padding-top: 5px; border-top: 1px dashed rgba(255,255,255,0.2);">
            <div class="hud-label">TOTAL ACCUMULATED</div>
            <div style="font-size: 1.4em; color: #69F0AE; font-weight: bold;">${stats.totalSavedTokens}</div>
        </div>
    `;
};

// =================================================================
// ⚙️ ส่วน Logic ตัด HTML (Token Saver)
// =================================================================
const estimateTokens = (chars) => Math.round(chars / 3.5);

const optimizePrompt = (data) => {
    if (!stats.enabled) return data;

    const regex = /<details>[\s\S]*?<summary>(.*?)<\/summary>[\s\S]*?TIME:<\/b>\s*(.*?)<br>[\s\S]*?WEATHER:<\/b>\s*(.*?)<br>[\s\S]*?LOCATION:<\/b>\s*(.*?)<br>[\s\S]*?NOW PLAYING:<\/b>\s*(.*?)[\s\S]*?<\/details>/gi;

    let totalSavingsInThisMessage = 0;

    const replacer = (match, datePart, time, weather, loc, music) => {
        const cleanDate = datePart.replace(/<[^>]*>?/gm, '').trim().replace('📅', '').trim();
        const shortText = `[Time Window: ${cleanDate} | Time: ${time.trim()} | Weather: ${weather.trim()} | Loc: ${loc.trim()} | Music: ${music.trim()}]`;
        const saving = match.length - shortText.length;
        if (saving > 0) totalSavingsInThisMessage += saving;
        return shortText;
    };

    let modified = false;

    // Chat Completion
    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            if (msg.content && msg.content.includes('<details>')) {
                msg.content = msg.content.replace(regex, replacer);
                modified = true;
            }
        });
    } 
    // Text Completion
    else if (data.body && data.body.prompt && typeof data.body.prompt === 'string') {
        if (data.body.prompt.includes('<details>')) {
            data.body.prompt = data.body.prompt.replace(regex, replacer);
            modified = true;
        }
    }

    if (modified && totalSavingsInThisMessage > 0) {
        const savedTokens = estimateTokens(totalSavingsInThisMessage);
        
        stats.lastSavedChars = totalSavingsInThisMessage;
        stats.lastSavedTokens = savedTokens;
        stats.totalSavedTokens += savedTokens;
        
        const now = new Date();
        stats.lastMessageTimestamp = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

        // Effect: ลูกแก้วเปลี่ยนสีแวบหนึ่ง
        const orb = document.getElementById('chronos-orb');
        if (orb) {
            orb.style.animation = 'none'; // หยุดหายใจแป๊บ
            orb.offsetHeight; /* trigger reflow */
            orb.style.animation = 'chronos-flash 0.5s ease, chronos-pulse 3s infinite ease-in-out';
        }
    }

    return data;
};

// =================================================================
// 🚀 เริ่มทำงาน
// =================================================================
injectStyles(); // ใส่ CSS

// พยายามสร้าง UI หลายๆ รอบเผื่อโหลดไม่ทัน
setTimeout(createChronosUI, 500);
setTimeout(createChronosUI, 2000);
setTimeout(createChronosUI, 5000);

if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePrompt);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePrompt);
    console.log('[Chronos] System Online.');
}

