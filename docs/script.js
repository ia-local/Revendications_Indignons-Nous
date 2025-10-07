// script.js

// Configuration
const REVENDICATIONS_PER_PAGE = 10;
let currentPage = 1;
let currentCategoryKey = null; // Utilisé pour stocker la clé de la catégorie actuelle
let allData = {}; // Stockera TOUTES les données thématiques chargées depuis /api/data

// Sélecteurs DOM
const menuList = document.getElementById('menu-list');
const contentArea = document.getElementById('content-area');
const sectionTitle = document.getElementById('section-title');
const sectionContact = document.getElementById('section-contact');
const revendicationsSection = document.getElementById('revendications-section');


/**
 * Charge les données depuis l'API /api/data et initialise l'interface.
 */
async function initialize() {
    try {
        // 1. Charger toutes les données depuis la nouvelle API
        const response = await fetch('/api/data');
        if (!response.ok) {
            throw new Error(`Erreur API: ${response.status}`);
        }
        allData = await response.json();
        
        // 2. Initialiser le menu à partir des clés de catégorie
        renderMenu();
        
        // 3. Afficher la première catégorie par défaut
        const firstCategory = Object.keys(allData)[0];
        if (firstCategory) {
            showSection(firstCategory);
        }

    } catch (error) {
        console.error('Erreur de chargement des données:', error);
        sectionTitle.textContent = "Erreur de connexion";
        revendicationsSection.innerHTML = `<p class="error-message">Impossible de charger les revendications. Veuillez vérifier que le serveur.js est démarré et que la route /api/data est fonctionnelle. (${error.message})</p>`;
    }
}

/**
 * Génère les liens de navigation dans le menu latéral à partir des clés de catégorie.
 */
function renderMenu() {
    menuList.innerHTML = '';
    const categories = Object.keys(allData);

    categories.forEach((key, index) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        
        // Formatage pour l'affichage (ex: 'egalite_sociale' -> 'Égalité Sociale')
        const displayTitle = key.replace(/_/g, ' ')
                                .replace(/\b\w/g, char => char.toUpperCase());

        a.href = `#${key}`;
        a.textContent = displayTitle;
        a.dataset.category = key;
        
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const newCategory = e.target.dataset.category;
            if (newCategory !== currentCategoryKey) {
                showSection(newCategory);
            }
        });

        li.appendChild(a);
        menuList.appendChild(li);
    });
}

/**
 * Affiche la section spécifiée par sa clé de catégorie.
 * @param {string} categoryKey La clé de la catégorie à afficher (ex: 'democratie').
 */
function showSection(categoryKey) {
    if (!allData[categoryKey]) return;

    currentCategoryKey = categoryKey;
    currentPage = 1;

    // Mise à jour du titre de la section
    const displayTitle = categoryKey.replace(/_/g, ' ')
                                    .replace(/\b\w/g, char => char.toUpperCase());
    sectionTitle.textContent = displayTitle;

    // Met à jour l'état actif du menu
    document.querySelectorAll('#menu-list a').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.category === categoryKey) {
            link.classList.add('active');
        }
    });

    // Affiche les revendications pour la première page de cette section
    renderRevendications();
}

/**
 * Affiche les revendications sous forme de cartes avec indicateurs.
 */
function renderRevendications() {
    const revendications = allData[currentCategoryKey] || [];
    const totalRevendications = revendications.length;
    const totalPages = Math.ceil(totalRevendications / REVENDICATIONS_PER_PAGE);

    // Calculer les index de début et de fin pour la pagination
    const startIndex = (currentPage - 1) * REVENDICATIONS_PER_PAGE;
    const endIndex = Math.min(startIndex + REVENDICATIONS_PER_PAGE, totalRevendications);
    const revendicationsToShow = revendications.slice(startIndex, endIndex);
    
    // Générer le contenu des cartes
    let cardsHTML = `<div id="revendications-list">`;
    
    revendicationsToShow.forEach((item) => {
        // Remplace les guillemets simples/doubles pour éviter de casser l'attribut data
        const safeRevendication = item.revendication.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        
        // Calculer la participation au vote (pour l'indicateur)
        const totalVotes = item.votes.oui + item.votes.non + item.votes.abstention;
        const participationText = totalVotes > 0 ? `${totalVotes} Votes` : 'Pas encore de vote';
        
        cardsHTML += `
            <div class="revendication-card priority-${item.priority.toLowerCase()}">
                
                <div class="card-header">
                    <span class="card-priority-tag">${item.priority}</span>
                    <span class="card-ric-type">RIC: ${item.ric_type}</span>
                </div>

                <div class="card-body">
                    <p class="card-revendication-text">${item.revendication}</p>
                    <p class="card-votes-summary">
                        Oui: ${item.votes.oui} | Non: ${item.votes.non} | Abstention: ${item.votes.abstention} 
                        <span class="vote-count">(${participationText})</span>
                    </p>
                </div>
                
                <div class="card-actions">
                    <button class="action-btn open-modal-btn" 
                            data-revendication-text="${safeRevendication}" 
                            data-category-title="${sectionTitle.textContent}"
                            data-item-id="${item.id}"
                            >
                        Analyser et Optimiser
                    </button>
                    </div>
            </div>
        `;
    });
    cardsHTML += '</div>';

    // Générer les contrôles de pagination (inchangés)
    const paginationHTML = `
        <div id="pagination-controls" aria-label="Contrôles de pagination pour la section">
            <button id="prev-btn" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}>Précédent</button>
            <span id="page-info">Page ${currentPage} sur ${totalPages}</span>
            <button id="next-btn" class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''}>Suivant</button>
        </div>
    `;

    // Insérer le contenu dans la section
    revendicationsSection.innerHTML = cardsHTML + paginationHTML;

    // Ajouter les écouteurs d'événements pour les boutons d'analyse (modale)
    document.querySelectorAll('.open-modal-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const text = button.dataset.revendicationText; 
            const sectionTitleText = button.dataset.categoryTitle;
            const itemId = button.dataset.itemId; // Nouvel ID unique
            
            if (typeof openModal === 'function') {
                // openModal doit être mis à jour dans modal.js pour accepter l'ID
                openModal(sectionTitleText, text, itemId); 
            } else {
                console.error("La fonction openModal n'est pas définie.");
            }
        });
    });

    // Ajouter les écouteurs d'événements pour les boutons de pagination
    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderRevendications();
            contentArea.scrollIntoView({ behavior: 'smooth' });
        }
    });

    document.getElementById('next-btn').addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderRevendications();
            contentArea.scrollIntoView({ behavior: 'smooth' });
        }
    });
}

// Lancement de l'initialisation
document.addEventListener('DOMContentLoaded', initialize);