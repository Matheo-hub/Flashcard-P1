// --- BASE DE DONNÉES LOCALE ---
// Structure : { folders: [ { id, name, expanded, cards: [ { id, q, a, img, correct, wrong, createdAt } ] } ] }
let db = JSON.parse(localStorage.getItem('flashcards_db_final')) || { folders: [] };
let currentImageBase64 = null;

// --- VARIABLES DU MOTEUR DE RÉVISION ---
let reviewQueue = [];
let currentQueueIndex = 0;
let sessionCardsSeen = 0; // Pour le compteur X / Total
let sessionTotalCards = 0;
let timerInterval;
let secondsElapsed = 0;
let touchStartX = 0;
let isReviewActive = false;

// INITIALISATION AU LANCEMENT
document.addEventListener("DOMContentLoaded", () => {
    updateDropdowns();
    renderFoldersList();
});

// ==========================================
// NAVIGATION (TAB BAR)
// ==========================================
function switchTab(tabId, element) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    if (element) element.classList.add('active');

    if (tabId === 'tab-accueil' || tabId === 'tab-creer') updateDropdowns();
    if (tabId === 'tab-dossiers') renderFoldersList();
}

function updateDropdowns() {
    const selects = ['select-session-folder', 'select-create-folder', 'select-express-folder'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = id === 'select-session-folder' ? '<option value="global">Toutes les matières (Mélange général)</option>' : '';
        db.folders.forEach(f => {
            el.innerHTML += `<option value="${f.id}">${f.name}</option>`;
        });
    });
}

// ==========================================
// GESTION DES DOSSIERS ET CARTES
// ==========================================
function saveDB() {
    localStorage.setItem('flashcards_db_final', JSON.stringify(db));
}

function createFolder() {
    const name = prompt("Nom du nouveau dossier :");
    if (name && name.trim() !== "") {
        db.folders.push({ id: Date.now(), name: name.trim(), cards: [], expanded: false });
        saveDB();
        renderFoldersList();
        updateDropdowns();
    }
}

function renderFoldersList() {
    const container = document.getElementById('folders-container');
    container.innerHTML = '';
    
    if (db.folders.length === 0) {
        container.innerHTML = '<div style="padding: 20px; color: var(--text-muted); text-align: center;">Aucun dossier créé. Allez dans Créer !</div>';
        return;
    }

    db.folders.forEach(folder => {
        const folderDiv = document.createElement('div');
        
        // En-tête du dossier (Clic = Dérouler)
        const header = document.createElement('div');
        header.className = 'folder-item';
        header.innerHTML = `
            <div class="folder-info" onclick="toggleFolder(${folder.id})">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                ${folder.name} <span style="font-size:0.9rem; color:var(--text-muted); font-weight:normal;">(${folder.cards.length})</span>
            </div>
            <div class="folder-action" onclick="modifyFolder(${folder.id}, event)">Modifier</div>
        `;
        folderDiv.appendChild(header);

        // Contenu du dossier
        if (folder.expanded) {
            if (folder.cards.length === 0) {
                folderDiv.innerHTML += `<div class="card-item" style="justify-content:center;">Dossier vide</div>`;
            } else {
                folder.cards.forEach(card => {
                    folderDiv.innerHTML += `
                        <div class="card-item">
                            <span>${card.q.substring(0, 30) || '[Image]'}</span>
                            <span class="card-delete" onclick="deleteCard(${folder.id}, ${card.id}, event)">✕</span>
                        </div>
                    `;
                });
            }
        }
        container.appendChild(folderDiv);
    });
}

function toggleFolder(id) {
    const folder = db.folders.find(f => f.id === id);
    folder.expanded = !folder.expanded;
    renderFoldersList();
}

function modifyFolder(id, event) {
    event.stopPropagation(); // Évite de dérouler le dossier
    const folder = db.folders.find(f => f.id === id);
    const newName = prompt("Nouveau nom du dossier :", folder.name);
    if (newName && newName.trim() !== "") {
        folder.name = newName.trim();
        saveDB();
        renderFoldersList();
        updateDropdowns();
    } else if (newName === "") {
        if (confirm("Supprimer ce dossier et TOUTES ses cartes ?")) {
            db.folders = db.folders.filter(f => f.id !== id);
            saveDB();
            renderFoldersList();
            updateDropdowns();
        }
    }
}

function deleteCard(folderId, cardId, event) {
    event.stopPropagation();
    if (confirm("Supprimer définitivement cette flashcard ?")) {
        const folder = db.folders.find(f => f.id === folderId);
        folder.cards = folder.cards.filter(c => c.id !== cardId);
        saveDB();
        renderFoldersList();
    }
}

