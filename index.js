// --- Sweet Heart HUD: MP4 Video Edition ---
const STORAGE_KEY = "sweet_hud_mp4_v1";

const PAGES = [
    { id: 'lore', title: 'Diary', icon: 'fa-book' },
    { id: 'inspect', title: 'Check', icon: 'fa-magnifying-glass' },
    { id: 'ooc', title: 'Chat', icon: 'fa-comments' },
    { id: 'world', title: 'World', icon: 'fa-globe' },
    { id: 'helper', title: 'Help', icon: 'fa-wand-magic-sparkles' }
];

let state = {
    btnPos: { top: '120px', left: 'auto', right: '15px' },
    winPos: { top: '15vh', left: '5vw' },
    curPage: PAGES[0].id,
    lockOrb: true, 
    lockWin: true
};

jQuery(async () => {
    loadSettings();
    injectUI();
});

function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state = { ...state, ...JSON.parse(saved) };
}

function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function injectUI() {
    $('#x_floating_btn, #x_main_modal').remove();

    // สร้างลูกแก้วโดยใช้ VIDEO tag
    // autoplay: เล่นอัตโนมัติ
    // loop: เล่นวนซ้ำ
    // muted: ปิดเสียง (จำเป็นสำหรับ auto play บนมือถือ)
    // playsinline: เล่นในกรอบไม่เด้งเต็มจอ (จำเป็นสำหรับ iPhone/Android)
    $('body').append(`
        <div id="x_floating_btn">
            <video class="x-core-video" autoplay loop muted playsinline>
                <source src="https://files.catbox.moe/89qxpt.mp4" type="video/mp4">
            </video>
        </div>
    `);
    $('#x_floating_btn').css(state.btnPos);

    // หน้าต่างหลัก
    const html = `
    <div id="x_main_modal">
        <div class="x-header" id="x_drag_zone">
            <div class="x-title">SWEET HUD</div>
            <div class="x-nav-container">
                ${PAGES.map(p => `
                    <div class="x-nav-icon ${p.id === state.curPage ? 'active' : ''}" 
                         data-id="${p.id}" 
                         title="${p.title}">
                        <i class="fa-solid ${p.icon}"></i>
                    </div>
                `).join('')}
            </div>
            <div class="x-controls-group">
                <div id="btn_mv_orb" class="x-mini-btn ${!state.lockOrb?'active':''}">
                    <i class="fa-solid fa-arrows-up-down-left-right"></i>
                </div>
                <div id="btn_mv_win" class="x-mini-btn ${!state.lockWin?'active':''}">
                    <i class="fa-solid fa-expand"></i>
                </div>
                <div id="btn_close" class="x-close-icon"><i class="fa-solid fa-xmark"></i></div>
            </div>
        </div>
        <div class="x-content-box">
            ${PAGES.map(p => `
                <div id="page_${p.id}" class="x-page ${p.id === state.curPage ? 'active' : ''}">
                    <div class="x-page-header">
                        <i class="fa-solid ${p.icon}"></i> ${p.title}
                    </div>
                    <div id="content_${p.id}">Waiting for sweetness...</div>
                </div>
            `).join('')}
        </div>
    </div>`;

    $('body').append(html);
    $('#x_main_modal').css(state.winPos);

    bindEvents();
    updateSafety();
}

function bindEvents() {
    const orb = $('#x_floating_btn');
    const modal = $('#x_main_modal');

    orb.on('click', () => {
        if (!state.lockOrb) return;
        modal.fadeToggle(200).css('display', 'flex');
    });

    $('#btn_close').on('click', () => {
        if (!state.lockOrb || !state.lockWin) return;
        modal.fadeOut(200);
    });

    $('.x-nav-icon').on('click', function() {
        const id = $(this).data('id');
        state.curPage = id;
        $('.x-nav-icon').removeClass('active');
        $(this).addClass('active');
        $('.x-page').removeClass('active');
        $(`#page_${id}`).addClass('active');
        saveSettings();
    });

    $('#btn_mv_orb').on('click', () => {
        state.lockOrb = !state.lockOrb;
        updateSafety();
        saveSettings();
    });

    $('#btn_mv_win').on('click', () => {
        state.lockWin = !state.lockWin;
        updateSafety();
        saveSettings();
    });

    makeDraggable(orb[0], 'orb');
    makeDraggable(modal[0], 'win', $('#x_drag_zone')[0]);
}

function updateSafety() {
    const moving = (!state.lockOrb || !state.lockWin);
    $('#btn_mv_orb').toggleClass('active', !state.lockOrb);
    $('#btn_mv_win').toggleClass('active', !state.lockWin);
    $('#x_floating_btn').toggleClass('x-dragging', !state.lockOrb);
    $('#btn_close').toggleClass('disabled', moving);
    $('#x_drag_zone').toggleClass('x-head-drag', !state.lockWin);
}

function makeDraggable(el, type, handle) {
    let p1=0, p2=0, p3=0, p4=0;
    const trigger = handle || el;
    const start = (e) => {
        if (type==='orb' && state.lockOrb) return;
        if (type==='win' && state.lockWin) return;
        const evt = e.type === 'touchstart' ? e.touches[0] : e;
        p3 = evt.clientX; p4 = evt.clientY;
        document.ontouchend = stop; document.onmouseup = stop;
        document.ontouchmove = move; document.onmousemove = move;
    };
    const move = (e) => {
        const evt = e.type === 'touchmove' ? e.touches[0] : e;
        if(e.cancelable) e.preventDefault();
        p1 = p3 - evt.clientX; p2 = p4 - evt.clientY;
        p3 = evt.clientX; p4 = evt.clientY;
        el.style.top = (el.offsetTop - p2) + "px";
        el.style.left = (el.offsetLeft - p1) + "px";
        el.style.right = 'auto';
    };
    const stop = () => {
        document.ontouchend = null; document.onmouseup = null;
        document.ontouchmove = null; document.onmousemove = null;
        if (type==='orb') state.btnPos = {top:el.style.top, left:el.style.left, right:'auto'};
        else state.winPos = {top:el.style.top, left:el.style.left};
        saveSettings();
    };
    trigger.onmousedown = start; trigger.ontouchstart = start;
}
