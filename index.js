// index.js - Debug Version (Red Button Top Right)

const extensionName = "TimeWindow_VisualSaver";

let stats = {
    enabled: true,
    lastSavedTokens: 0,
    lastSavedChars: 0,
    totalSavedTokens: 0,
    lastMessageTimestamp: "-"
};

// ฟังก์ชันสร้างปุ่ม (แบบบังคับแสดงผลสุดๆ)
const createFloatingUI = () => {
    // ลบอันเก่าทิ้ง
    const existing = document.getElementById('tw-saver-icon');
    if (existing) existing.remove();

    // สร้างปุ่ม
    const iconDiv = document.createElement('div');
    iconDiv.id = 'tw-saver-icon';
    iconDiv.innerHTML = '🛡️'; 
    
    // --- ตั้งค่าตำแหน่งใหม่ (ขวาบน) ---
    Object.assign(iconDiv.style, {
        position: 'fixed',
        top: '80px',          // <--- อยู่ด้านบน ห่างลงมานิดหน่อย
        right: '20px',        // <--- อยู่ทางขวา
        width: '50px',
        height: '50px',
        backgroundColor: 'red', // <--- สีแดงสด! (Test Mode)
        border: '3px solid yellow', // <--- ขอบเหลือง! (ให้เห็นชัดๆ)
        color: '#fff',
        borderRadius: '50%',
        textAlign: 'center',
        lineHeight: '46px',
        fontSize: '24px',
        fontWeight: 'bold',
        cursor: 'pointer',
        zIndex: '999999',     // อยู่บนสุดของห่วงโซ่อาหาร
        boxShadow: '0 5px 15px rgba(0,0,0,0.5)',
        display: 'block'      // บังคับโชว์
    });

    // สร้างหน้าต่าง Info
    const infoPanel = document.createElement('div');
    infoPanel.id = 'tw-saver-info';
    Object.assign(infoPanel.style, {
        position: 'fixed',
        top: '80px',          // <--- ปรับให้ตรงกับปุ่ม
        right: '80px',        // <--- ขยับมาทางซ้ายของปุ่ม
        padding: '10px',
        backgroundColor: '#222',
        color: '#fff',
        borderRadius: '8px',
        border: '1px solid white',
        zIndex: '999999',
        display: 'none',
        fontSize: '12px',
        width: '200px',
        fontFamily: 'sans-serif'
    });

    // กดแล้วเปิด/ปิด
    iconDiv.onclick = () => {
        if (infoPanel.style.display === 'none') {
            updateInfoContent(infoPanel);
            infoPanel.style.display = 'block';
        } else {
            infoPanel.style.display = 'none';
        }
    };

    document.body.appendChild(iconDiv);
    document.body.appendChild(infoPanel);
    console.log('[DEBUG] Button created at TOP RIGHT');
};

const updateInfoContent = (panel) => {
    panel.innerHTML = `
        <div style="font-weight: bold; border-bottom: 1px solid #555; margin-bottom: 5px;">
            DEBUG MODE
        </div>
        ล่าสุด: ${stats.lastMessageTimestamp}<br>
        ประหยัด: <b>${stats.lastSavedTokens}</b> Tokens<br>
        รวม: ${stats.totalSavedTokens} Tokens
    `;
};

// ... (Logic เดิม - ส่วน regex และ hook คงเดิม) ...
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
    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            if (msg.content && msg.content.includes('<details>')) {
                msg.content = msg.content.replace(regex, replacer);
                modified = true;
            }
        });
    } else if (data.body && data.body.prompt && typeof data.body.prompt === 'string') {
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
        
        // ทำให้ปุ่มเปลี่ยนสีเมื่อทำงาน
        const icon = document.getElementById('tw-saver-icon');
        if (icon) {
            icon.style.backgroundColor = '#00ff00'; // เขียว
            setTimeout(() => icon.style.backgroundColor = 'red', 1000);
        }
    }
    return data;
};

// --- ส่วนสำคัญ: บังคับรัน ---
// 1. ลองรันทันที
createFloatingUI();

// 2. ลองรันอีกทีเมื่อเวลาผ่านไป (เผื่อหน้าเว็บโหลดช้า)
setTimeout(createFloatingUI, 2000);
setTimeout(createFloatingUI, 5000);

if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePrompt);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePrompt);
    
    // 3. แจ้งเตือนทันทีที่ไฟล์โหลดเสร็จ (เช็คว่าไฟล์เข้าเครื่องจริงไหม)
    // alert("TimeSaver Extension Loaded! มองหาปุ่มแดงขวาบนนะครับ"); 
}


