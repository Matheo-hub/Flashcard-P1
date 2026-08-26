let db = JSON.parse(localStorage.getItem('flashcards_db')) || { folders: [] };
let currentFolderId = null;
let currentImageBase64 = null;

let reviewQueue = [];
let currentQueueIndex = 0;
let cardsReviewedCount = 0;
let reviewMode = 'global'; 

let touchStartX = 0;
let touchEndX = 0;

function switchView(viewId) {
    document.querySelectorAll('.view, .view-fullscreen').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    if(viewId === 'view-home') document.querySelectorAll('.tab-item')[0].classList.add('active');

    if (viewId === 'view-home') renderFolders();
}

// Gestion des dossiers
function createFolder() {
    const name = prompt("Nom du nouveau dossier :");
    if (name) {
        db.folders.push({ id: Date.now(), name: name, cards: [] });
        saveDB();
        renderFolders();
    }
}

function renderFolders() {
    const list = document.getElementById('folders-list');
    list.innerHTML = '';
    db.folders.forEach(folder => {
        const total = folder.cards.length;
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `
            <div style="flex:1" onclick="openFolder(${folder.id})">
                <div class="list-item-title">${folder.name}</div>
                <div class="list-item-stats">${total} cartes</div>
            </div>
            <button class="btn-icon" onclick="deleteFolder(${folder.id}, event)">✕</button>
        `;
        list.appendChild(el);
    });
}

function openFolder(id) {
    currentFolderId = id;
    renderCards();
    switchView('view-folder');
}

function deleteFolder(id, event) {
    event.stopPropagation();
    if (confirm("Supprimer ce dossier ?")) {
        db.folders = db.folders.filter(f => f.id !== id);
        saveDB();
        renderFolders();
    }
}

// Gestion des Vues de Création (Manuel ou Express)
function showCreateView(type) {
    if (type === 'manual') {
        document.getElementById('card-image-input').value = "";
        document.getElementById('card-q-input').value = "";
        document.getElementById('card-a-input').value = "";
        currentImageBase64 = null;
        switchView('view-create-manual');
    } else {
        document.getElementById('express-textarea').value = "";
        switchView('view-create-express');
    }
}

document.getElementById('card-image-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) { currentImageBase64 = event.target.result; };
        reader.readAsDataURL(file);
    }
});

function saveManualCard() {
    const q = document.getElementById('card-q-input').value.trim();
    const a = document.getElementById('card-a-input').value.trim();
    if (!q && !currentImageBase64) return alert("Veuillez saisir une question ou une image !");
    if (!a) return alert("Veuillez saisir une réponse !");

    const newCard = { id: Date.now() + Math.random(), createdAt: Date.now(), q: q, a: a, img: currentImageBase64, correct: 0, wrong: 0 };
    db.folders.find(f => f.id === currentFolderId).cards.push(newCard);
    saveDB();
    openFolder(currentFolderId);
}

function saveExpressCards() {
    const text = document.getElementById('express-textarea').value.trim();
    if (!text) return alert("Le champ est vide !");

    const lines = text.split('\n');
    let addedCount = 0;

    lines.forEach(line => {
        const parts = line.split('|');
        if (parts.length >= 2) {
            const q = parts[0].trim();
            const a = parts.slice(1).join('|').trim(); // Au cas où il y a d'autres séparateurs
            if (q && a) {
                db.folders.find(f => f.id === currentFolderId).cards.push({
                    id: Date.now() + Math.random(),
                    createdAt: Date.now(),
                    q: q,
                    a: a,
                    img: null,
                    correct: 0,
                    wrong: 0
                });
                addedCount++;
            }
        }
    });

    if (addedCount > 0) {
        saveDB();
        openFolder(currentFolderId);
        alert(`${addedCount} cartes ajoutées avec succès !`);
    } else {
        alert("Format invalide. Assurez-vous d'utiliser le séparateur '|'.");
    }
}

function renderCards() {
    const folder = db.folders.find(f => f.id === currentFolderId);
    document.getElementById('current-folder-title').innerText = folder.name;
    const list = document.getElementById('cards-list');
    list.innerHTML = '';
    
    folder.cards.forEach(card => {
        const el = document.createElement('div');
        el.className = 'list-item';
        el.innerHTML = `
            <div style="flex:1">
                <div class="list-item-title">${card.q.substring(0, 30) || 'Image...'}</div>
                <div class="list-item-stats">Réponse : ${card.a.substring(0, 30)}</div>
            </div>
            <button class="btn-icon" onclick="deleteCard(${card.id})">✕</button>
        `;
        list.appendChild(el);
    });
}

function deleteCard(id) {
    if (confirm("Supprimer cette carte ?")) {
        const folder = db.folders.find(f => f.id === currentFolderId);
        folder.cards = folder.cards.filter(c => c.id !== id);
        saveDB();
        renderCards();
    }
}

