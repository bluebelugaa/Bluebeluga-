// index.js - Chronos V42 (The Authority Edition) 🌪️🟣
// Logic: Generate Prompt Hook (Sync with ST Core) - Strict Lifecycle Adherence
// UI: Neon Cyberpunk (V39 Style)

const extensionName = "Chronos_V42_Authority";

// =================================================================
// 1. GLOBAL STATE & TOKENIZER (Single Source of Truth)
// =================================================================
// ตัวแปรนี้คือ "ค่าความจริง" ที่ได้จาก Final Prompt string เท่านั้น
let CHRONOS_FINAL_COUNT = 0; 

const getChronosTokenizer = () => {
    try {
        const ctx = SillyTavern.getContext();
        const model = ctx?.model || ctx?.settings?.model || SillyTavern?.settings?.model;
        if (!model) return null;
        return SillyTavern.Tokenizers.getTokenizerForModel(model);
    } catch (e) {
        return null;
    }
};

// =================================================================
// 2. THE AUTHORITATIVE HOOK (generate_prompt)
// =================================================================
// กฎเหล็ก: นับที่นี่เท่านั้น ห้ามแก้ไข Payload ที่นี่
const chronosAfterPrompt = (data) => {
    try {
        const tokenizer = getChronosTokenizer();
        if (tokenizer && data && data.prompt) {
            // นี่คือ String สุดท้ายที่จะส่งไป API จริงๆ
            CHRONOS_FINAL_COUNT = tokenizer.encode(data.prompt).length;
            console.log('[Chronos V42] Final Prompt Tokens:', CHRONOS_FINAL_COUNT);
        }
    } catch (e) {
        console.warn('[Chronos] Final count failed', e);
    }
    // ส่งคืน data ทันที ห้ามดัดแปลง
    return data;
};

// =================================================================
// 3. PAYLOAD MODIFIER (chat_completion_request)
// =================================================================
// กฎเหล็ก: แก้ไข HTML ที่นี่ แต่ "ห้ามนับ Token เป็นค่าจริง" ที่นี่
const stripHtmlToText = (html) => {
    if (!html) return "";
    let text = html.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/p>/gi, '\n\n')
                   .replace(/<\/div>/gi, '\n')
                   .replace(/<\/h[1-6]>/gi, '\n');
    text = text.replace(/<[^>]+>/g, ''); 
    text = text.replace(/&lt;[^&]+&gt;/g, ''); 
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    return text;
};

const optimizePayload = (data) => {
    const processText = (text) => {
        if (text && /<[^>]+>|&lt;[^&]+&gt;/.test(text)) {
            return `[System Content:\n${stripHtmlToText(text)}]`;
        }
        return text;
    };

    // ดำเนินการตัด HTML (Modification Phase)
    if (data.body?.messages) {
        data.body.messages.forEach(msg => {
            msg.content = processText(msg.content);
        });
    } else if (data.body?.prompt) {
        data.body.prompt = processText(data.body.prompt);
    }
    
    // Refresh UI หลังจากส่งเสร็จเพื่อให้ตัวเลข Final Count อัปเดต
    setTimeout(() => {
        const ins = document.getElementById('chronos-inspector');
        if (ins && ins.style.display === 'block') renderInspector();
    }, 1000); // รอให้ ST process เสร็จสักครู่
    
    return data;
};

