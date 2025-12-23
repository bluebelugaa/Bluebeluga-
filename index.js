// index.js - Chronos Ghost Protocol (Visual: HTML / Send: Text) 👻

const extensionName = "Chronos_Ghost";

let stats = {
    enabled: true,
    lastSavedTokens: 0,
    totalSavedTokens: 0,
    lastAction: "Ready"
};

// =================================================================
// 1. ส่วนดีไซน์ (ลูกแก้วแสดงสถานะ)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes ghost-pulse { 0% { box-shadow: 0 0 5px #00E5FF; } 50% { box-shadow: 0 0 20px #00E5FF, 0 0 10px #fff inset; } 100% { box-shadow: 0 0 5px #00E5FF; } }
        #ghost-orb {
            position: fixed; top: 15vh; right: 20px;
            width: 50px; height: 50px;
            background: rgba(0, 0, 0, 0.6);
            border: 2px solid #00E5FF; border-radius: 50%;
            z-index: 99999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px; color: #00E5FF;
            transition: all 0.3s; backdrop-filter: blur(5px);
        }
        #ghost-orb:hover { transform: scale(1.1); background: rgba(0, 229, 255, 0.2); }
        #ghost-orb.working { animation: ghost-pulse 1s infinite; background: #00E5FF; color: #000; }
        
        #ghost-hud {
            position: fixed; top: 15vh; right: 80px;
            width: 200px; padding: 10px;
            background: rgba(10, 20, 30, 0.95);
            border: 1px solid #00E5FF; border-radius: 8px;
            color: #fff; font-family: sans-serif; font-size: 12px;
            display: none; z-index: 99999;
        }
    `;
    document.head.appendChild(style);
};

// =================================================================
// 2. สร้าง UI
// =================================================================
const createUI = () => {
    const old = document.getElementById('ghost-orb');
    if (old) old.remove();

    const orb = document.createElement('div');
    orb.id = 'ghost-orb';
    orb.innerHTML = '👻';
    
    const hud = document.createElement('div');
    hud.id = 'ghost-hud';

    orb.onclick = () => {
        hud.style.display = (hud.style.display === 'none') ? 'block' : 'none';
        updateHud(hud);
    };

    document.body.appendChild(orb);
    document.body.appendChild(hud);
};

const updateHud = (panel) => {
    panel.innerHTML = `
        <div style="color: #00E5FF; font-weight: bold; border-bottom: 1px solid #333; margin-bottom:5px;">👻 GHOST PROTOCOL</div>
        <div>สถานะ: ${stats.lastAction}</div>
        <div style="margin-top:5px; color: #69F0AE;">
            รอบล่าสุดประหยัด: <b>${stats.lastSavedTokens}</b> Tokens
        </div>
        <div style="margin-top:5px; font-size:10px; color:#aaa;">
            รวมทั้งหมด: ${stats.totalSavedTokens}
        </div>
        <div style="margin-top:8px; font-size:10px; color:#00E5FF; font-style:italic;">
            *หน้าจอแสดง HTML ปกติ<br>แต่ AI ได้รับแค่ Text*
        </div>
    `;
};

// =================================================================
// 3. Logic สำคัญ: แปลงร่างข้อมูลก่อนส่ง (Transformation)
// =================================================================
const estimateTokens = (chars) => Math.round(chars / 3.5);

const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    // เปลี่ยนลูกแก้วให้เรืองแสง เพื่อบอกว่า "กำลังทำงาน"
    const orb = document.getElementById('ghost-orb');
    if (orb) orb.classList.add('working');

    let totalCharsSaved = 0;
    
    // Regex จับ HTML เฉพาะของคุณ (จับรายละเอียดภายใน)
    // กลุ่ม 1: Date, กลุ่ม 2: Time, กลุ่ม 3: Weather, กลุ่ม 4: Location, กลุ่ม 5: Music
    const regex = /<details>[\s\S]*?<summary>(.*?)<\/summary>[\s\S]*?TIME:<\/b>\s*(.*?)<br>[\s\S]*?WEATHER:<\/b>\s*(.*?)<br>[\s\S]*?LOCATION:<\/b>\s*(.*?)<br>[\s\S]*?NOW PLAYING:<\/b>\s*(.*?)[\s\S]*?<\/details>/gi;

    const replacer = (match, dateHtml, time, weather, loc, music) => {
        // แกะ Text ออกมาจาก HTML tags
        const dateClean = dateHtml.replace(/<[^>]*>?/gm, '').trim().replace('📅', '').trim();
        
        // **นี่คือสิ่งที่ AI จะเห็น** (ข้อความล้วนๆ สั้นๆ)
        const aiSeeThis = `[Time Window: ${dateClean} | Time: ${time.trim()} | Weather: ${weather.trim()} | Loc: ${loc.trim()} | Music: ${music.trim()}]`;

        // คำนวณความประหยัด
        totalCharsSaved += (match.length - aiSeeThis.length);
        
        return aiSeeThis;
    };

    // วนลูปแก้ไข "เฉพาะข้อมูลที่จะส่งออก" (data.body.messages)
    // การแก้ตรงนี้ *ไม่* กระทบหน้าจอ UI ของเรา
    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            if (msg.content && msg.content.includes('<details>')) {
                // แทนที่ HTML เป็น Text ใน Payload
                msg.content = msg.content.replace(regex, replacer);
                
                // Fallback: ถ้า Regex บนจับไม่โดน ให้ใช้ Regex กวาดเรียบ เพื่อกันเหนียว
                msg.content = msg.content.replace(/<details>[\s\S]*?<\/details>/gi, (match) => {
                     // เช็คอีกทีว่าถ้ายังเป็น HTML อยู่ให้ยุบทิ้งเลย
                     if (match.includes('<')) {
                         totalCharsSaved += (match.length - 13);
                         return '[Time Window Info]';
                     }
                     return match;
                });
            }
        });
    }

    // อัปเดตสถิติ
    const savedTokens = estimateTokens(totalCharsSaved);
    stats.lastSavedTokens = savedTokens;
    stats.totalSavedTokens += savedTokens;
    stats.lastAction = "⚡ แปลงข้อมูลสำเร็จ";

    setTimeout(() => {
        if (orb) orb.classList.remove('working'); // หยุดเรืองแสง
        const hud = document.getElementById('ghost-hud');
        if (hud && hud.style.display === 'block') updateHud(hud); // อัปเดตเลข
    }, 1000);

    console.log(`[Ghost] Sent optimized text to AI. Saved ~${savedTokens} tokens.`);
    
    return data;
};

// =================================================================
// 4. Start
// =================================================================
injectStyles();
setTimeout(createUI, 2000);

if (typeof SillyTavern !== 'undefined') {
    // Hook นี้ทำงาน "ก่อน" ส่ง request ไปหา API
    // เราแก้ข้อมูลตรงนี้ = AI เห็นของใหม่ แต่หน้าจอเรายังเป็นของเดิม
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    console.log('[Chronos Ghost] Loaded.');
}

