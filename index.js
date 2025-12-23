// index.js

const extensionName = "TimeWindow_TokenSaver";

// =================================================================
// ส่วนที่ 1: ตั้งค่าสีแจ้งเตือน (CSS) ให้เป็นสีเทาอมน้ำเงินเรียบหรู
// =================================================================
const injectCustomStyle = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        /* ปรับแต่งสี Toastr (กล่องแจ้งเตือน) เฉพาะของ Extension นี้ */
        .toast-elegant-blue {
            background-color: #37474F !important; /* สีเทาอมน้ำเงินเข้ม (Blue Gray) */
            color: #eceff1 !important;             /* ตัวหนังสือสีขาวนวล */
            border-radius: 8px !important;         /* มุมโค้งมน */
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important; /* เงาฟุ้งๆ */
            opacity: 0.95 !important;
        }
        .toast-elegant-blue:hover {
            box-shadow: 0 6px 16px rgba(0,0,0,0.4) !important;
            opacity: 1 !important;
        }
    `;
    document.head.appendChild(style);
};

// เรียกใช้ฟังก์ชันใส่สีทันทีที่โหลด
injectCustomStyle();

// =================================================================
// ส่วนที่ 2: ระบบคำนวณและตัด HTML (Logic)
// =================================================================
let stats = {
    enabled: true,
    savedChars: 0,
    savedTokensApprox: 0
};

const estimateTokens = (chars) => Math.round(chars / 3.5);

const optimizePrompt = (data) => {
    if (!stats.enabled) return data; 

    // Regex สำหรับจับหน้าต่างเวลา (แก้ไขให้ครอบคลุมและยืดหยุ่น)
    const regex = /<details>[\s\S]*?<summary>(.*?)<\/summary>[\s\S]*?TIME:<\/b>\s*(.*?)<br>[\s\S]*?WEATHER:<\/b>\s*(.*?)<br>[\s\S]*?LOCATION:<\/b>\s*(.*?)<br>[\s\S]*?NOW PLAYING:<\/b>\s*(.*?)[\s\S]*?<\/details>/gi;

    let totalSavingsInThisMessage = 0;

    const replacer = (match, datePart, time, weather, loc, music) => {
        const cleanDate = datePart.replace(/<[^>]*>?/gm, '').trim().replace('📅', '').trim();
        
        // รูปแบบข้อความสั้นที่ส่งไปให้ AI
        const shortText = `[Time Window: ${cleanDate} | Time: ${time.trim()} | Weather: ${weather.trim()} | Loc: ${loc.trim()} | Music: ${music.trim()}]`;
        
        const saving = match.length - shortText.length;
        if (saving > 0) totalSavingsInThisMessage += saving;

        return shortText;
    };

    let modified = false;

    // กรณี: Chat Completion (ส่งข้อความคุยปกติ)
    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            if (msg.content && msg.content.includes('<details>')) {
                msg.content = msg.content.replace(regex, replacer);
                modified = true;
            }
        });
    } 
    // กรณี: Text Completion / Prompt
    else if (data.body && data.body.prompt && typeof data.body.prompt === 'string') {
        if (data.body.prompt.includes('<details>')) {
            data.body.prompt = data.body.prompt.replace(regex, replacer);
            modified = true;
        }
    }

    // แจ้งเตือนเมื่อมีการตัดโค้ดสำเร็จ
    if (modified && totalSavingsInThisMessage > 0) {
        const tokensSaved = estimateTokens(totalSavingsInThisMessage);
        
        stats.savedChars += totalSavingsInThisMessage;
        stats.savedTokensApprox += tokensSaved;

        // แสดงแจ้งเตือนโดยใช้ Class สีเทาอมน้ำเงินที่เราสร้างไว้
        toastr.info(
            `<i class="fa fa-scissors"></i> ตัด HTML ออกแล้ว!<br>ประหยัดไป ~${tokensSaved} Tokens`, 
            "Time Window Saver", 
            { 
                timeOut: 3000,
                toastClass: "toast toast-elegant-blue", // ใช้สีเทาอมน้ำเงิน
                allowHtml: true
            }
        );
        console.log(`[Time Saver] Saved ${totalSavingsInThisMessage} chars (~${tokensSaved} tokens)`);
    }

    return data;
};

// =================================================================
// ส่วนที่ 3: คำสั่งลัด (Slash Commands) พร้อมวิธีใช้
// =================================================================
const registerCommands = () => {
    
    // --- คำสั่งที่ 1: เช็คยอดประหยัด ---
    // วิธีใช้: พิมพ์ /tw_stats ในช่องแชท แล้วกดส่ง
    // ผลลัพธ์: จะบอกว่าเปิดใช้งานอยู่ไหม และประหยัดไปกี่โทเคนแล้ว
    SillyTavern.slash_commands.register_command(
        'tw_stats',
        () => {
            const msg = `
                📊 <b>Time Window Saver Stats</b><br>
                -------------------------<br>
                สถานะ: <b>${stats.enabled ? "✅ เปิดใช้งาน (Active)" : "❌ ปิดอยู่ (Inactive)"}</b><br>
                ประหยัดตัวอักษร: ${stats.savedChars}<br>
                ประหยัดโทเคน (โดยประมาณ): <b>${stats.savedTokensApprox} Tokens</b>
            `;
            // ใช้สีเดียวกันกับแจ้งเตือนปกติ
            toastr.info(msg, "", { 
                allowHtml: true, 
                timeOut: 5000,
                toastClass: "toast toast-elegant-blue"
            });
        },
        [],
        'Show Time Window Saver statistics (เช็คยอดประหยัดโทเคน)',
        true,
        true
    );

    // --- คำสั่งที่ 2: เปิด/ปิด การทำงาน ---
    // วิธีใช้: พิมพ์ /tw_toggle ในช่องแชท แล้วกดส่ง
    // ผลลัพธ์: ถ้าเปิดอยู่จะปิด, ถ้าปิดอยู่จะเปิด (เอาไว้เวลาอยากส่ง HTML เต็มๆไปให้บอทเห็น)
    SillyTavern.slash_commands.register_command(
        'tw_toggle',
        () => {
            stats.enabled = !stats.enabled;
            const statusText = stats.enabled ? "เปิดใช้งาน (ENABLED)" : "ปิดการทำงานชั่วคราว (DISABLED)";
            
            toastr.info(
                `Time Window Saver คือ: <b>${statusText}</b>`, 
                "", 
                { 
                    toastClass: "toast toast-elegant-blue",
                    allowHtml: true 
                }
            );
        },
        [],
        'Enable/Disable Time Window Saver (เปิด/ปิด การตัด HTML)',
        true,
        true
    );
};

// =================================================================
// ส่วนที่ 4: ลงทะเบียนกับระบบ (System Hook)
// =================================================================
if (typeof SillyTavern !== 'undefined') {
    registerCommands();
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePrompt);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePrompt);
    console.log('[Time Saver] Extension Loaded with Elegant Blue Theme.');
}