// =================================================================
// 4. CALCULATOR & ESTIMATOR
// =================================================================
const calculateStats = () => {
    if (typeof SillyTavern === 'undefined') return { memoryRange: "Syncing...", original: 0, optimized: 0, remaining: 0, saved: 0, max: 0 };
    
    const context = SillyTavern.getContext();
    const chat = context.chat || [];

    // --- 1. Max Context (Max of Maxes Logic) ---
    let maxTokens = 8192;
    const candidateValues = [];
    ['max_context', 'max_tokens', 'cfg_ctx_size'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !isNaN(parseInt(el.value))) candidateValues.push(parseInt(el.value));
    });
    if (SillyTavern.main_api && SillyTavern.main_api.max_context) candidateValues.push(SillyTavern.main_api.max_context);
    if (context.max_context) candidateValues.push(context.max_context);
    
    const validValues = candidateValues.filter(v => typeof v === 'number' && v > 100);
    if (validValues.length > 0) maxTokens = Math.max(...validValues);

    // --- 2. Original Load (Authoritative Source) ---
    // ใช้ค่าจาก Hook generate_prompt ถ้ามี (แม่นยำสุด)
    // ถ้าไม่มี ให้ใช้ context.tokens (ค่า Cache ของ ST)
    let originalTotalLoad = CHRONOS_FINAL_COUNT || context.tokens || 0;

    // --- 3. Estimate Savings (ส่วนประมาณการ) ---
    // ใช้เพื่อแสดงผล UI เท่านั้น ไม่กระทบ Logic การส่ง
    let totalSavedEstimate = 0;
    const tokenizer = getChronosTokenizer(); 
    
    const quickCount = (text) => {
        if (!text) return 0;
        if (tokenizer && typeof tokenizer.encode === 'function') return tokenizer.encode(text).length;
        return Math.round(text.length / 2.7);
    };

    chat.forEach((msg) => {
        const rawLen = quickCount(msg.mes);
        let cleanContent = msg.mes;
        // เช็คว่าข้อความนี้จะถูกตัด HTML หรือไม่
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(cleanContent)) {
             const clean = stripHtmlToText(cleanContent);
             cleanContent = `[System Content:\n${clean}]`;
        }
        const optLen = quickCount(cleanContent);
        // เก็บส่วนต่างเพื่อโชว์ใน UI
        totalSavedEstimate += Math.max(0, rawLen - optLen);
    });

    // --- 4. Optimized Load ---
    // Load จริง (ที่ถูกตัดแล้วตอน generate_prompt) คือค่าที่เราได้มา
    // แต่เพื่อการแสดงผลว่า "ถ้าไม่ตัดจะเป็นเท่าไหร่" เราจะบวกกลับ
    // ดังนั้น:
    // Optimized (Current Real) = originalTotalLoad
    // Original (Hypothetical) = originalTotalLoad + totalSavedEstimate
    
    // *หมายเหตุ*: Logic การแสดงผลตรงนี้อาจสับสนนิดหน่อย แต่เพื่อให้ตรงกับ V39:
    // Original = ค่าดิบก่อนตัด
    // Optimized = ค่าจริงที่ส่ง (ซึ่งตอนนี้ CHRONOS_FINAL_COUNT คือค่าที่ส่งจริงแล้ว)
    
    const optimizedLoad = originalTotalLoad; 
    const hypotheticalOriginal = originalTotalLoad + totalSavedEstimate;
    const remainingSpace = Math.max(0, maxTokens - optimizedLoad);

    // --- 5. Memory Range (Visual Guide) ---
    // หักลบ Chat ออกเพื่อหา System Overhead โดยประมาณ
    const chatSum = quickCount(chat.map(m => m.mes).join(''));
    const systemOverhead = Math.max(0, originalTotalLoad - chatSum);
    const availableForChat = maxTokens - systemOverhead;
    
    let currentFill = 0;
    let startMsgIndex = -1;
    let rememberedCount = 0;
    
    // Loop ย้อนกลับเพื่อดูว่าข้อความไหนลงล็อกบ้าง
    for (let i = chat.length - 1; i >= 0; i--) {
        let msgToken = quickCount(chat[i].mes);
        if (/<[^>]+>|&lt;[^&]+&gt;/.test(chat[i].mes)) {
            const clean = stripHtmlToText(chat[i].mes);
            msgToken = quickCount(`[System Content:\n${clean}]`);
        }

        if (currentFill + msgToken <= availableForChat) {
            currentFill += msgToken;
            startMsgIndex = i;
            rememberedCount++;
        } else {
            break;
        }
    }

    let memoryRangeText = "";
    if (chat.length === 0) memoryRangeText = "-";
    else if (rememberedCount >= chat.length) memoryRangeText = `All (#0 - #${chat.length - 1})`;
    else if (startMsgIndex !== -1) memoryRangeText = `#${startMsgIndex} ➔ #${chat.length - 1}`;
    else memoryRangeText = "None (Context Full)";

    return {
        memoryRange: memoryRangeText,
        original: hypotheticalOriginal, // โชว์ค่าสมมุติว่าถ้าไม่ตัด
        optimized: optimizedLoad,       // ค่าจริงที่นับจาก Prompt
        remaining: remainingSpace,
        saved: totalSavedEstimate,
        max: maxTokens
    };
};

