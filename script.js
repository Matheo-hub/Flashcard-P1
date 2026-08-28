// --- 1. INITIALISATION ET DONNÉES (Sécurisées) ---
let folders = [];
let qcms = [];

try {
    folders = JSON.parse(localStorage.getItem('p1_folders'));
    if (!Array.isArray(folders)) folders = [];
} catch(e) { folders = []; }

try {
    qcms = JSON.parse(localStorage.getItem('p1_qcms'));
    if (!Array.isArray(qcms)) qcms = [];
} catch(e) { qcms = []; }

function saveData() {
    localStorage.setItem('p1_folders', JSON.stringify(folders));
    localStorage.setItem('p1_qcms', JSON.stringify(qcms));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

document.addEventListener('DOMContentLoaded', () => {
    updateFolderSelects();
    renderCreateItems();
    renderFoldersView();
});

// --- 2. NAVIGATION ---
function switchTab(tabId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    const targetView = document.getElementById('view-' + tabId);
    if(targetView) targetView.classList.add('active');
    
    const tabs = document.querySelectorAll('.tab');
    if(tabId === 'home' && tabs[0]) tabs[0].classList.add('active');
    if(tabId === 'folders' && tabs[1]) tabs[1].classList.add('active');
    if(tabId === 'create' && tabs[2]) tabs[2].classList.add('active');
    if(tabId === 'settings' && tabs[3]) tabs[3].classList.add('active');
    
    if(tabId === 'folders') renderFoldersView();
    if(tabId === 'create' || tabId === 'home') updateFolderSelects();
}

// --- 3. GESTION DES DOSSIERS & SOUS-DOSSIERS ---
function renderFoldersView() {
    const container = document.getElementById('folders-container');
    if(!container) return;
    container.innerHTML = '';
    
    const rootFolders = folders.filter(f => !f.parentId);
    
    function buildFolderHTML(folder, depth = 0) {
        const children = folders.filter(f => f.parentId === folder.id);
        const folderQCMs = qcms.filter(q => q.folderId === folder.id);
        
        let html = `
            <div class="folder-item" style="margin-left: ${depth * 15}px">
                <div class="folder-header" onclick="toggleFolder('${folder.id}')">
                    <span>${depth > 0 ? '└─ 📁 ' : '📁 '} ${folder.name}</span>
                    <span class="folder-actions" onclick="event.stopPropagation(); openEditFolderModal('${folder.id}')">Modifier</span>
                </div>
                <div class="folder-content" id="content-${folder.id}">
                    ${folderQCMs.map(q => `
                        <div class="qcm-list-item" onclick="openEditQcmModal('${q.id}')">
                            <span>${q.question ? q.question.substring(0, 35) : 'Question vide'}...</span>
                            <span class="folder-actions">Modifier ✎</span>
                        </div>
                    `).join('')}
                    <div id="children-${folder.id}"></div>
                </div>
            </div>
        `;
        return { html, children };
    }

    function renderTree(folderList, parentElementId = null) {
        folderList.forEach(folder => {
            const { html, children } = buildFolderHTML(folder, parentElementId ? 1 : 0);
            if(parentElementId) {
                const parentEl = document.getElementById(`children-${parentElementId}`);
                if(parentEl) parentEl.innerHTML += html;
            } else {
                container.innerHTML += html;
            }
            if(children.length > 0) {
                renderTree(children, folder.id);
            }
        });
    }
    renderTree(rootFolders);
}

function toggleFolder(folderId) {
    const el = document.getElementById(`content-${folderId}`);
    if(el) el.classList.toggle('open');
}

let currentEditFolderId = null;
function showFolderModal() {
    currentEditFolderId = null;
    document.getElementById('modal-folder-title').innerText = "Nouveau dossier / sous-dossier";
    document.getElementById('modal-folder-name').value = "";
    populateParentSelect();
    document.getElementById('modal-folder').classList.remove('hidden');
}

function openEditFolderModal(folderId) {
    currentEditFolderId = folderId;
    const folder = folders.find(f => f.id === folderId);
    if(!folder) return;
    document.getElementById('modal-folder-title').innerText = "Modifier le dossier";
    document.getElementById('modal-folder-name').value = folder.name;
    populateParentSelect(folderId);
    document.getElementById('modal-folder-parent').value = folder.parentId || "";
    document.getElementById('modal-folder').classList.remove('hidden');
}

function populateParentSelect(excludeId = null) {
    const select = document.getElementById('modal-folder-parent');
    if(!select) return;
    select.innerHTML = '<option value="">Aucun (Dossier racine)</option>';
    folders.forEach(f => {
        if(f.id !== excludeId) {
            select.innerHTML += `<option value="${f.id}">${f.name}</option>`;
        }
    });
}

function closeFolderModal() { 
    document.getElementById('modal-folder').classList.add('hidden'); 
}

function saveFolderModal() {
    const name = document.getElementById('modal-folder-name').value;
    const parentId = document.getElementById('modal-folder-parent').value;
    if(!name) return;
    
    if(currentEditFolderId) {
        const f = folders.find(f => f.id === currentEditFolderId);
        if(f) { f.name = name; f.parentId = parentId || null; }
    } else {
        folders.push({ id: generateId(), name, parentId: parentId || null });
    }
    saveData(); closeFolderModal(); renderFoldersView(); updateFolderSelects();
}

function deleteFolderModal() {
    if(!currentEditFolderId) return;
    if(confirm("Supprimer ce dossier (et ses sous-dossiers/QCM) ?")) {
        folders = folders.filter(f => f.id !== currentEditFolderId && f.parentId !== currentEditFolderId);
        qcms = qcms.filter(q => q.folderId !== currentEditFolderId);
        saveData(); closeFolderModal(); renderFoldersView(); updateFolderSelects();
    }
}

function updateFolderSelects() {
    let options = '<option value="all">Toutes les matières (Mélange général)</option>';
    let createOptions = '';
    folders.forEach(f => {
        const prefix = f.parentId ? '└─ ' : '';
        const opt = `<option value="${f.id}">${prefix}${f.name}</option>`;
        options += opt; createOptions += opt;
    });
    
    const homeSel = document.getElementById('home-folder-select');
    const createSel = document.getElementById('create-folder-select');
    const fastSel = document.getElementById('fast-add-folder-select');
    const editSel = document.getElementById('edit-qcm-folder');
    
    if(homeSel) homeSel.innerHTML = options;
    if(createSel) createSel.innerHTML = createOptions;
    if(fastSel) fastSel.innerHTML = createOptions;
    if(editSel) editSel.innerHTML = createOptions;
}

// --- 4. GESTION DES QCM (Création, Ajout Rapide & Modification) ---
function renderCreateItems() {
    const container = document.getElementById('create-items-container');
    if(!container) return;
    container.innerHTML = ['A', 'B', 'C', 'D', 'E'].map(l => `
        <div style="display:flex; align-items:center; margin-bottom:10px;">
            <input type="checkbox" id="check-${l}" style="width:20px; height:20px; margin-right:10px;">
            <input type="text" id="item-${l}" placeholder="Item ${l}">
        </div>
    `).join('');
}

function saveNewQCM() {
    const folderId = document.getElementById('create-folder-select').value;
    const question = document.getElementById('create-question').value;
    if(!question || !folderId) return alert("Remplis la question et choisis un dossier.");
    const options = [];
    ['A', 'B', 'C', 'D', 'E'].forEach(l => {
        const textEl = document.getElementById(`item-${l}`);
        const checkEl = document.getElementById(`check-${l}`);
        if(textEl && checkEl && textEl.value) {
            options.push({ text: textEl.value, isCorrect: checkEl.checked, letter: l });
        }
    });
    qcms.push({ id: generateId(), folderId, question, options, attempts: 0, successes: 0, lastPlayed: null });
    saveData();
    
    document.getElementById('create-question').value = '';
    ['A', 'B', 'C', 'D', 'E'].forEach(l => {
        if(document.getElementById(`item-${l}`)) document.getElementById(`item-${l}`).value = '';
        if(document.getElementById(`check-${l}`)) document.getElementById(`check-${l}`).checked = false;
    });
    alert("QCM Enregistré !");
}

function fastAddQCM() {
    const folderId = document.getElementById('fast-add-folder-select').value;
    const text = document.getElementById('fast-add-textarea').value;
    if(!folderId || !text) return alert("Choisis un dossier et remplis le texte.");
    
    const lines = text.split('\n');
    let addedCount = 0;
    
    lines.forEach(line => {
        if(line.trim() === '') return;
        // Supporte à la fois le point-virgule (;) et le deux-points (:)
        const parts = line.split(/[;:]/).map(p => p.trim());
        if(parts.length >= 7) {
            const question = parts[0];
            const correctStr = parts[6].toUpperCase();
            const options = [];
            
            ['A', 'B', 'C', 'D', 'E'].forEach((letter, index) => {
                const itemText = parts[index + 1];
                if(itemText) {
                    options.push({ text: itemText, letter: letter, isCorrect: correctStr.includes(letter) });
                }
            });
            qcms.push({ id: generateId(), folderId, question, options, attempts: 0, successes: 0, lastPlayed: null });
            addedCount++;
        }
    });
    saveData();
    document.getElementById('fast-add-textarea').value = '';
    alert(`${addedCount} QCM ajouté(s) avec succès !`);
}

let currentEditQcmId = null;
function openEditQcmModal(qcmId) {
    currentEditQcmId = qcmId;
    const qcm = qcms.find(q => q.id === qcmId);
    if(!qcm) return;
    
    document.getElementById('edit-qcm-question').value = qcm.question;
    updateFolderSelects(); 
    document.getElementById('edit-qcm-folder').value = qcm.folderId;
    
    const optionsSafe = qcm.options || [];
    ['A','B','C','D','E'].forEach(letter => {
        const opt = optionsSafe.find(o => o.letter === letter);
        const el = document.getElementById(`edit-qcm-${letter.toLowerCase()}`);
        if(el) el.value = opt ? opt.text : '';
    });
    
    const corrects = optionsSafe.filter(o => o.isCorrect).map(o => o.letter).join(',');
    document.getElementById('edit-qcm-answers').value = corrects;
    
    document.getElementById('modal-edit-qcm').classList.remove('hidden');
}

function closeEditQcmModal() { 
    document.getElementById('modal-edit-qcm').classList.add('hidden'); 
}

function saveEditQcm() {
    const qcm = qcms.find(q => q.id === currentEditQcmId);
    if(!qcm) return;
    
    qcm.question = document.getElementById('edit-qcm-question').value;
    qcm.folderId = document.getElementById('edit-qcm-folder').value;
    const corrects = document.getElementById('edit-qcm-answers').value.toUpperCase();
    
    qcm.options = [];
    ['A','B','C','D','E'].forEach(letter => {
        const el = document.getElementById(`edit-qcm-${letter.toLowerCase()}`);
        if(el && el.value) {
            qcm.options.push({ letter: letter, text: el.value, isCorrect: corrects.includes(letter) });
        }
    });
    
    saveData();
    closeEditQcmModal();
    renderFoldersView();
}

function deleteQcm() {
    if(confirm("Supprimer définitivement ce QCM ?")) {
        qcms = qcms.filter(q => q.id !== currentEditQcmId);
        saveData();
        closeEditQcmModal();
        renderFoldersView();
    }
}

// --- 5. MOTEUR D'ENTRAÎNEMENT ---
let currentSession = [], currentQuestionIndex = 0, sessionMode = 'training';
let sessionStats = { totalTime: 0, overtime: 0, answers: [] };
let globalTimerInterval, localTimerInterval, localTimeElapsed = 0;

function startCustomSession(type) {
    if(!qcms || qcms.length === 0) return alert("Aucun QCM disponible.");
    let selectedQcms = [...qcms];
    if (type === 'oldest') {
        selectedQcms.sort((a, b) => (a.lastPlayed || 0) - (b.lastPlayed || 0));
    } else if (type === 'worst') {
        selectedQcms.sort((a, b) => {
            const rateA = a.attempts ? (a.successes / a.attempts) : 0;
            const rateB = b.attempts ? (b.successes / b.attempts) : 0;
            return rateA - rateB;
        });
    }
    currentSession = selectedQcms.slice(0, 20);
    sessionMode = 'training';
    launchUI();
}

function startSession() {
    const folderId = document.getElementById('home-folder-select').value;
    sessionMode = document.getElementById('home-mode-select').value;
    
    let count = parseInt(document.getElementById('home-qcm-count').value);
    if (isNaN(count) || count <= 0) count = 20;
    
    let pool = folderId === 'all' ? [...qcms] : qcms.filter(q => q.folderId === folderId);
    if(!pool || pool.length === 0) return alert("Aucun QCM dans ce dossier.");
    
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    
    currentSession = sessionMode === 'exam' ? pool.slice(0, count) : pool;
    launchUI();
}

function launchUI() {
    if(!currentSession || currentSession.length === 0) return alert("Erreur lors de la création de la session.");
    
    currentQuestionIndex = 0;
    sessionStats = { totalTime: 0, overtime: 0, answers: [] };
    
    const qcmView = document.getElementById('view-qcm');
    qcmView.classList.remove('hidden');
    qcmView.classList.add('active');
    
    document.getElementById('qcm-mode-title').innerText = sessionMode === 'exam' ? 'Examen P1' : 'Entraînement P1';
    startGlobalTimer();
    renderQuestion();
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function startGlobalTimer() {
    clearInterval(globalTimerInterval);
    globalTimerInterval = setInterval(() => {
        sessionStats.totalTime++;
        const el = document.getElementById('qcm-global-time');
        if(el) el.innerText = formatTime(sessionStats.totalTime);
    }, 1000);
}

function renderQuestion() {
    const q = currentSession[currentQuestionIndex];
    if (!q || !q.options) {
        alert("Ce QCM semble incomplet. Passage au suivant.");
        return nextQuestion();
    }
    
    document.getElementById('qcm-progress-text').innerText = `Question ${currentQuestionIndex + 1} sur ${currentSession.length}`;
    document.getElementById('qcm-progress-fill').style.width = `${((currentQuestionIndex + 1) / currentSession.length) * 100}%`;
    document.getElementById('qcm-question-text').innerText = q.question;
    
    const container = document.getElementById('qcm-options-container');
    container.innerHTML = q.options.map((opt, i) => `
        <div class="qcm-option" id="opt-${i}" onclick="toggleOption(${i})">
            <div class="option-letter">${opt.letter}</div>
            <div>${opt.text}</div>
        </div>
    `).join('');

    document.getElementById('qcm-validate-btn').classList.remove('hidden');
    document.getElementById('qcm-next-btn').classList.add('hidden');
    document.getElementById('qcm-back-to-summary-btn').classList.add('hidden');

    localTimeElapsed = 0;
    clearInterval(localTimerInterval);
    const localDisplay = document.getElementById('qcm-local-timer');
    localDisplay.classList.remove('timer-danger');
    
    if (sessionMode !== 'readonly') {
        localTimerInterval = setInterval(() => {
            localTimeElapsed++;
            const timeLeft = 80 - localTimeElapsed;
            if (timeLeft >= 0) {
                localDisplay.innerText = formatTime(timeLeft);
            } else {
                localDisplay.classList.add('timer-danger');
                localDisplay.innerText = "+" + formatTime(Math.abs(timeLeft));
                sessionStats.overtime++;
            }
        }, 1000);
    } else {
        localDisplay.innerText = "--:--";
        showCorrection(q);
    }
}

function toggleOption(index) {
    const nextBtn = document.getElementById('qcm-next-btn');
    if(nextBtn && nextBtn.classList.contains('hidden') && sessionMode !== 'readonly') {
        const opt = document.getElementById(`opt-${index}`);
        if(opt) opt.classList.toggle('selected');
    }
}

function validateQuestion() {
    clearInterval(localTimerInterval);
    const q = currentSession[currentQuestionIndex];
    if(!q || !q.options) return nextQuestion();
    
    let isFullyCorrect = true, isPartiallyCorrect = false, hasMistake = false;

    q.options.forEach((opt, i) => {
        const el = document.getElementById(`opt-${i}`);
        if(!el) return;
        const isSelected = el.classList.contains('selected');
        
        if (isSelected && opt.isCorrect) isPartiallyCorrect = true;
        if (isSelected !== opt.isCorrect) {
            isFullyCorrect = false;
            if(isSelected && !opt.isCorrect) hasMistake = true;
        }
    });

    let status = isFullyCorrect ? 'correct' : (hasMistake ? 'wrong' : 'partial');
    
    const dbQcm = qcms.find(x => x.id === q.id);
    if(dbQcm && sessionMode !== 'readonly') {
        dbQcm.lastPlayed = Date.now();
        dbQcm.attempts = (dbQcm.attempts || 0) + 1;
        if(isFullyCorrect) dbQcm.successes = (dbQcm.successes || 0) + 1;
        saveData();
    }

    sessionStats.answers.push({ 
        status: status, 
        selections: q.options.map((o,i) => {
            const el = document.getElementById(`opt-${i}`);
            return el ? el.classList.contains('selected') : false;
        })
    });

    if (sessionMode === 'training') {
        showCorrection(q);
        document.getElementById('qcm-validate-btn').classList.add('hidden');
        document.getElementById('qcm-next-btn').classList.remove('hidden');
    } else {
        nextQuestion();
    }
}

function showCorrection(q) {
    if(!q || !q.options) return;
    q.options.forEach((opt, i) => {
        const el = document.getElementById(`opt-${i}`);
        if(!el) return;
        
        if(sessionMode === 'readonly' && sessionStats.answers[currentQuestionIndex] && sessionStats.answers[currentQuestionIndex].selections[i]) {
            el.classList.add('selected');
        }
        
        if (opt.isCorrect) {
            el.classList.add('correct');
        } else if (el.classList.contains('selected')) {
            el.classList.add('wrong');
        }
    });
    
    if(sessionMode === 'readonly') {
        document.getElementById('qcm-validate-btn').classList.add('hidden');
        document.getElementById('qcm-back-to-summary-btn').classList.remove('hidden');
    }
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentSession.length) renderQuestion();
    else finishSession();
}

function finishSession() {
    clearInterval(globalTimerInterval); clearInterval(localTimerInterval);
    
    const qcmView = document.getElementById('view-qcm');
    qcmView.classList.remove('active');
    qcmView.classList.add('hidden');
    
    const summaryView = document.getElementById('view-summary');
    summaryView.classList.remove('hidden');
    summaryView.classList.add('active');
    
    let correctCount = sessionStats.answers.filter(a => a.status === 'correct').length;
    document.getElementById('summary-score').innerText = `${correctCount} / ${currentSession.length}`;
    document.getElementById('summary-time').innerText = formatTime(sessionStats.totalTime);
    document.getElementById('summary-overtime').innerText = formatTime(sessionStats.overtime);
    
    const grid = document.getElementById('summary-grid');
    if(grid) {
        grid.innerHTML = sessionStats.answers.map((ans, i) => `
            <div class="summary-box ${ans.status}" onclick="reviewQuestion(${i})">${i + 1}</div>
        `).join('');
    }
}

function reviewQuestion(index) {
    const summaryView = document.getElementById('view-summary');
    summaryView.classList.remove('active');
    summaryView.classList.add('hidden');
    
    const qcmView = document.getElementById('view-qcm');
    qcmView.classList.remove('hidden');
    qcmView.classList.add('active');
    
    const previousMode = sessionMode;
    sessionMode = 'readonly';
    currentQuestionIndex = index;
    renderQuestion();
    sessionMode = previousMode;
}

function backToSummary() {
    const qcmView = document.getElementById('view-qcm');
    qcmView.classList.remove('active');
    qcmView.classList.add('hidden');
    
    const summaryView = document.getElementById('view-summary');
    summaryView.classList.remove('hidden');
    summaryView.classList.add('active');
}

function quitSession() {
    clearInterval(globalTimerInterval); clearInterval(localTimerInterval);
    
    const qcmView = document.getElementById('view-qcm');
    if(qcmView) {
        qcmView.classList.remove('active');
        qcmView.classList.add('hidden');
    }
    
    const summaryView = document.getElementById('view-summary');
    if(summaryView) {
        summaryView.classList.remove('active');
        summaryView.classList.add('hidden');
    }
}

// --- 6. EXPORT / IMPORT (Fusion) / RESET ---
function exportData(includeStats) {
    let dataToExport = { folders: folders, qcms: qcms };
    if (!includeStats) {
        dataToExport = JSON.parse(JSON.stringify(dataToExport));
        dataToExport.qcms.forEach(q => { q.attempts = 0; q.successes = 0; q.lastPlayed = null; });
    }
    
    const dataStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const dl = document.createElement('a');
    dl.href = url;
    dl.download = includeStats ? "QCM_P1_Backup.json" : "QCM_P1_Partage.json";
    document.body.appendChild(dl); 
    dl.click(); 
    document.body.removeChild(dl);
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if(imported.folders && imported.qcms) {
                
                imported.folders.forEach(impFolder => {
                    const existingFolder = folders.find(f => f.name.toLowerCase() === impFolder.name.toLowerCase());
                    if (!existingFolder) {
                        folders.push(impFolder);
                    } else {
                        impFolder.oldId = impFolder.id;
                        impFolder.id = existingFolder.id;
                    }
                });

                imported.qcms.forEach(impQcm => {
                    const exists = qcms.some(q => q.question.trim().toLowerCase() === impQcm.question.trim().toLowerCase());
                    if (!exists) {
                        const matchingFolder = folders.find(f => f.id === impQcm.folderId || f.oldId === impQcm.folderId);
                        if (matchingFolder) {
                            impQcm.folderId = matchingFolder.id;
                        }
                        qcms.push(impQcm);
                    }
                });

                saveData();
                alert('Importation et fusion réussies !');
                location.reload();
            } else {
                alert("Fichier non reconnu.");
            }
        } catch(err) {
            alert('Fichier invalide.');
        }
    };
    reader.readAsText(file);
}

function clearAllData() {
    if(confirm("ATTENTION : Es-tu sûr de vouloir tout supprimer ? Action irréversible.")) {
        localStorage.removeItem('p1_folders'); localStorage.removeItem('p1_qcms'); location.reload();
    }
}
