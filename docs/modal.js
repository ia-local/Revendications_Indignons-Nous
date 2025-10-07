// modal.js

const modal = document.getElementById('project-modal');
const closeModalBtn = document.querySelector('.close-button');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
let originalRevendicationElement; // Référence à l'élément de texte
let detailResultDiv;
let optimizationResultDiv;


/**
 * Initialise la structure du contenu IA (nécessaire pour innerHTML).
 */
function initializeModalContent() {
    // Injecte la structure de base avec les IDs nécessaires
    const structure = `
        <h3>Revendication à analyser:</h3>
        <p id="original-revendication"></p>
        
        <h2>1. Présentation Détaillée (Thèse du Problème):</h2>
        <div id="detail-result" class="loading-indicator">Chargement des détails (Étape 1/2)...</div>

        <h2>2. Proposition de Solution (Optimisation par Gemma2):</h2>
        <div id="optimization-result" class="loading-indicator">En attente des détails pour générer la solution (Étape 2/2)...</div>
    `;
    modalBody.innerHTML = structure;

    // Assigner les références DOM après injection
    originalRevendicationElement = document.getElementById('original-revendication');
    detailResultDiv = document.getElementById('detail-result');
    optimizationResultDiv = document.getElementById('optimization-result');
}
initializeModalContent();


/**
 * Ouvre la modale et déclenche le processus IA en deux étapes.
 * @param {string} sectionTitre Le titre de la section.
 * @param {string} revendicationText Le texte exact de la revendication.
 */
function openModal(sectionTitre, revendicationText) {
    // Réinitialisation des contenus et affichage
    modalTitle.textContent = `Analyse et Projet de Réforme : ${sectionTitre}`;
    originalRevendicationElement.textContent = revendicationText;
    
    // Affichage des états de chargement
    detailResultDiv.className = 'loading-indicator';
    detailResultDiv.textContent = 'Chargement des détails (Étape 1/2)...';
    optimizationResultDiv.className = 'loading-indicator';
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
            detailResultDiv.innerHTML = `❌ **Erreur d'API (Étape 1)**: ${data.error}`;
            optimizationResultDiv.textContent = 'Annulé.';
        } else if (data.detail) {
            // Utiliser innerHTML pour interpréter le Markdown généré par l'IA
            detailResultDiv.innerHTML = data.detail;
            
            // 2. Passer à l'étape d'optimisation
            fetchOptimization(data.detail);
        } else {
            detailResultDiv.innerHTML = '❌ Erreur de détail (Étape 1) : Réponse vide.';
            optimizationResultDiv.textContent = 'Annulé.';
        }

    } catch (error) {
        console.error("Erreur lors de la récupération des détails IA:", error);
        detailResultDiv.classList.remove('loading-indicator');
        detailResultDiv.innerHTML = '❌ Erreur de connexion au service de détail (Étape 1).';
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
            optimizationResultDiv.innerHTML = `❌ **Erreur d'API (Étape 2)**: ${data.error}`;
        } else if (data.solution) {
            // Utiliser innerHTML pour interpréter le Markdown généré par l'IA
            optimizationResultDiv.innerHTML = data.solution;
        } else {
            optimizationResultDiv.innerHTML = '❌ Erreur de solution (Étape 2) : Réponse vide.';
        }

    } catch (error) {
        console.error("Erreur lors de la récupération de l'optimisation IA:", error);
        optimizationResultDiv.classList.remove('loading-indicator');
        optimizationResultDiv.innerHTML = '❌ Erreur de connexion au service d\'optimisation (Étape 2).';
    }
}


// --- Gestion des Événements de Fermeture ---

// Fermer quand on clique sur le X
closeModalBtn.onclick = function() {
    modal.style.display = "none";
}

// Fermer quand on clique en dehors de la modale
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}