// =================================================================
// 5. UI SYSTEM (V39 ORIGINAL STYLE 🌀)
// =================================================================
const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        /* ORB STYLES - CYCLONE SPIN */
        #chronos-orb {
            position: fixed; top: 150px; right: 20px; width: 40px; height: 40px;
            background: radial-gradient(circle, rgba(20,0,30,0.9) 0%, rgba(0,0,0,1) 100%);
            border: 2px solid #D500F9; border-radius: 50%;
            z-index: 999999; cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 20px; color: #E040FB; 
            box-shadow: 0 0 15px rgba(213, 0, 249, 0.6), inset 0 0 10px rgba(213, 0, 249, 0.3);
            user-select: none; 
            animation: spin-slow 4s linear infinite; /* หมุนติ้วๆ */
            transition: transform 0.2s;
        }
        #chronos-orb:hover { transform: scale(1.1); border-color: #00E676; color: #00E676; box-shadow: 0 0 25px #00E676; }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* INSPECTOR PANEL */
        #chronos-inspector {
            position: fixed; top: 80px; right: 70px; width: 320px; 
            background: rgba(10, 10, 12, 0.95); 
            border: 1px solid #D500F9; border-top: 3px solid #D500F9;
            color: #E1BEE7; font-family: 'Consolas', monospace; font-size: 12px;
            display: none; z-index: 999999; border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.8); backdrop-filter: blur(10px);
            overflow: hidden;
        }
        .ins-header { 
            background: linear-gradient(90deg, #4A0072, #2a0040); 
            color: #fff; padding: 10px; font-weight: bold; letter-spacing: 1px; display: flex; justify-content: space-between; 
            border-bottom: 1px solid #D500F9;
        }
        .control-zone { display: flex; gap: 15px; padding: 6px 10px; background: #1a0520; color: #00E676; font-size: 11px; border-bottom: 1px solid #330044; }
        .dashboard-zone { background: #050505; padding: 15px; border-bottom: 1px solid #333; }
        .dash-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; align-items: center; }
        .dash-val { font-weight: bold; font-size: 13px; }
        .progress-container { width: 100%; height: 6px; background: #222; border-radius: 3px; margin-top: 8px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #D500F9, #00E676); width: 0%; transition: width 0.4s ease-out; }
        
        .ins-body { padding: 10px; background: #111; max-height: 400px; overflow-y: auto;}
        .msg-list { max-height: 120px; overflow-y: auto; border: 1px solid #333; margin-bottom: 10px; background: #0a0a0a; border-radius: 4px; }
        .msg-item { padding: 6px; cursor: pointer; border-bottom: 1px solid #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #888; transition: 0.2s;}
        .msg-item:hover { background: #330044; color: #fff; padding-left: 10px;}
        
        #view-target-wrapper { margin-top:10px; border-top:1px dashed #444; padding-top:10px; display:none; animation: fade-in 0.3s; }
        .view-area { background: #080808; color: #00E676; padding: 10px; height: 140px; overflow-y: auto; border: 1px solid #333; border-radius: 4px; margin-top: 5px; white-space: pre-wrap; word-wrap: break-word; }
        .stat-badge { display: flex; justify-content: space-between; margin-top: 5px; background: #222; padding: 6px; border-radius: 4px; border: 1px solid #333; }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111; }
        ::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #D500F9; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    `;
    document.head.appendChild(style);
};

let dragConfig = { orbUnlocked: false, panelUnlocked: false };

const createUI = () => {
    const oldOrb = document.getElementById('chronos-orb'); if (oldOrb) oldOrb.remove();
    const oldPanel = document.getElementById('chronos-inspector'); if (oldPanel) oldPanel.remove();

    const orb = document.createElement('div'); orb.id = 'chronos-orb'; orb.innerHTML = '🌀'; // Cyclone
    const ins = document.createElement('div'); ins.id = 'chronos-inspector';
    document.body.appendChild(orb); document.body.appendChild(ins);
    
    orb.onclick = () => {
        if (orb.getAttribute('data-dragging') === 'true') return;
        ins.style.display = (ins.style.display === 'none') ? 'block' : 'none';
        if (ins.style.display === 'block') renderInspector();
    };

    makeDraggable(orb, 'orb'); makeDraggable(ins, 'panel');
};

const renderInspector = () => {
    const ins = document.getElementById('chronos-inspector');
    if (ins.style.display === 'none') return;

    const chat = SillyTavern.getContext().chat || [];
    const stats = calculateStats();
    const percent = stats.max > 0 ? Math.min((stats.optimized / stats.max) * 100, 100) : 0;
    
    let listHtml = chat.slice(-5).reverse().map((msg, i) => {
        const actualIdx = chat.length - 1 - i;
        const preview = (msg.mes || "").substring(0, 25).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const roleIcon = msg.is_user ? '👤' : '🤖';
        return `<div class="msg-item" onclick="viewAIVersion(${actualIdx})">
                    <span style="color:#D500F9;">#${actualIdx}</span> ${roleIcon} ${preview}...
                </div>`;
    }).join('');

    ins.innerHTML = `
        <div class="ins-header" id="panel-header">
            <span>🚀 CHRONOS V42 (Authority)</span>
            <span style="cursor:pointer; color:#ff4081;" onclick="this.parentElement.parentElement.style.display='none'">✖</span>
        </div>
        <div class="control-zone">
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('orb', this.checked)" ${dragConfig.orbUnlocked ? 'checked' : ''}> Move Orb</label>
            <label style="cursor:pointer;"><input type="checkbox" onchange="toggleDrag('panel', this.checked)" ${dragConfig.panelUnlocked ? 'checked' : ''}> Move Win</label>
        </div>
        <div class="dashboard-zone">
            <div class="dash-row" style="border-bottom: 1px dashed #333; padding-bottom: 8px; margin-bottom: 8px;">
                <span style="color:#aaa;">🧠 Active Memory</span>
                <span class="dash-val" style="color:#E040FB;">${stats.memoryRange}</span>
            </div>
            <div class="dash-row">
                <span style="color:#aaa;">🛡️ Saved (Est.)</span>
                <span class="dash-val" style="color:#00E676;">-${stats.saved} toks</span>
            </div>
            <div class="dash-row">
                <span style="color:#fff;">🔋 Load / Max</span>
                <span class="dash-val" style="color:#fff;">${stats.optimized} / ${stats.max}</span>
            </div>
            <div class="progress-container"><div class="progress-bar" style="width: ${percent}%"></div></div>
            <div style="font-size:9px; color:#555; text-align:right; margin-top:3px;">Source: ${CHRONOS_FINAL_COUNT > 0 ? 'Generate Prompt (Exact)' : 'ST Cache (Est)'}</div>
        </div>
        <div class="ins-body">
            <div style="display:flex; gap:5px; margin-bottom:10px;">
                <input type="number" id="chronos-search-id" placeholder="Msg ID..." style="background:#222; border:1px solid #444; color:#fff; width:60px; padding:4px; border-radius:3px;">
                <button onclick="searchById()" style="background:#D500F9; border:none; color:#000; padding:4px 10px; border-radius:3px; cursor:pointer; font-weight:bold;">INSPECT</button>
            </div>
            <div style="font-size:9px; color:#666; margin-bottom:4px; text-transform:uppercase;">Recent Messages</div>
            <div class="msg-list">${listHtml}</div>
            <div id="view-target-wrapper"><div id="view-target-content"></div></div>
        </div>
    `;
};

// =================================================================
// 6. DRAG & VIEW UTILS
// =================================================================
window.toggleDrag = (type, c) => {
    if (type === 'orb') dragConfig.orbUnlocked = c;
    if (type === 'panel') { dragConfig.panelUnlocked = c; document.getElementById('panel-header').style.cursor = c ? 'move' : 'default'; }
};
const makeDraggable = (elm, type) => {
    let pos1=0,pos2=0,pos3=0,pos4=0;
    const ds = (e) => {
        if ((type==='orb' && !dragConfig.orbUnlocked) || (type==='panel' && !dragConfig.panelUnlocked)) return;
        if (type==='panel' && !e.target.closest('.ins-header')) return;
        const c = e.touches ? e.touches[0] : e;
        pos3=c.clientX; pos4=c.clientY;
        document.onmouseup = de; document.onmousemove = da; document.ontouchend = de; document.ontouchmove = da;
        elm.setAttribute('data-dragging', 'true');
    };
    const da = (e) => {
        const c = e.touches ? e.touches[0] : e;
        pos1=pos3-c.clientX; pos2=pos4-c.clientY; pos3=c.clientX; pos4=c.clientY;
        elm.style.top=(elm.offsetTop-pos2)+"px"; elm.style.left=(elm.offsetLeft-pos1)+"px";
        e.preventDefault();
    };
    const de = () => { document.onmouseup=null; document.onmousemove=null; document.ontouchend=null; document.ontouchmove=null; setTimeout(()=>elm.setAttribute('data-dragging','false'),100); };
    elm.onmousedown=ds; elm.ontouchstart=ds;
};

window.searchById = () => {
    const id = parseInt(document.getElementById('chronos-search-id').value);
    const chat = SillyTavern.getContext().chat || [];
    if (!isNaN(id) && id >= 0 && id < chat.length) viewAIVersion(id);
};

window.viewAIVersion = (index) => {
    const chat = SillyTavern.getContext().chat || [];
    const msg = chat[index];
    if (!msg) return;
    
    document.getElementById('view-target-wrapper').style.display = 'block';
    
    const tokenizer = getChronosTokenizer();
    const quickCount = (text) => tokenizer ? tokenizer.encode(text).length : text.length/3;

    const rawLen = quickCount(msg.mes);
    let cleanText = stripHtmlToText(msg.mes);
    let aiViewText = msg.mes;
    if (/<[^>]+>|&lt;[^&]+&gt;/.test(msg.mes)) aiViewText = `[System Content:\n${cleanText}]`;
    
    const optLen = quickCount(aiViewText);
    const saved = Math.max(0, rawLen - optLen);

    document.getElementById('view-target-content').innerHTML = `
        <div style="color:#E040FB; margin-bottom:5px; font-size:10px;">ID: #${index}</div>
        <div class="view-area">${aiViewText.replace(/</g, '&lt;')}</div>
        <div class="stat-badge">
            <span style="color:#aaa;">Raw: ${rawLen}</span>
            <span style="color:#fff;">Sent: ${optLen}</span>
            <span style="color:#00E676;">Saved: -${saved}</span>
        </div>
    `;
};

// =================================================================
// 7. INITIALIZATION
// =================================================================
(function() {
    injectStyles();
    setTimeout(createUI, 2000);
    
    if (typeof SillyTavern !== 'undefined') {
        console.log(`[${extensionName}] Ready. Correct Lifecycle Hooks.`);
        
        // HOOK 1: Authoritative Count (Generate Prompt)
        // นับที่นี่ = ได้ค่าจริง (Final Prompt) 
        SillyTavern.extension_manager.register_hook('generate_prompt', chronosAfterPrompt);
        
        // HOOK 2: Modification (Request)
        // แก้ไข Payload ที่นี่ แต่ไม่นับ Token ที่นี่
        SillyTavern.extension_manager.register_hook('chat_completion_request', optimizePayload);
        SillyTavern.extension_manager.register_hook('text_completion_request', optimizePayload);
    } else {
        console.warn(`[${extensionName}] SillyTavern object not found.`);
    }
})();
     