// ==========================================
// CRÉATION DE CARTES (Manuel & Rapide)
// ==========================================
document.getElementById('card-image-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) { currentImageBase64 = event.target.result; };
        reader.readAsDataURL(file);
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
    folder.cards.push({ 
        id: Date.now(), 
        createdAt: Date.now(),
        q: q, 
        a: a, 
        img: currentImageBase64, 
        correct: 0, 
        wrong: 0 
    });
    
    saveDB();
    
    // Reset du formulaire
    document.getElementById('card-q-input').value = "";
    document.getElementById('card-a-input').value = "";
    document.getElementById('card-image-input').value = "";
    currentImageBase64 = null;
    alert("Flashcard enregistrée avec succès !");
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
        // On sépare par le pipe |
        const parts = line.split('|');
        if (parts.length >= 2) {
            const q = parts[0].trim();
            // On rejoint le reste au cas où il y aurait d'autres | dans la réponse
            const a = parts.slice(1).join('|').trim(); 
            
            if (q && a) {
                folder.cards.push({ 
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
        document.getElementById('express-textarea').value = "";
        alert(`${addedCount} flashcards ajoutées avec succès !`);
    } else {
        alert("Format invalide. Assurez-vous de bien séparer la question et la réponse par un '|'.");
    }
}

// ==========================================
// PARAMÈTRES (Export, Import, Reset)
// ==========================================
function exportData(withStats) {
    let dataToExport = JSON.parse(JSON.stringify(db)); // Copie profonde
    
    if (!withStats) {
        // Remise à zéro des statistiques pour le partage
        dataToExport.folders.forEach(f => {
            f.cards.forEach(c => {
                c.correct = 0;
                c.wrong = 0;
            });
        });
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", withStats ? "flashcards_backup.json" : "flashcards_partage.json");
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
                    // Fusion des dossiers
                    importedDB.folders.forEach(importedFolder => {
                        importedFolder.id = Date.now() + Math.random(); // Nouveaux IDs pour éviter les conflits
                        importedFolder.expanded = false;
                        importedFolder.cards.forEach(c => c.id = Date.now() + Math.random());
                        db.folders.push(importedFolder);
                    });
                    saveDB();
                    updateDropdowns();
                    renderFoldersList();
                    alert("Dossiers importés et fusionnés avec succès !");
                }
            } catch (err) { 
                alert("Erreur : Fichier JSON invalide ou corrompu."); 
            }
        };
        reader.readAsText(file);
    }
}

function resetData() {
    if (confirm("⚠️ ATTENTION : Cette action est irréversible. Toutes vos cartes et statistiques seront perdues. Continuer ?")) {
        db = { folders: [] };
        saveDB();
        updateDropdowns();
        renderFoldersList();
        alert("Application réinitialisée.");
    }
}

