// modal.js

const modal = document.getElementById('project-modal');
const closeModalBtn = document.querySelector('.close-button');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');

// Variables pour suivre l'état de la revendication actuellement ouverte
let currentItemId = null;
let currentRicType = 'Législatif'; // Défaut
let originalRevendicationElement;
let detailResultDiv;
let optimizationResultDiv;
let voteControlsDiv;

/**
 * Met à jour la section de contrôle de vote avec les données actuelles.
 * @param {object} votes L'objet des votes {oui, non, abstention}.
 * @param {string} ricType Le type de RIC (Législatif, Abrogatoire, etc.).
 */
function updateVoteControls(votes, ricType) {
    const totalVotes = votes.oui + votes.non + votes.abstention;
    const votePercentage = (value) => totalVotes > 0 ? ((value / totalVotes) * 100).toFixed(1) : 0;
    
    // Création de la barre de progression HTML
    const progressBar = `
        <div class="vote-progress-bar">
            <div class="progress-segment" style="width: ${votePercentage(votes.oui)}%; background-color: var(--color-success);"></div>
            <div class="progress-segment" style="width: ${votePercentage(votes.non)}%; background-color: var(--color-danger);"></div>
            <div class="progress-segment" style="width: ${votePercentage(votes.abstention)}%; background-color: var(--color-warning);"></div>
        </div>
    `;

    voteControlsDiv.innerHTML = `
        <h3 class="ia-title ric-status">Action requise (Type de RIC) : <strong>${ricType}</strong></h3>
        <div class="vote-summary-row">
            <span class="total-votes-count">Total des votes : ${totalVotes}</span>
            <span class="ric-description">Le RIC est l'outil essentiel pour redonner le pouvoir aux citoyens (Art. 16 DDHC).</span>
        </div>

        ${progressBar}

        <div class="vote-details">
            <span style="color: var(--color-success);">OUI: ${votes.oui} (${votePercentage(votes.oui)}%)</span>
            <span style="color: var(--color-danger);">NON: ${votes.non} (${votePercentage(votes.non)}%)</span>
            <span style="color: var(--color-warning);">ABSTENTION: ${votes.abstention} (${votePercentage(votes.abstention)}%)</span>
        </div>

        <div class="vote-actions">
            <button class="vote-btn vote-oui" data-vote-type="oui">Voter OUI</button>
            <button class="vote-btn vote-non" data-vote-type="non">Voter NON</button>
            <button class="vote-btn vote-abstention" data-vote-type="abstention">Abstention</button>
        </div>
        <p id="vote-message" class="info-message"></p>
    `;

    // Ajouter les écouteurs d'événements pour les nouveaux boutons de vote
    document.querySelectorAll('.vote-actions .vote-btn').forEach(btn => {
        btn.addEventListener('click', handleVote);
    });
}

/**
 * Gère l'événement de vote et appelle l'API.
 */
async function handleVote(e) {
    e.preventDefault();
    const voteType = e.target.dataset.voteType;
    const messageElement = document.getElementById('vote-message');
    
    if (!currentItemId) {
        messageElement.textContent = "Erreur: ID de revendication non trouvé.";
        return;
    }

    try {
        messageElement.textContent = "Enregistrement de votre vote...";
        messageElement.classList.remove('error-message');

        const response = await fetch('/api/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: currentItemId,
                voteType: voteType
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            updateVoteControls(data.new_votes, currentRicType);
            messageElement.textContent = `Vote '${voteType.toUpperCase()}' enregistré avec succès !`;
            // Recharger les données globales pour mettre à jour la carte principale
            if (typeof initialize === 'function') {
                initialize(); 
            }
        } else {
            messageElement.textContent = `Erreur lors du vote: ${data.error || 'Erreur inconnue.'}`;
            messageElement.classList.add('error-message');
        }

    } catch (error) {
        console.error("Erreur d'enregistrement du vote:", error);
        messageElement.textContent = "Erreur de connexion au serveur de vote.";
        messageElement.classList.add('error-message');
    }
}


/**
 * Initialise la structure du contenu IA.
 */
function initializeModalContent() {
    // Injecte la structure de base avec les IDs nécessaires
    const structure = `
    
    <h3>Revendication à analyser:</h3>
    <p id="original-revendication"></p>
    
    <h2 class="step-title">1. Présentation Détaillée (Thèse du Problème):</h2>
    <div id="detail-result" class="ia-panel loading-indicator">Chargement des détails (Étape 1/2)...</div>
    
    <h2 class="step-title">2. Proposition de Solution (Optimisation par Gemma2):</h2>
    <div id="optimization-result" class="ia-panel loading-indicator">En attente des détails pour générer la solution (Étape 2/2)...</div>
    <div id="vote-controls-container"></div> 
    `;
    modalBody.innerHTML = structure;

    // Assigner les références DOM après injection
    voteControlsDiv = document.getElementById('vote-controls-container');
    originalRevendicationElement = document.getElementById('original-revendication');
    detailResultDiv = document.getElementById('detail-result');
    optimizationResultDiv = document.getElementById('optimization-result');
}
initializeModalContent();


