// index.js - Chronos V21 (Message Token Inspector) 🏙️🔍

const extensionName = "Chronos_V21_Inspector";

// ฟังก์ชันล้าง HTML (หัวใจของระบบ)
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
// 1. UI: Mini City Icon (28px)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        #chronos-orb {
            position: fixed; top: 120px; right: 20px;
            width: 28px; height: 28px;
            background: #1a1a1a; border: 1px solid #D500F9;
            border-radius: 4px; z-index: 999999; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            font-size: 14px; box-shadow: 0 0 10px rgba(213, 0, 249, 0.4);
            transition: all 0.3s;
        }
        #chronos-orb:hover { transform: scale(1.1); border-color: #fff; }

        #chronos-inspector {
            position: fixed; top: 100px; right: 60px;
            width: 320px; background: #0f0014; border: 1px solid #D500F9;
            color: #E1BEE7; font-family: monospace; font-size: 11px;
            display: none; z-index: 999999; border-radius: 8px;
            box-shadow: 0 10px 40px #000; overflow: hidden;
        }
        .ins-header { background: #D500F9; color: #000; padding: 5px 10px; font-weight: bold; }
        .ins-body { padding: 10px; }
        .msg-list { max-height: 150px; overflow-y: auto; border-bottom: 1px solid #333; margin-bottom: 10px; }
        .msg-item { padding: 5px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .msg-item:hover { background: #330044; }
        .view-area { background: #000; color: #00E676; padding: 8px; height: 180px; overflow-y: auto; font-size: 10px; white-space: pre-wrap; border: 1px solid #5c007a; }
        .stat-badge { display: flex; justify-content: space-between; margin-top: 5px; background: #222; padding: 5px; border-radius: 4px; }
    `;
    document.head.appendChild(style);
};

const createUI = () => {
    const old = document.getElementById('chronos-orb');
    if (old) old.remove();

    const orb = document.createElement('div');
    orb.id = 'chronos-orb';
    orb.innerHTML = '🏙️';
    
    const ins = document.createElement('div');
    ins.id = 'chronos-inspector';
    document.body.appendChild(orb);
    document.body.appendChild(ins);

    orb.onclick = () => {
        ins.style.display = (ins.style.display === 'none') ? 'block' : 'none';
        if (ins.style.display === 'block') renderInspector();
    };
};

const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    const chat = SillyTavern.getContext().chat || [];
    
    let listHtml = chat.slice(-10).reverse().map((msg, i) => {
        const preview = msg.mes.substring(0, 30);
        return `<div class="msg-item" onclick="viewAIVersion(${chat.length - 1 - i})">${msg.is_user ? '👤' : '🤖'} ${preview}...</div>`;
    }).join('');

    ins.innerHTML = `
        <div class="ins-header">🏙️ MESSAGE INSPECTOR</div>
        <div class="ins-body">
            <div style="margin-bottom:5px;">เลือกข้อความเพื่อส่อง (10 ล่าสุด):</div>
            <div class="msg-list">${listHtml}</div>
            <div id="view-target">
                <div style="color:#777; text-align:center; margin-top:50px;">คลิกข้อความด้านบนเพื่อส่อง</div>
            </div>
        </div>
    `;
};

// ฟังก์ชันส่องข้อความรายตัว
window.viewAIVersion = (index) => {
    const chat = SillyTavern.getContext().chat;
    const msg = chat[index].mes;
    const rawLen = msg.length;
    const rawTokens = estimateTokens(rawLen);

    const cleanText = stripHtmlToText(msg);
    const aiViewText = `[System Content:\n${cleanText}]`;
    const cleanLen = aiViewText.length;
    const cleanTokens = estimateTokens(cleanLen);
    const saved = rawTokens - cleanTokens;

    const target = document.getElementById('view-target');
    target.innerHTML = `
        <div class="view-area">${aiViewText}</div>
        <div class="stat-badge">
            <span>ต้นฉบับ: <b>${rawTokens}</b> Tok</span>
            <span style="color:#00E676;">AI เห็นจริง: <b>${cleanTokens}</b> Tok</span>
        </div>
        <div style="text-align:right; font-size:9px; color:#D500F9; margin-top:2px;">
            ประหยัดไปได้: ${saved > 0 ? saved : 0} Tokens
        </div>
    `;
};

// =================================================================
// 2. Logic: Execution (ตัดทิ้งทุกครั้งที่ส่ง)
// =================================================================
const optimizePayload = (data) => {
    // ระบบยังคงลบ HTML ทิ้งทุกครั้งที่ส่ง เพื่อประหยัด Token จริง
    const process = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
            return `[System Content:\n${stripHtmlToText(text)}]`;
        }
        return text;
    };

    if (data.body && data.body.messages) {
        data.body.messages.forEach(msg => msg.content = process(msg.content));
    } else if (data.body && data.body.prompt) {
        data.body.prompt = process(data.body.prompt);
    }
    return data;
};

// =================================================================
// 3. Start
// =================================================================
injectStyles();
setTimeout(createUI, 1500);

if (typeof SillyTavern !== 'undefined') {
    SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
    SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
        }

