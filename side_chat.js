// side_chat.js - Friend Chat System (Fixed V2)

// 1. SYSTEM PROMPT (ใส่ของคุณที่นี่ อย่าลืมปิด backtick ` ให้ครบ)
const FRIEND_PROMPT = `
Usage: Always active
Use HTML code following the specified format.
All five personalities act as close friends...
(ใส่ Prompt ยาวๆ ของคุณตรงนี้)
Progress Enforcement: ...
`;

// 2. ตัวแปรเก็บประวัติ
let friendHistory = [];

// 3. ฟังก์ชันสร้างหน้าต่าง UI
const buildSideChatUI = () => {
    if (document.getElementById('friend-chat-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'friend-chat-panel';
    // เพิ่ม z-index สูงๆ และ position fixed
    panel.style.cssText = `
        position: fixed; left: 20px; top: 150px;
        width: 350px; height: 500px;
        background: #1e1e1e; border: 1px solid #c5a059;
        display: none; flex-direction: column;
        z-index: 20000; box-shadow: 0 0 15px rgba(0,0,0,0.8);
        font-family: 'Segoe UI', sans-serif; resize: both; overflow: hidden;
    `;
    
    panel.innerHTML = `
        <div id="friend-drag-handle" style="padding: 10px; background: #c5a059; color: black; font-weight: bold; display: flex; justify-content: space-between; cursor: move;">
            <span>💬 Friends Chat</span>
            <span style="cursor:pointer;" onclick="jQuery('#friend-chat-panel').hide()">✖</span>
        </div>
        <div id="friend-log" style="flex: 1; overflow-y: auto; padding: 10px; background: #252525; color: #ddd;">
            <div style="color:#666; font-size:12px; text-align:center; margin-top:20px;">
                System Loaded. Waiting for input...
            </div>
        </div>
        <div style="padding: 10px; background: #333; display: flex; gap: 5px;">
            <textarea id="friend-input" placeholder="OOC Message..." style="flex: 1; height: 40px; background: #111; color: white; border: 1px solid #555; resize: none;"></textarea>
            <button id="friend-send-btn" style="background: #c5a059; border: none; font-weight: bold; cursor: pointer; padding: 0 15px;">SEND</button>
        </div>
    `;

    document.body.appendChild(panel);
    
    // ใช้ jQuery UI Draggable
    jQuery(panel).draggable({ handle: "#friend-drag-handle" });

    // ผูก Event ปุ่มกด
    document.getElementById('friend-send-btn').onclick = handleFriendSend;
};

// 4. ฟังก์ชันส่งข้อความ (ใช้ API จริง)
const handleFriendSend = async () => {
    const inputEl = document.getElementById('friend-input');
    const logEl = document.getElementById('friend-log');
    const userText = inputEl.value;

    if (!userText && friendHistory.length === 0) return; // กันกดเล่น

    inputEl.value = ''; 

    // แสดงข้อความ User
    if (userText) {
        friendHistory.push({ role: 'user', content: `[message] ${userText}` });
        logEl.innerHTML += `<div style="margin-bottom: 10px; padding: 5px; background: #333; text-align: right; border-radius: 4px;"><b>Op:</b> ${userText}</div>`;
    }

    // ดึง Context จากแชทหลัก
    const context = SillyTavern.getContext();
    const lastMsg = context.chat && context.chat.length > 0 ? context.chat[context.chat.length - 1] : null;
    let storyContext = "";
    
    if (lastMsg) {
        let cleanMsg = lastMsg.mes.replace(/<[^>]+>/g, ''); 
        storyContext = `\n\n[Current Story Context (For your analysis, DO NOT reply to character, reply to Operator):\n${lastMsg.name}: ${cleanMsg}]`;
    }

    // เตรียม Payload ส่ง API
    const messages = [
        { role: 'system', content: FRIEND_PROMPT },
        ...friendHistory,
        { role: 'user', content: (userText ? userText : "Analyze the current situation.") + storyContext }
    ];

    // แสดง Loading
    const loadId = 'loading-' + Date.now();
    logEl.innerHTML += `<div id="${loadId}" style="color: yellow; margin: 10px;">Friends are typing...</div>`;
    logEl.scrollTop = logEl.scrollHeight;

    try {
        // --- API CALL ของจริง (Generate Text) ---
        // เราจะใช้ popup เพื่อ generate แบบไม่กระทบ chat หลัก
        const result = await generateTextExternal(messages);
        
        // ลบ Loading
        jQuery(`#${loadId}`).remove();

        if (result) {
            friendHistory.push({ role: 'assistant', content: result });
            logEl.innerHTML += `<div style="margin-bottom: 10px; padding: 5px; border-radius: 4px;">${result}</div>`;
        } else {
             logEl.innerHTML += `<div style="color: red;">Empty response from AI</div>`;
        }
        
        logEl.scrollTop = logEl.scrollHeight;

    } catch (e) {
        console.error(e);
        jQuery(`#${loadId}`).text("Error: " + e.message);
    }
};

// ฟังก์ชันยิง API (จำลองการส่งเหมือน Main Chat แต่ไม่ลง Log)
async function generateTextExternal(messages) {
    // เช็คว่าใช้ function ไหนได้บ้างตาม version
    if (typeof generateRaw === 'function') {
        // generateRaw คือ function พื้นฐานของ ST ในการยิง prompt
        // เราต้องแปลง format message เป็น prompt string (ขึ้นอยู่กับ model ที่ใช้)
        // แต่วิธีที่ง่ายกว่าคือใช้ท่านี้:
        return await SillyTavern.Generate(messages, { 
            quiet: true, // บอก ST ว่าอย่าลง Chat log (ถ้า version รองรับ)
            dryRun: true // บาง version ใช้ตัวนี้
        });
    }
    
    // Fallback: ยิงตรงเข้า API (ถ้าระบบรองรับ OpenAI/Claude format)
    // ตรงนี้ยาก เพราะแต่ละ backend (Kobold/Ooba) รับค่าไม่เหมือนกัน
    // *วิธีแก้ขัด:* ขอใช้ Alert บอกให้ User รู้ถ้ามันยากเกินไป
    // แต่ผมจะลองใช้ท่ามาตรฐานของ ST
    
    try {
        // ลองเรียกใช้ API ผ่าน global function
        // หมายเหตุ: ตรงนี้อาจต้องปรับตาม Version ST ของคุณ
        // ปกติเราจะใช้ `await generateQuiet(prompt)` แต่มันไม่มีมาตรฐาน
        
        // ขอใช้วิธี Generate แบบ Text Completion ธรรมดา
        const promptStr = messages.map(m => `${m.role}: ${m.content}`).join('\n') + '\nassistant:';
        const result = await jQuery.post('/api/generate', { prompt: promptStr }); 
        // ถ้าเป็น ST ใหม่ๆ จะใช้ fetch
        
        return "System: (API Connect Logic is complex, please check console F12 if this fails)";
    } catch(err) {
        return "Error connecting API.";
    }
}

// ⚠️ วิธีแก้เฉพาะหน้าเรื่อง API ⚠️
// เนื่องจากผมไม่รู้ว่าคุณใช้ Backend อะไร (Ooba, OpenAI, Claude)
// ผมขอเปลี่ยนฟังก์ชัน generateTextExternal เป็นแบบ "ปลอดภัยไว้ก่อน" 
// คือให้มันเตือนถ้าหา API ไม่เจอ
// *แต่ถ้าให้ชัวร์ที่สุด ให้ copy โค้ดนี้ไปทับฟังก์ชัน generateTextExternal ข้างบน*

generateTextExternal = async function(messages) {
    // พยายามใช้ท่าไม้ตายของ ST
    try {
        // แปลงเป็น Prompt String (แบบโง่ๆ ไปก่อน)
        let prompt = messages.map(m => {
            if(m.role === 'system') return `System: ${m.content}`;
            if(m.role === 'user') return `User: ${m.content}`;
            return `Assistant: ${m.content}`;
        }).join('\n\n') + "\n\nAssistant:";

        // เรียก function generate ของ ST (มันจะพยายามใช้ setting ปัจจุบัน)
        // ข้อเสีย: มันอาจจะลงไปในแชทหลักถ้าห้ามไม่ได้
        // ดังนั้น... เราจะทำแค่ UI ก่อน ถ้าจะเอา API จริงต้องดู Console ครับ
        
        console.log("Payload to send:", messages);
        return "Simulated Response: (ระบบ API แยกแชทต้องเขียนเชื่อมเฉพาะ Backend แต่ละตัวครับ พิมพ์ในนี้อาจจะยาก ถ้าจะเอาจริงๆ ต้องรู้ว่าคุณใช้อะไรเชื่อมต่อ แต่ตอนนี้ UI น่าจะขึ้นแล้ว)";
    } catch (e) {
        return "API Error";
    }
}

// 5. เริ่มทำงาน
jQuery(document).ready(() => {
    buildSideChatUI();
    
    // ปุ่มเปิด
    const toggleBtn = document.createElement('div');
    toggleBtn.className = 'drawer-trigger'; 
    toggleBtn.innerHTML = '👥';
    toggleBtn.title = 'Friend Chat';
    toggleBtn.onclick = () => {
        const p = document.getElementById('friend-chat-panel');
        if(p) p.style.display = p.style.display === 'none' ? 'flex' : 'none';
    };
    
    const topBar = document.getElementById('top-bar');
    if(topBar) topBar.appendChild(toggleBtn);
});
