// index.js - Chronos V10 (Perfect Drag & Click) 🟣✨

const extensionName = "Chronos_V10_Perfect";

let stats = {
    enabled: true,
    totalSaved: 0
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
// 2. UI: ลูกแก้ว V10 (แก้ระบบสัมผัส)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; 
            top: 150px; right: 20px; /* ตำแหน่งเริ่ม */
            width: 45px; height: 45px;
            background: rgba(10, 10, 10, 0.9);
            border: 2px solid #D500F9;
            border-radius: 50%;
            z-index: 999999; 
            display: flex; align-items: center; justify-content: center;
            font-size: 22px; color: #E040FB;
            box-shadow: 0 0 10px rgba(213, 0, 249, 0.5);
            backdrop-filter: blur(5px);
            user-select: none;
            cursor: pointer;
            touch-action: none; /* สำคัญ! ป้องกันหน้าจอเลื่อนตาม */
            transition: transform 0.1s;
        }
        #chronos-orb:active { transform: scale(0.95); border-color: #fff; }
        
        /* Effect ตัวเลขเด้ง */
        .token-popup {
            position: fixed;
            color: #00E676; font-weight: bold; font-size: 16px;
            pointer-events: none; z-index: 1000000;
            text-shadow: 0 2px 4px black;
            font-family: sans-serif;
            animation: floatUp 2s ease-out forwards;
        }
        @keyframes floatUp {
            0% { transform: translateY(0) scale(1); opacity: 1; }
            100% { transform: translateY(-60px) scale(1.2); opacity: 0; }
        }

        #chronos-panel {
            position: fixed;
            width: 200px; padding: 10px;
            background: #1a1a1a; border: 1px solid #D500F9;
            color: #eee; font-family: monospace; font-size: 11px;
            display: none; z-index: 999998;
            box-shadow: 0 5px 20px #000;
            border-radius: 8px;
            pointer-events: none; /* กันกดโดน */
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
    
    document.body.appendChild(orb);
    document.body.appendChild(panel);

    // เรียกใช้ฟังก์ชันลากเวอร์ชั่นอัปเกรด
    setupSmartDrag(orb, panel);
};

// =================================================================
// 3. Logic: Smart Drag (แยกแยะการจิ้ม vs การลาก)
// =================================================================
const setupSmartDrag = (elm, panel) => {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;

    const onStart = (e) => {
        // e.preventDefault(); // อย่าใส่บรรทัดนี้ ไม่งั้นจะกดคลิกไม่ได้ในบาง Browser
        const touch = e.type === 'touchstart' ? e.touches[0] : e;
        startX = touch.clientX;
        startY = touch.clientY;
        initialLeft = elm.offsetLeft;
        initialTop = elm.offsetTop;
        isDragging = false; // รีเซ็ตสถานะ

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    };

    const onMove = (e) => {
        const touch = e.type === 'touchmove' ? e.touches[0] : e;
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        // ถ้าขยับเกิน 5 pixels ถือว่า "กำลังลาก"
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            isDragging = true;
            if(e.cancelable) e.preventDefault(); // กันหน้าจอเลื่อน
            
            elm.style.left = `${initialLeft + dx}px`;
            elm.style.top = `${initialTop + dy}px`;
            
            // ซ่อน panel ตอนลากจะได้ไม่เกะกะ
            panel.style.display = 'none';
        }
    };

    const onEnd = (e) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);

        if (!isDragging) {
            // *** ถ้าไม่ได้ลาก แปลว่า "จิ้ม" (Click) ***
            togglePanel(elm, panel);
        }
    };

    elm.addEventListener('mousedown', onStart);
    elm.addEventListener('touchstart', onStart, { passive: false });
};

const togglePanel = (orb, panel) => {
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
    } else {
        // อัปเดตข้อความ
        panel.innerHTML = `
            <strong style="color:#D500F9;">CHRONOS V10</strong><br>
            Saved: <b style="color:#00E676;">${stats.totalSaved}</b> Tok<br>
            <div style="color:#aaa; margin-top:5px; font-size:9px;">
                (Status: Running)
            </div>
        `;
        
        // คำนวณตำแหน่งให้ Panel อยู่ข้างๆ ลูกแก้วเสมอ
        const rect = orb.getBoundingClientRect();
        // ให้เด้งไปทางซ้ายของลูกแก้ว
        panel.style.left = (rect.left - 210) + 'px'; 
        panel.style.top = rect.top + 'px';
        
        // ถ้าชิดขอบซ้ายเกินไป ให้เด้งไปทางขวาแทน
        if (parseInt(panel.style.left) < 0) {
            panel.style.left = (rect.right + 10) + 'px';
        }

        panel.style.display = 'block';
        
        // Auto hide after 3 seconds
        setTimeout(() => panel.style.display = 'none', 3000);
    }
};

const showFloatingNumber = (amount, x, y) => {
    const el = document.createElement('div');
    el.className = 'token-popup';
    el.innerHTML = `+${amount}`;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
};

// =================================================================
// 4. Execution Logic
// =================================================================
const optimizePayload = (data) => {
    if (!stats.enabled) return data;

    let charsSaved = 0;

    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => {
            // เช็คว่ามี HTML Tag
            if (msg.content && /<[^>]+>/.test(msg.content)) {
                const oldLen = msg.content.length;
                
                const cleanText = stripHtmlToText(msg.content);
                msg.content = `[System Content: ${cleanText.substring(0, 15)}...]` + cleanText;

                const newLen = msg.content.length;
                charsSaved += (oldLen - newLen);
            }
        });
    }

    if (charsSaved > 0) {
        const tokens = estimateTokens(charsSaved);
        stats.totalSaved += tokens;
        
        // Effect เด้งเลข
        const orb = document.getElementById('chronos-orb');
        if (orb) {
            const rect = orb.getBoundingClientRect();
            // ให้เลขเด้งออกจากกลางลูกแก้ว
            showFloatingNumber(tokens, rect.left + 10, rect.top - 20);
            
            // Effect กระตุกนิดนึงให้รู้ว่าทำงาน
            orb.style.transform = "scale(1.2)";
            orb.style.borderColor = "#00E676";
            setTimeout(() => {
                orb.style.transform = "scale(1)";
                orb.style.borderColor = "#D500F9";
            }, 200);
        }
        console.log(`[Chronos] Saved ~${tokens} tokens.`);
    }

    return data;
};

// =================================================================
// 5. Start
// =================================================================
injectStyles();
setTimeout(createUI, 1000);

if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    console.log('[Chronos V10] Touch System Loaded.');
}

