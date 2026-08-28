let db = JSON.parse(localStorage.getItem('flashcards_db_p1')) || { folders: [] };
let currentImageBase64 = null;
let editingCardInfo = null; // Stocke { folderId, cardId } si on modifie une carte

let reviewQueue = [];
let currentQueueIndex = 0;
let sessionCardsSeen = 0; 
let sessionTotalCards = 0;
let timerInterval;
let secondsElapsed = 0;
let touchStartX = 0;
let isReviewActive = false;

document.addEventListener("DOMContentLoaded", () => {
    updateDropdowns();
    renderFoldersList();
});

// --- NAVIGATION ---
function switchTab(tabId, element) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    if (tabId === 'tab-accueil' || tabId === 'tab-creer') updateDropdowns();
    if (tabId === 'tab-dossiers') renderFoldersList();

    // Réinitialise le mode édition quand on quitte l'onglet Créer
    if (tabId !== 'tab-creer') {
        editingCardInfo = null;
        document.getElementById('create-mode-title').innerText = "Ajout Classique";
        document.getElementById('btn-save-manual').innerText = "ENREGISTRER LA CARTE";
    }
}

// --- GESTION DOSSIERS ET SOUS-DOSSIERS ---
function saveDB() {
    localStorage.setItem('flashcards_db_p1', JSON.stringify(db));
}

function updateDropdowns() {
    const selects = ['select-session-folder', 'select-create-folder', 'select-express-folder'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = id === 'select-session-folder' ? '<option value="global">Toutes les matières (Mélange général)</option>' : '';
        
        db.folders.forEach(f => {
            const prefix = f.parentId ? "— " : ""; // Indique visuellement un sous-dossier
            el.innerHTML += `<option value="${f.id}">${prefix}${f.name}</option>`;
        });
    });
}

function createFolder() {
    openFolderModal();
}