// Import/Export
function saveDB() { localStorage.setItem('flashcards_db', JSON.stringify(db)); }
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "flashcards_backup.json");
    dl.click();
}
function importData(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedDB = JSON.parse(e.target.result);
                if (importedDB && importedDB.folders) {
                    importedDB.folders.forEach(f => {
                        f.id = Date.now() + Math.random(); 
                        f.cards.forEach(c => c.id = Date.now() + Math.random());
                        db.folders.push(f);
                    });
                    saveDB();
                    renderFolders();
                    alert("Import fusionné avec succès !");
                }
            } catch (err) { alert("Fichier invalide."); }
        };
        reader.readAsText(file);
    }
}

// Moteur de révision (Boucle & Swipe)
function startReview(mode) {
    reviewMode = mode;
    let cardsToReview = [];
    if (mode === 'global') db.folders.forEach(f => cardsToReview.push(...f.cards));
    else cardsToReview = [...db.folders.find(f => f.id === currentFolderId).cards];

    if (cardsToReview.length === 0) return alert("Aucune carte à réviser !");

    reviewQueue = cardsToReview.sort(() => Math.random() - 0.5);
    currentQueueIndex = 0;
    cardsReviewedCount = 0;
    
    switchView('view-review');
    loadCardToUI();
}

function loadCardToUI() {
    document.getElementById('review-progress').innerText = `Vues : ${cardsReviewedCount}`;
    const cardData = reviewQueue[currentQueueIndex];
    const fc = document.getElementById('flashcard');
    
    fc.classList.remove('is-flipped', 'swipe-right-preview', 'swipe-left-preview');
    document.getElementById('review-controls').classList.remove('visible');
    fc.style.transform = '';

    document.getElementById('view-q-text').innerText = cardData.q;
    const imgEl = document.getElementById('view-q-img');
    if (cardData.img) { imgEl.src = cardData.img; imgEl.style.display = 'block'; } 
    else { imgEl.style.display = 'none'; }

    document.getElementById('view-q-reminder').innerText = cardData.q ? "Q: " + cardData.q : "Q: [Image]";
    document.getElementById('view-a-text').innerText = cardData.a;
}

document.getElementById('flashcard').addEventListener('click', function() {
    if (!this.classList.contains('is-flipped')) {
        this.classList.add('is-flipped');
        document.getElementById('review-controls').classList.add('visible');
    }
});

function handleAnswer(isCorrect) {
    const currentCard = reviewQueue[currentQueueIndex];
    let realCard = null;
    db.folders.forEach(f => {
        const found = f.cards.find(c => c.id === currentCard.id);
        if(found) realCard = found;
    });

    if (realCard) {
        if (isCorrect) realCard.correct++;
        else {
            realCard.wrong++;
            reviewQueue.splice(currentQueueIndex + 5, 0, currentCard); // Re-insert 5 places later
        }
        saveDB();
    }

    cardsReviewedCount++;
    currentQueueIndex++;
    
    if (currentQueueIndex >= reviewQueue.length) {
        let pool = [];
        if (reviewMode === 'global') db.folders.forEach(f => pool.push(...f.cards));
        else pool = [...db.folders.find(f => f.id === currentFolderId).cards];
        reviewQueue = reviewQueue.concat(pool.sort(() => Math.random() - 0.5));
    }

    const fc = document.getElementById('flashcard');
    fc.style.transform = isCorrect ? 'translateX(100vw) rotateY(180deg)' : 'translateX(-100vw) rotateY(180deg)';
    setTimeout(loadCardToUI, 300);
}

const flashcard = document.getElementById('flashcard');
flashcard.addEventListener('touchstart', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    touchStartX = e.changedTouches[0].screenX;
});
flashcard.addEventListener('touchmove', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    const diff = e.changedTouches[0].screenX - touchStartX;
    flashcard.style.transform = `rotateY(180deg) translateX(${diff}px) rotateZ(${diff * 0.05}deg)`;
    
    if (diff > 50) flashcard.classList.add('swipe-right-preview'), flashcard.classList.remove('swipe-left-preview');
    else if (diff < -50) flashcard.classList.add('swipe-left-preview'), flashcard.classList.remove('swipe-right-preview');
    else flashcard.classList.remove('swipe-right-preview', 'swipe-left-preview');
});
flashcard.addEventListener('touchend', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    const diff = e.changedTouches[0].screenX - touchStartX;
    flashcard.classList.remove('swipe-right-preview', 'swipe-left-preview');
    if (diff > 100) handleAnswer(true);
    else if (diff < -100) handleAnswer(false);
    else flashcard.style.transform = 'rotateY(180deg)';
});

renderFolders();
