// index.js - Chronos V18 (Real Context Stats) 🟣📉

const extensionName = "Chronos_V18_RealStats";

let stats = {
    enabled: true,
    contextSaved: 0, // ยอดรวมทั้งประวัติแชท (Total)
    latestSaved: 0   // ยอดเฉพาะข้อความล่าสุด (Latest)
};

// =================================================================
// 1. Logic: Stripper
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
        #chronos-orb.working { background: #D500F9; color: #000; animation: pulse-neon 0.5s infinite; }
        @keyframes pulse-neon { 0% { box-shadow: 0 0 5px #D500F9; } 50% { box-shadow: 0 0 20px #E040FB; } 100% { box-shadow: 0 0 5px #D500F9; } }

        #chronos-panel {
            position: fixed; top: 120px; right: 60px;
            width: 280px; padding: 12px;
            background: #0f0014; border: 1px solid #D500F9;
            color: #E1BEE7; font-family: monospace; font-size: 11px;
            display: none; z-index: 999999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.9); border-radius: 8px;
        }
        .token-popup {
            position: fixed;
            background: rgba(18, 0, 24, 0.95);
            border: 1px solid #D500F9;
            padding: 8px 12px;
            border-radius: 8px;
            pointer-events: none; z-index: 1000000;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5);
            animation: floatUp 4s ease-out forwards; /* นานขึ้นนิดนึงให้อ่านทัน */
            display: flex; flex-direction: column; align-items: flex-start;
        }
        .popup-row-latest { color: #00E676; font-weight: bold; font-size: 14px; text-shadow: 0 1px 2px black; }
        .popup-row-total { color: #E1BEE7; font-size: 11px; margin-top: 4px; border-top: 1px solid rgba(213, 0, 249, 0.5); padding-top: 2px; width: 100%; }
        @keyframes floatUp { 0% { transform: translateY(0); opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(-60px); opacity: 0; } }
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
        <strong style="color:#E040FB;">CHRONOS V18</strong><br>
        <div style="margin-top:5px; border-bottom:1px solid #5c007a; padding-bottom:5px;">
            ข้อความล่าสุด: <b style="color:#fff;">+${stats.latestSaved}</b> Tok<br>
            ทั้งหน้าแชท: <b style="color:#00E676;">${stats.contextSaved}</b> Tok
        </div>
        <div style="font-size:9px; color:#aaa; margin-top:5px;">
            *ประหยัดพื้นที่ Context ไปได้ตามยอดรวมนี้*
        </div>
    `;
};

const showFloatingNumber = (latest, total, x, y) => {
    const el = document.createElement('div');
    el.className = 'token-popup';
    el.innerHTML = `
        <div class="popup-row-latest">⚡ +${latest} (ล่าสุด)</div>
        <div class="popup-row-total">📦 ประหยัดพื้นที่: ${total}</div>
    `;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
};

// =================================================================
// 3. Logic: Execution (Context Calculation)
// =================================================================
const processText = (text) => {
    const htmlRegex = /<[^>]+>|&lt;[^&]+&gt;/;
    if (text && htmlRegex.test(text)) {
        const oldLen = text.length;
        const cleanText = stripHtmlToText(text);
        const newContent = `[System Content:\n${cleanText}]`;
        return { content: newContent, saved: oldLen - newContent.length };
    }
    return null;
};

const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    const orb = document.getElementById('chronos-orb');
    if (orb) orb.classList.add('working');

    // รีเซ็ตตัวนับรอบนี้ใหม่ เพราะเราจะนับ "ทั้งหน้ากระดาษ" ใหม่หมด
    let totalContextSaved = 0;
    let latestMsgSaved = 0;

    // --- CASE 1: Chat Completion ---
    if (data.body && data.body.messages && Array.isArray(data.body.messages)) {
        const msgs = data.body.messages;
        
        msgs.forEach((msg, index) => {
            const result = processText(msg.content);
            if (result && result.saved > 0) {
                // แก้ไขเนื้อหา
                msg.content = result.content;
                
                // บวกยอดรวม (Total Context)
                totalContextSaved += result.saved;

                // เช็คว่าเป็นข้อความสุดท้ายหรือไม่ (Latest)
                // (index === msgs.length - 1 คือข้อความล่าสุดที่กำลังส่ง)
                if (index === msgs.length - 1) {
                    latestMsgSaved = result.saved;
                }
            }
        });
    }
    
    // --- CASE 2: Text Completion ---
    else if (data.body && data.body.prompt && typeof data.body.prompt === 'string') {
        const result = processText(data.body.prompt);
        if (result && result.saved > 0) {
            data.body.prompt = result.content;
            totalContextSaved += result.saved;
            latestMsgSaved = result.saved; // Text Completion มีก้อนเดียว ถือเป็นทั้ง Latest และ Total
        }
    }

    // แปลงเป็น Token (1 token ≈ 3.5 chars)
    const totalTokens = estimateTokens(totalContextSaved);
    const latestTokens = estimateTokens(latestMsgSaved);

    // อัปเดต Stats
    stats.contextSaved = totalTokens;
    stats.latestSaved = latestTokens;

    // บังคับโชว์ Popup ถ้ามีการประหยัดเกิดขึ้น (ไม่ว่าจะรวมหรือล่าสุด)
    if (totalTokens > 0) {
        if (orb) {
            const rect = orb.getBoundingClientRect();
            showFloatingNumber(latestTokens, totalTokens, rect.left - 100, rect.top - 20);
        }
        console.log(`[Chronos] Latest: ${latestTokens} | Context Total: ${totalTokens}`);
    }

    setTimeout(() => {
        if (orb) orb.classList.remove('working');
        const panel = document.getElementById('chronos-panel');
        if(panel && panel.style.display === 'block') renderPanel(panel);
    }, 500);

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
    console.log('[Chronos V18] Real Context Stats Loaded.');
}