function openFolderModal(existingId = null) {
    const folder = existingId ? db.folders.find(f => f.id === existingId) : null;
    const defaultName = folder ? folder.name : "";
    
    let options = `<option value="none">Aucun (Dossier principal)</option>`;
    db.folders.forEach(f => {
        if (existingId && f.id === existingId) return; // Empêche de se mettre dans soi-même
        const selected = (folder && folder.parentId === f.id) ? "selected" : "";
        options += `<option value="${f.id}" ${selected}>${f.name}</option>`;
    });

    const modalHTML = `
        <div id="custom-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:999; display:flex; justify-content:center; align-items:center; padding:20px;">
            <div style="background:var(--card-bg); padding:20px; border-radius:16px; width:100%; max-width:400px; border:1px solid var(--card-border);">
                <h3 style="margin-bottom:15px; color:white;">${existingId ? 'Modifier le dossier' : 'Nouveau dossier'}</h3>
                <input type="text" id="modal-folder-name" class="textarea-input mb-3" placeholder="Nom du dossier" value="${defaultName}">
                <label style="color:var(--text-muted); font-size:0.9rem; margin-bottom:5px; display:block;">Emplacement (Sous-dossier de :)</label>
                <select id="modal-folder-parent" class="select-input mb-4">${options}</select>
                <div style="display:flex; gap:10px;">
                    <button class="btn-outline w-100" onclick="document.getElementById('custom-modal').remove()">Annuler</button>
                    <button class="btn-primary w-100" onclick="confirmFolderModal(${existingId})">Enregistrer</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function confirmFolderModal(existingId) {
    const name = document.getElementById('modal-folder-name').value.trim();
    const parentVal = document.getElementById('modal-folder-parent').value;
    const parentId = parentVal === "none" ? null : parseFloat(parentVal);

    if (!name) return alert("Le nom est obligatoire.");

    if (existingId) {
        const folder = db.folders.find(f => f.id === existingId);
        folder.name = name;
        folder.parentId = parentId;
    } else {
        db.folders.push({ id: Date.now(), name: name, parentId: parentId, cards: [], expanded: false });
    }

    document.getElementById('custom-modal').remove();
    saveDB();
    renderFoldersList();
    updateDropdowns();
}

function renderFoldersList() {
    const container = document.getElementById('folders-container');
    container.innerHTML = '';
    
    if (db.folders.length === 0) {
        container.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center;">Aucun dossier créé.</div>';
        return;
    }

    // Affiche d'abord les dossiers principaux, puis leurs sous-dossiers
    const rootFolders = db.folders.filter(f => !f.parentId);
    
    rootFolders.forEach(folder => {
        renderSingleFolder(folder, container, 0);
        const children = db.folders.filter(f => f.parentId === folder.id);
        children.forEach(child => renderSingleFolder(child, container, 20)); // Décale de 20px
    });
}

function renderSingleFolder(folder, container, indent) {
    const folderDiv = document.createElement('div');
    const count = folder.cards ? folder.cards.length : 0;
    const icon = folder.parentId ? "↳" : "📁";
    
    folderDiv.innerHTML = `
        <div class="folder-item" style="padding-left: ${indent + 20}px;">
            <div class="folder-info" onclick="toggleFolder(${folder.id})" style="flex:1;">
                ${icon} ${folder.name} <span style="font-size:0.9rem; color:var(--text-muted); font-weight:normal;">(${count})</span>
            </div>
            <div class="folder-action" onclick="openFolderModal(${folder.id})">⚙️</div>
            <div class="folder-action" onclick="deleteFolder(${folder.id}, event)" style="color:var(--danger); margin-left:15px;">✕</div>
        </div>
    `;

    if (folder.expanded) {
        if (count === 0) {
            folderDiv.innerHTML += `<div class="card-item" style="justify-content:center; padding-left: ${indent + 40}px;">Dossier vide</div>`;
        } else {
            folder.cards.forEach(card => {
                folderDiv.innerHTML += `
                    <div class="card-item" style="padding-left: ${indent + 45}px;" onclick="editCard(${folder.id}, ${card.id})">
                        <span style="flex:1;">${card.q.substring(0, 30) || '[Image]'}</span>
                        <span class="card-delete" onclick="deleteCard(${folder.id}, ${card.id}, event)">✕</span>
                    </div>
                `;
            });
        }
    }
    container.appendChild(folderDiv);
}

function toggleFolder(id) {
    const folder = db.folders.find(f => f.id === id);
    folder.expanded = !folder.expanded;
    renderFoldersList();
}

function deleteFolder(id, event) {
    event.stopPropagation();
    if (confirm("Supprimer ce dossier et TOUTES ses cartes ?")) {
        // Supprime le dossier ET ses sous-dossiers
        db.folders = db.folders.filter(f => f.id !== id && f.parentId !== id);
        saveDB(); renderFoldersList(); updateDropdowns();
    }
}

function deleteCard(folderId, cardId, event) {
    event.stopPropagation();
    if (confirm("Supprimer définitivement cette flashcard ?")) {
        const folder = db.folders.find(f => f.id === folderId);
        folder.cards = folder.cards.filter(c => c.id !== cardId);
        saveDB(); renderFoldersList();
    }
}

// --- ÉDITION & CRÉATION DE CARTES ---
function editCard(folderId, cardId) {
    const folder = db.folders.find(f => f.id === folderId);
    const card = folder.cards.find(c => c.id === cardId);
    
    editingCardInfo = { folderId, cardId };
    
    document.getElementById('select-create-folder').value = folderId;
    document.getElementById('card-q-input').value = card.q;
    document.getElementById('card-a-input').value = card.a;
    currentImageBase64 = card.img || null;
    
    document.getElementById('create-mode-title').innerText = "Modifier la carte";
    document.getElementById('btn-save-manual').innerText = "METTRE À JOUR LA CARTE";
    
    // Bascule sur l'onglet créer
    switchTab('tab-creer', document.querySelectorAll('.tab-item')[2]);
}

document.getElementById('card-image-input').addEventListener('change', function(e) {
    if (e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function(event) { currentImageBase64 = event.target.result; };
        reader.readAsDataURL(e.target.files[0]);
    }
});

function saveManualCard() {
    const folderId = document.getElementById('select-create-folder').value;
    if (!folderId) return alert("Veuillez d'abord créer un dossier !");

    const q = document.getElementById('card-q-input').value.trim();
    const a = document.getElementById('card-a-input').value.trim();
    if (!q && !currentImageBase64) return alert("Il faut au moins une question ou une image !");
    if (!a) return alert("La réponse est obligatoire !");

    const folder = db.folders.find(f => f.id == folderId);
    
    if (editingCardInfo) {
        // Mode Édition
        const targetFolder = db.folders.find(f => f.id == editingCardInfo.folderId);
        const cardIndex = targetFolder.cards.findIndex(c => c.id == editingCardInfo.cardId);
        
        // Si l'utilisateur a changé le dossier cible pendant la modification
        if (editingCardInfo.folderId != folderId) {
            const cardToMove = targetFolder.cards.splice(cardIndex, 1)[0];
            cardToMove.q = q; cardToMove.a = a; cardToMove.img = currentImageBase64;
            folder.cards.push(cardToMove);
        } else {
            targetFolder.cards[cardIndex].q = q;
            targetFolder.cards[cardIndex].a = a;
            targetFolder.cards[cardIndex].img = currentImageBase64;
        }
        editingCardInfo = null;
        document.getElementById('create-mode-title').innerText = "Ajout Classique";
        document.getElementById('btn-save-manual').innerText = "ENREGISTRER LA CARTE";
        alert("Carte modifiée avec succès !");
    } else {
        // Mode Création
        folder.cards.push({ id: Date.now(), createdAt: Date.now(), q: q, a: a, img: currentImageBase64, correct: 0, wrong: 0 });
        alert("Flashcard enregistrée !");
    }
    
    saveDB();
    document.getElementById('card-q-input').value = "";
    document.getElementById('card-a-input').value = "";
    document.getElementById('card-image-input').value = "";
    currentImageBase64 = null;
}

function saveExpressCards() {
    const folderId = document.getElementById('select-express-folder').value;
    if (!folderId) return alert("Veuillez d'abord créer un dossier !");

    const text = document.getElementById('express-textarea').value.trim();
    if (!text) return alert("Le champ d'ajout rapide est vide !");

    const lines = text.split('\n');
    let addedCount = 0;
    const folder = db.folders.find(f => f.id == folderId);

    lines.forEach(line => {
        const parts = line.split(';'); // Utilisation stricte du point-virgule
        if (parts.length >= 2) {
            const q = parts[0].trim();
            const a = parts.slice(1).join(';').trim(); 
            if (q && a) {
                folder.cards.push({ id: Date.now() + Math.random(), createdAt: Date.now(), q: q, a: a, img: null, correct: 0, wrong: 0 });
                addedCount++;
            }
        }
    });

    if (addedCount > 0) {
        saveDB();
        document.getElementById('express-textarea').value = "";
        alert(`${addedCount} flashcards ajoutées avec succès !`);
    } else {
        alert("Format invalide. Séparez la question et la réponse par un point-virgule ';'.");
    }
}

// --- FIX EXPORT IOS NATIVE SHARE ---
function exportData(withStats) {
    let dataToExport = JSON.parse(JSON.stringify(db)); 
    if (!withStats) {
        dataToExport.folders.forEach(f => {
            if(f.cards) f.cards.forEach(c => { c.correct = 0; c.wrong = 0; });
        });
    }
    
    const jsonStr = JSON.stringify(dataToExport);
    const fileName = withStats ? "flashcards_backup.json" : "flashcards_partage.json";
    const file = new File([jsonStr], fileName, { type: "application/json" });

    // Force le menu de partage natif iOS si on est en mode Web App Plein écran
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
            files: [file],
            title: fileName,
            text: 'Voici mes flashcards !'
        }).catch(err => console.log('Partage annulé', err));
    } else {
        // Fallback pour navigateur classique
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const dl = document.createElement('a');
        dl.href = url;
        dl.download = fileName;
        document.body.appendChild(dl);
        dl.click();
        document.body.removeChild(dl);
        URL.revokeObjectURL(url);
    }
}

function importData(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedDB = JSON.parse(e.target.result);
                if (importedDB && importedDB.folders) {
                    importedDB.folders.forEach(importedFolder => {
                        importedFolder.id = Date.now() + Math.random(); 
                        importedFolder.expanded = false;
                        if(importedFolder.cards) importedFolder.cards.forEach(c => c.id = Date.now() + Math.random());
                        db.folders.push(importedFolder);
                    });
                    saveDB(); updateDropdowns(); renderFoldersList();
                    alert("Dossiers importés avec succès !");
                }
            } catch (err) { alert("Erreur : Fichier invalide."); }
        };
        reader.readAsText(file);
    }
}

function resetData() {
    if (confirm("⚠️ Action irréversible. Effacer toutes les données ?")) {
        db = { folders: [] };
        saveDB(); updateDropdowns(); renderFoldersList();
        alert("Application réinitialisée.");
    }
}

// --- MOTEUR DE RÉVISION ---
function startSession() {
    const targetId = document.getElementById('select-session-folder').value;
    let cardsToReview = [];
    
    if (targetId === 'global') {
        db.folders.forEach(f => { if(f.cards) cardsToReview.push(...f.cards); });
    } else {
        const folder = db.folders.find(f => f.id == targetId);
        if (folder && folder.cards) cardsToReview = [...folder.cards];
    }

    if (cardsToReview.length === 0) return alert("Aucune carte à réviser !");

    reviewQueue = cardsToReview.sort(() => Math.random() - 0.5);
    currentQueueIndex = 0;
    sessionTotalCards = reviewQueue.length; 
    sessionCardsSeen = 1; 
    isReviewActive = true;
    
    document.getElementById('view-review').classList.add('active');
    startTimer(); loadCardToUI();
}

function closeReview() {
    isReviewActive = false;
    document.getElementById('view-review').classList.remove('active');
    clearInterval(timerInterval);
}

function startTimer() {
    secondsElapsed = 0;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        secondsElapsed++;
        const m = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const s = String(secondsElapsed % 60).padStart(2, '0');
        document.getElementById('review-timer').innerText = `${m}:${s}`;
    }, 1000);
}

function loadCardToUI() {
    document.getElementById('review-counter').innerText = `${sessionCardsSeen}/${sessionTotalCards}`;
    const cardData = reviewQueue[currentQueueIndex];
    const fc = document.getElementById('flashcard');
    
    fc.classList.remove('is-flipped', 'swipe-right-preview', 'swipe-left-preview');
    document.getElementById('review-controls').classList.remove('visible');
    document.getElementById('btn-reveal').style.display = 'block';
    fc.style.transform = '';

    document.getElementById('view-q-text').innerText = cardData.q;
    const imgElQ = document.getElementById('view-q-img');
    if (cardData.img) { imgElQ.src = cardData.img; imgElQ.style.display = 'block'; } 
    else { imgElQ.style.display = 'none'; }

    document.getElementById('view-q-reminder').innerText = cardData.q || "[Image]";
    document.getElementById('view-a-text').innerText = cardData.a;
}

function revealAnswer() {
    document.getElementById('flashcard').classList.add('is-flipped');
    document.getElementById('review-controls').classList.add('visible');
    document.getElementById('btn-reveal').style.display = 'none';
}

function handleAnswer(isCorrect) {
    if (!isReviewActive) return;
    const currentCard = reviewQueue[currentQueueIndex];
    let realCard = null;
    db.folders.forEach(f => {
        if(f.cards) { const found = f.cards.find(c => c.id === currentCard.id); if(found) realCard = found; }
    });

    if (realCard) {
        if (isCorrect) realCard.correct++;
        else {
            realCard.wrong++;
            reviewQueue.splice(currentQueueIndex + 5, 0, currentCard);
            sessionTotalCards++; 
        }
        saveDB();
    }

    sessionCardsSeen++;
    currentQueueIndex++;
    
    if (currentQueueIndex >= reviewQueue.length) {
        const targetId = document.getElementById('select-session-folder').value;
        let pool = [];
        if (targetId === 'global') {
            db.folders.forEach(f => { if(f.cards) pool.push(...f.cards); });
        } else {
            const folder = db.folders.find(f => f.id == targetId);
            if(folder && folder.cards) pool = [...folder.cards];
        }
        reviewQueue = reviewQueue.concat(pool.sort(() => Math.random() - 0.5));
        sessionTotalCards += pool.length; 
    }

    const fc = document.getElementById('flashcard');
    fc.style.transform = isCorrect ? 'translateX(100vw) rotateY(180deg)' : 'translateX(-100vw) rotateY(180deg)';
    setTimeout(() => { loadCardToUI(); }, 300);
}

// --- TACTILE & CLAVIER ---
const flashcard = document.getElementById('flashcard');
flashcard.addEventListener('click', function(e) {
    if (e.target.id === 'btn-reveal') return; 
    if (!this.classList.contains('is-flipped')) revealAnswer();
});

flashcard.addEventListener('touchstart', e => {
    if (!flashcard.classList.contains('is-flipped')) return; 
    touchStartX = e.changedTouches[0].screenX;
});
flashcard.addEventListener('touchmove', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    const diff = e.changedTouches[0].screenX - touchStartX;
    flashcard.style.transform = `rotateY(180deg) translateX(${diff}px) rotateZ(${diff * 0.05}deg)`;
    if (diff > 50) { flashcard.classList.add('swipe-right-preview'); flashcard.classList.remove('swipe-left-preview'); } 
    else if (diff < -50) { flashcard.classList.add('swipe-left-preview'); flashcard.classList.remove('swipe-right-preview'); } 
    else { flashcard.classList.remove('swipe-right-preview', 'swipe-left-preview'); }
});
flashcard.addEventListener('touchend', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    const diff = e.changedTouches[0].screenX - touchStartX;
    flashcard.classList.remove('swipe-right-preview', 'swipe-left-preview');
    if (diff > 100) handleAnswer(true);
    else if (diff < -100) handleAnswer(false);
    else flashcard.style.transform = 'rotateY(180deg)';
});
document.addEventListener('keydown', (e) => {
    if (!isReviewActive) return;
    const fc = document.getElementById('flashcard');
    if (e.code === 'Space') { e.preventDefault(); if (!fc.classList.contains('is-flipped')) revealAnswer(); }
    if (fc.classList.contains('is-flipped')) {
        if (e.code === 'ArrowRight') handleAnswer(true);
        else if (e.code === 'ArrowLeft') handleAnswer(false);
    }
});
