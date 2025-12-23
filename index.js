// index.js - Chronos V4 (Universal Fix & Debugger) 🛠️

const extensionName = "Chronos_V4_Fix";

let stats = {
    enabled: true,
    lastSavedTokens: 0,
    totalSavedTokens: 0,
    debugInfo: "Waiting for action..."
};

// =================================================================
// 1. Regex (หัวใจสำคัญ)
// =================================================================
// ใช้แบบกว้างที่สุด: จับตั้งแต่เปิด details ยันปิด details ไม่สนข้างใน
const universalRegex = /<details[\s\S]*?<\/details>/gi;

// ฟังก์ชันประมาณการโทเคน (1 Token ≈ 3.5 chars)
const estimateTokens = (chars) => Math.round(chars / 3.5);

// =================================================================
// 2. UI (ลูกแก้ว + หน้าต่าง Debug)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes orb-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        #chronos-orb {
            position: fixed; top: 15vh; right: 20px;
            width: 55px; height: 55px;
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid #00FF00; border-radius: 50%;
            z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px; color: #00FF00;
            box-shadow: 0 0 10px #00FF00;
            transition: all 0.3s;
        }
        #chronos-hud {
            position: fixed; top: 15vh; right: 85px;
            width: 250px; padding: 15px;
            background: #1a1a1a; border: 1px solid #00FF00;
            color: #fff; font-family: monospace; font-size: 11px;
            display: none; z-index: 999999;
            box-shadow: 0 5px 20px rgba(0,0,0,0.8);
        }
        .btn-debug {
            background: #333; color: #fff; border: 1px solid #555;
            padding: 5px; margin-top: 5px; width: 100%; cursor: pointer;
        }
    `;
    document.head.appendChild(style);
};

const createUI = () => {
    // ลบของเก่าก่อน
    const old = document.getElementById('chronos-orb');
    if (old) old.remove();

    const orb = document.createElement('div');
    orb.id = 'chronos-orb';
    orb.innerHTML = '⚡';
    
    const hud = document.createElement('div');
    hud.id = 'chronos-hud';

    orb.onclick = () => {
        hud.style.display = (hud.style.display === 'none') ? 'block' : 'none';
        updateHud(hud);
    };

    document.body.appendChild(orb);
    document.body.appendChild(hud);
};

const updateHud = (panel) => {
    panel.innerHTML = `
        <strong style="color:#00FF00;">CHRONOS DEBUGGER</strong><br>
        --------------------------<br>
        STATUS: ${stats.enabled ? "ACTIVE" : "OFF"}<br>
        LAST SAVE: <b>${stats.lastSavedTokens}</b> Tokens<br>
        TOTAL SAVE: ${stats.totalSavedTokens} Tokens<br>
        --------------------------<br>
        DEBUG INFO:<br>
        <div style="color:#aaa; word-wrap:break-word;">${stats.debugInfo}</div>
        <button class="btn-debug" onclick="document.dispatchEvent(new CustomEvent('chronos-check-now'))">
            🔍 Check Last Message
        </button>
    `;
};

// =================================================================
// 3. Logic: Ghost Protocol (Send Text, Keep HTML)
// =================================================================
const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    let totalCharsSaved = 0;
    let matchCount = 0;

    // เปลี่ยนสถานะให้รู้ว่ากำลังทำงาน
    const orb = document.getElementById('chronos-orb');
    if(orb) orb.style.borderColor = "yellow";

    // วนลูปเช็คข้อความที่จะส่ง (Context)
    if (data.body && data.body.messages) {
        data.body.messages.forEach((msg, index) => {
            // ถ้าเจอ <details>
            if (msg.content && universalRegex.test(msg.content)) {
                matchCount++;
                const originalLen = msg.content.length;
                
                // --- แปลงร่าง! ---
                // แทนที่ทั้งก้อนด้วย [Time Window Info]
                msg.content = msg.content.replace(universalRegex, (match) => {
                    // พยายามดึงวันที่มาโชว์หน่อย (ถ้ามี)
                    let summaryText = "";
                    if (match.includes("summary")) {
                        const sumMatch = match.match(/<summary>(.*?)<\/summary>/i);
                        if (sumMatch) summaryText = sumMatch[1].replace(/<[^>]*>/g, "").trim();
                    }
                    return summaryText ? `[Time: ${summaryText}]` : `[Time Window]`;
                });

                const newLen = msg.content.length;
                totalCharsSaved += (originalLen - newLen);
            }
        });
    }

    // คำนวณผลลัพธ์
    const savedTokens = estimateTokens(totalCharsSaved);
    stats.lastSavedTokens = savedTokens;
    stats.totalSavedTokens += savedTokens;
    stats.debugInfo = `Last Send: Found ${matchCount} blocks. Saved ~${savedTokens} toks.`;

    // คืนค่าสี UI
    setTimeout(() => {
        if(orb) orb.style.borderColor = "#00FF00";
        const hud = document.getElementById('chronos-hud');
        if(hud && hud.style.display === 'block') updateHud(hud);
    }, 500);

    return data;
};

// =================================================================
// 4. Debug Feature (ปุ่มกดเช็คข้อความ)
// =================================================================
const checkLastMessageManually = () => {
    if (typeof SillyTavern === 'undefined') return;
    
    // ดึงประวัติแชทปัจจุบัน
    const context = SillyTavern.getContext();
    if (!context || !context.chat || context.chat.length === 0) {
        stats.debugInfo = "No chat history found.";
        updateHud(document.getElementById('chronos-hud'));
        return;
    }

    const lastMsg = context.chat[context.chat.length - 1];
    const content = lastMsg.mes || ""; // ข้อความของบอท

    // ลองเทส Regex
    const found = content.match(universalRegex);
    
    if (found) {
        stats.debugInfo = `✅ FOUND MATCH!<br>Length: ${found[0].length} chars<br>Content Start: ${found[0].substring(0, 20)}...`;
    } else {
        stats.debugInfo = `❌ NO MATCH.<br>Last Msg Start: ${content.substring(0, 30)}...<br>(Check if bot uses HTML correctly)`;
    }
    
    updateHud(document.getElementById('chronos-hud'));
};

// =================================================================
// 5. Start
// =================================================================
injectStyles();
setTimeout(createUI, 2000);

// Event Listener สำหรับปุ่มใน HUD
document.addEventListener('chronos-check-now', checkLastMessageManually);

if (typeof SillyTavern !== 'undefined') {
    // Hook ตอนส่งข้อมูล (Ghost Protocol)
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    
    // แจ้งเตือนเมื่อโหลดเสร็จ (Debug)
    // alert("Chronos Loaded! Look for the ⚡ Orb."); 
    console.log('[Chronos V4] Ready.');
        }
    
