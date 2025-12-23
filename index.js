// index.js - Chronos V20 (The All-Knowing) 🟣🧠

const extensionName = "Chronos_V20_Omniscient";

let stats = {
    enabled: true,
    currentBlockedTokens: 0, // จำนวน Token ที่กำลัง "กันท่า" ไว้อยู่ (รู้ล่วงหน้า)
    latestMsgBlocked: 0      // เฉพาะข้อความล่าสุด
};

// =================================================================
// 1. Logic: Stripper (เครื่องคำนวณส่วนต่าง)
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
// 2. UI: Psycho Neon (30px)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 120px; right: 20px;
            width: 30px; height: 30px;
            background: rgba(10, 0, 10, 0.9);
            border: 2px solid #D500F9; border-radius: 50%;
            z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 16px; color: #E040FB;
            box-shadow: 0 0 10px rgba(213, 0, 249, 0.6);
            transition: all 0.3s; user-select: none;
            backdrop-filter: blur(4px);
        }
        #chronos-orb:hover { transform: scale(1.15); box-shadow: 0 0 20px #D500F9; border-color: #fff; }
        
        /* สถานะ: มีโค้ดที่กำลัง Block อยู่ (สีเขียวเรืองแสง) */
        #chronos-orb.blocking { 
            border-color: #00E676; 
            color: #00E676;
            box-shadow: 0 0 15px #00E676; 
            animation: pulse-green 2s infinite;
        }

        @keyframes pulse-green { 
            0% { box-shadow: 0 0 5px #00E676; } 
            50% { box-shadow: 0 0 20px #00E676; } 
            100% { box-shadow: 0 0 5px #00E676; } 
        }

        #chronos-panel {
            position: fixed; top: 120px; right: 60px;
            width: 280px; padding: 12px;
            background: #0f0014; border: 1px solid #D500F9;
            color: #E1BEE7; font-family: monospace; font-size: 11px;
            display: none; z-index: 999999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.9); border-radius: 8px;
        }

        /* ป้ายลอยโชว์ตัวเลข (Flash) */
        .token-flash {
            position: fixed;
            color: #00E676; font-weight: bold; font-size: 14px;
            text-shadow: 0 2px 4px black;
            pointer-events: none; z-index: 1000000;
            animation: floatFade 1.5s ease-out forwards;
        }
        @keyframes floatFade { 
            0% { transform: translateY(0); opacity: 1; } 
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
    orb.innerHTML = '🛡️'; // ไอคอนโล่ (Shield) สื่อถึงการป้องกัน/Block
    
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
        <strong style="color:#E040FB;">CHRONOS V20 (ALWAYS READY)</strong><br>
        <span style="font-size:9px; color:#aaa;">สถานะ: กำลังกรอง HTML...</span>
        <div style="margin-top:10px; border-bottom:1px solid #5c007a; padding-bottom:5px;">
            <div style="display:flex; justify-content:space-between;">
                <span>ล่าสุด:</span>
                <b style="color:#fff;">${stats.latestMsgBlocked} Tok</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:4px;">
                <span>ทั้งหมด:</span>
                <b style="color:#00E676;">${stats.currentBlockedTokens} Tok</b>
            </div>
        </div>
        <div style="font-size:9px; color:#aaa; margin-top:5px; line-height:1.4;">
            *ตัวเลขนี้คือจำนวนโค้ดที่ระบบ <span style="color:#00E676">รู้แล้ว</span> และจะ <span style="color:#FF1744">ลบทิ้ง</span> ทันทีที่คุณกดส่ง*
        </div>
    `;
};

// =================================================================
// 3. Logic: Continuous Scanner (ระบบรู้ล่วงหน้า)
// =================================================================
const scanContext = () => {
    if (typeof SillyTavern === 'undefined') return;
    const context = SillyTavern.getContext();
    
    // ถ้าไม่มีแชท รีเซ็ต
    if (!context || !context.chat || context.chat.length === 0) {
        stats.currentBlockedTokens = 0;
        stats.latestMsgBlocked = 0;
        updateOrb();
        return;
    }

    let totalCharsBlocked = 0;
    let latestCharsBlocked = 0;
    const chat = context.chat;

    // สแกนทั้งหน้ากระดาษเดี๋ยวนี้
    chat.forEach((msg, index) => {
        // ถ้าเจอ HTML ในข้อความ
        if (msg.mes && (msg.mes.includes('<') && msg.mes.includes('>'))) {
            // คำนวณส่วนต่าง (Original - Clean)
            const cleanText = stripHtmlToText(msg.mes);
            // จำลองว่าถ้าส่งไปจะเป็นยังไง
            const newContent = `[System Content:\n${cleanText}]`;
            
            const blockedChars = msg.mes.length - newContent.length;
            
            if (blockedChars > 0) {
                totalCharsBlocked += blockedChars;
                // ถ้าเป็นข้อความสุดท้าย
                if (index === chat.length - 1) {
                    latestCharsBlocked = blockedChars;
                }
            }
        }
    });

    // แปลงเป็น Token และเก็บเข้าตัวแปร (รู้อยู่แล้ว)
    stats.currentBlockedTokens = estimateTokens(totalCharsBlocked);
    stats.latestMsgBlocked = estimateTokens(latestCharsBlocked);

    // อัปเดต UI (ถ้าเปิดอยู่)
    const panel = document.getElementById('chronos-panel');
    if (panel && panel.style.display === 'block') renderPanel(panel);
    
    updateOrb();
};

const updateOrb = () => {
    const orb = document.getElementById('chronos-orb');
    if (!orb) return;

    // ถ้ามีการ Block เกิดขึ้น (ตัวเลข > 0) ให้ลูกแก้วเรืองแสงสีเขียว
    if (stats.currentBlockedTokens > 0) {
        orb.classList.add('blocking');
    } else {
        orb.classList.remove('blocking');
    }
};

// สแกนทุก 1 วินาที (เพื่อให้ตัวเลขเป็นปัจจุบันตลอดเวลา)
setInterval(scanContext, 1000);

// =================================================================
// 4. Logic: Execution (แค่ทำตามที่รู้)
// =================================================================
const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    // *ไม่ได้คำนวณใหม่* แต่ใช้ Logic เดียวกันเพื่อปฏิบัติงานจริง
    // เพราะเรารู้อยู่แล้วว่าผลลัพธ์จะเป็นเท่าไหร่จาก scanContext()

    const processMsg = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
            const cleanText = stripHtmlToText(text);
            return `[System Content:\n${cleanText}]`;
        }
        return text;
    };

    if (data.body && data.body.messages && Array.isArray(data.body.messages)) {
        data.body.messages.forEach(msg => {
            msg.content = processMsg(msg.content);
        });
    } else if (data.body && data.body.prompt && typeof data.body.prompt === 'string') {
        data.body.prompt = processMsg(data.body.prompt);
    }

    // แค่โชว์ Visual Feedback ว่า "ส่งแล้วนะ" (ตามยอดที่รู้อยู่แล้ว)
    if (stats.currentBlockedTokens > 0) {
        const orb = document.getElementById('chronos-orb');
        if (orb) {
            const rect = orb.getBoundingClientRect();
            // Flash ตัวเลขขึ้นมาแวบเดียวเพื่อบอกว่าทำงานแล้ว
            const el = document.createElement('div');
            el.className = 'token-flash';
            el.innerText = `🛡️ Saved ${stats.latestMsgBlocked}`;
            el.style.left = (rect.left - 80) + 'px';
            el.style.top = (rect.top - 20) + 'px';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1500);
        }
        console.log(`[Chronos] Blocking executed. Saved Total: ${stats.currentBlockedTokens}`);
    }

    return data;
};

// =================================================================
// 5. Start
// =================================================================
injectStyles();
setTimeout(createUI, 1500);

if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    console.log('[Chronos V20] Omniscient Loaded.');
}