// ==========================================
// MOTEUR DE RÉVISION (La Boucle Infinie)
// ==========================================
function startSession() {
    const targetId = document.getElementById('select-session-folder').value;
    let cardsToReview = [];
    
    if (targetId === 'global') {
        db.folders.forEach(f => cardsToReview.push(...f.cards));
    } else {
        const folder = db.folders.find(f => f.id == targetId);
        if (folder) cardsToReview = [...folder.cards];
    }

    if (cardsToReview.length === 0) return alert("Aucune carte à réviser dans cette sélection !");

    // Mélange initial du deck
    reviewQueue = cardsToReview.sort(() => Math.random() - 0.5);
    currentQueueIndex = 0;
    
    // Le total initial de la file (qui va grandir si on se trompe)
    sessionTotalCards = reviewQueue.length; 
    sessionCardsSeen = 1; 
    isReviewActive = true;
    
    document.getElementById('view-review').classList.add('active');
    startTimer();
    loadCardToUI();
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
    
    // Réinitialisation de la vue de la carte
    fc.classList.remove('is-flipped', 'swipe-right-preview', 'swipe-left-preview');
    document.getElementById('review-controls').classList.remove('visible');
    document.getElementById('btn-reveal').style.display = 'block';
    fc.style.transform = '';

    // Remplissage Recto
    document.getElementById('view-q-text').innerText = cardData.q;
    const imgElQ = document.getElementById('view-q-img');
    if (cardData.img) { 
        imgElQ.src = cardData.img; 
        imgElQ.style.display = 'block'; 
    } else { 
        imgElQ.style.display = 'none'; 
    }

    // Remplissage Verso
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
    
    // Mise à jour des statistiques dans la base de données
    let realCard = null;
    db.folders.forEach(f => {
        const found = f.cards.find(c => c.id === currentCard.id);
        if(found) realCard = found;
    });

    if (realCard) {
        if (isCorrect) {
            realCard.correct++;
        } else {
            realCard.wrong++;
            // ALGORITHME DE RÉPÉTITION : La carte revient 5 positions plus tard
            const insertIndex = currentQueueIndex + 5;
            reviewQueue.splice(insertIndex, 0, currentCard);
            sessionTotalCards++; // La file d'attente s'allonge car on doit revoir la carte
        }
        saveDB();
    }

    sessionCardsSeen++;
    currentQueueIndex++;
    
    // BOUCLE INFINIE : Si on arrive à la fin de la file, on recharge tout le paquet mélangé
    if (currentQueueIndex >= reviewQueue.length) {
        const targetId = document.getElementById('select-session-folder').value;
        let pool = [];
        if (targetId === 'global') {
            db.folders.forEach(f => pool.push(...f.cards));
        } else {
            pool = [...db.folders.find(f => f.id == targetId).cards];
        }
        
        // Ajout du pool mélangé à la file existante
        reviewQueue = reviewQueue.concat(pool.sort(() => Math.random() - 0.5));
        sessionTotalCards += pool.length; // On met à jour l'objectif visuel
    }

    // Animation de transition (Swipe automatique via bouton)
    const fc = document.getElementById('flashcard');
    fc.style.transform = isCorrect ? 'translateX(100vw) rotateY(180deg)' : 'translateX(-100vw) rotateY(180deg)';
    
    setTimeout(() => {
        loadCardToUI();
    }, 300);
}

// ==========================================
// INTERACTIONS (Clic, Swipe, Clavier)
// ==========================================

// 1. Clic sur la carte = Retourner
const flashcard = document.getElementById('flashcard');
flashcard.addEventListener('click', function(e) {
    // Évite de déclencher si on clique sur le bouton "Voir la réponse" directement
    if (e.target.id === 'btn-reveal') return; 
    
    if (!this.classList.contains('is-flipped')) {
        revealAnswer();
    }
});

// 2. Gestion Tactile (Swipe iOS/Android)
flashcard.addEventListener('touchstart', e => {
    if (!flashcard.classList.contains('is-flipped')) return; // On ne swipe que le verso
    touchStartX = e.changedTouches[0].screenX;
});

flashcard.addEventListener('touchmove', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    
    const currentX = e.changedTouches[0].screenX;
    const diff = currentX - touchStartX;
    
    // Animation physique du swipe
    flashcard.style.transform = `rotateY(180deg) translateX(${diff}px) rotateZ(${diff * 0.05}deg)`;
    
    // Changement des couleurs selon la direction
    if (diff > 50) { 
        flashcard.classList.add('swipe-right-preview'); 
        flashcard.classList.remove('swipe-left-preview'); 
    } else if (diff < -50) { 
        flashcard.classList.add('swipe-left-preview'); 
        flashcard.classList.remove('swipe-right-preview'); 
    } else { 
        flashcard.classList.remove('swipe-right-preview', 'swipe-left-preview'); 
    }
});

flashcard.addEventListener('touchend', e => {
    if (!flashcard.classList.contains('is-flipped')) return;
    
    const touchEndX = e.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX;
    
    flashcard.classList.remove('swipe-right-preview', 'swipe-left-preview');
    
    // Seuil de validation
    if (diff > 100) {
        handleAnswer(true);
    } else if (diff < -100) {
        handleAnswer(false);
    } else {
        // Annulation du swipe, la carte revient au centre
        flashcard.style.transform = 'rotateY(180deg)';
    }
});

// 3. Gestion Clavier (Ordinateur / iPad avec clavier)
document.addEventListener('keydown', (e) => {
    if (!isReviewActive) return;
    
    const fc = document.getElementById('flashcard');
    
    // Touche ESPACE pour retourner la carte
    if (e.code === 'Space') {
        e.preventDefault(); // Empêche la page de scroller
        if (!fc.classList.contains('is-flipped')) {
            revealAnswer();
        }
    }
    
    // Flèches GAUCHE (Faux) et DROITE (Vrai) uniquement quand la carte est retournée
    if (fc.classList.contains('is-flipped')) {
        if (e.code === 'ArrowRight') {
            handleAnswer(true);
        } else if (e.code === 'ArrowLeft') {
            handleAnswer(false);
        }
    }
});