/**
 * Ouvre la modale et déclenche le processus IA en deux étapes.
 * @param {string} sectionTitre Le titre de la section.
 * @param {string} revendicationText Le texte exact de la revendication.
 * @param {string} itemId L'ID unique de la revendication (nouveau).
 */
function openModal(sectionTitre, revendicationText, itemId) {
    currentItemId = itemId;
    
    // Récupérer les données spécifiques pour initialiser les contrôles de vote
    // (Ceci devrait idéalement être fait par un appel API /api/item/:id, mais nous utilisons la donnée chargée pour simplifier)
    const categoryKey = sectionTitre.toLowerCase().replace(/ /g, '_');
    const itemData = (allData[categoryKey] || []).find(item => item.id === itemId);

    if (itemData) {
        currentRicType = itemData.ric_type;
        updateVoteControls(itemData.votes, itemData.ric_type);
    } else {
        updateVoteControls({oui: 0, non: 0, abstention: 0}, 'Législatif');
    }

    // Réinitialisation et affichage des analyses IA
    modalTitle.textContent = `Analyse et Projet de Réforme : ${sectionTitre}`;
    originalRevendicationElement.textContent = revendicationText;
    
    detailResultDiv.className = 'ia-panel loading-indicator';
    detailResultDiv.textContent = 'Chargement des détails (Étape 1/2)...';
    optimizationResultDiv.className = 'ia-panel loading-indicator';
    optimizationResultDiv.textContent = 'En attente des détails pour générer la solution (Étape 2/2)...';
    
    modal.style.display = "block";
    
    // 1. Déclencher l'étape de détail
    fetchDetail(revendicationText);
}


/**
 * ÉTAPE 1: Appel à /api/detail - Génère l'analyse du problème.
 */
async function fetchDetail(revendication) {
    const encodedRevendication = encodeURIComponent(revendication);
    const detailURL = `/api/detail?text=${encodedRevendication}`;

    try {
        const response = await fetch(detailURL);
        const data = await response.json();
        
        detailResultDiv.classList.remove('loading-indicator');

        if (data.error) {
            detailResultDiv.innerHTML = `<p class='error-message'>❌ **Erreur d'API (Étape 1)**: ${data.error}</p>`;
            optimizationResultDiv.textContent = 'Annulé.';
        } else if (data.detail) {
            // Utiliser innerHTML pour interpréter le HTML généré par l'IA
            detailResultDiv.innerHTML = data.detail;
            
            // 2. Passer à l'étape d'optimisation
            fetchOptimization(data.detail);
        } else {
            detailResultDiv.innerHTML = '<p class=\'error-message\'>❌ Erreur de détail (Étape 1) : Réponse vide.</p>';
            optimizationResultDiv.textContent = 'Annulé.';
        }

    } catch (error) {
        console.error("Erreur lors de la récupération des détails IA:", error);
        detailResultDiv.classList.remove('loading-indicator');
        detailResultDiv.innerHTML = '<p class=\'error-message\'>❌ Erreur de connexion au service de détail (Étape 1).</p>';
        optimizationResultDiv.textContent = 'Annulé.';
    }
}


/**
 * ÉTAPE 2: Appel à /api/optimise - Génère la solution concrète.
 */
async function fetchOptimization(detailText) {
    const encodedDetail = encodeURIComponent(detailText);
    const optimizeURL = `/api/optimise?detail=${encodedDetail}`;

    optimizationResultDiv.textContent = 'Génération de la solution basée sur l\'analyse détaillée...';

    try {
        const response = await fetch(optimizeURL);
        const data = await response.json();

        optimizationResultDiv.classList.remove('loading-indicator');

        if (data.error) {
            optimizationResultDiv.innerHTML = `<p class='error-message'>❌ **Erreur d'API (Étape 2)**: ${data.error}</p>`;
        } else if (data.solution) {
            // Utiliser innerHTML pour interpréter le HTML généré par l'IA
            optimizationResultDiv.innerHTML = data.solution;
        } else {
            optimizationResultDiv.innerHTML = '<p class=\'error-message\'>❌ Erreur de solution (Étape 2) : Réponse vide.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la récupération de l'optimisation IA:", error);
        optimizationResultDiv.classList.remove('loading-indicator');
        optimizationResultDiv.innerHTML = '<p class=\'error-message\'>❌ Erreur de connexion au service d\'optimisation (Étape 2).</p>';
    }
}


// --- Gestion des Événements de Fermeture ---
closeModalBtn.onclick = function() {
    modal.style.display = "none";
}

window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}