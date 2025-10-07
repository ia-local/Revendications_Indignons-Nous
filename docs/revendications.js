// revendications.js (Gère la vue des revendications par thème)

// Configuration
const REVENDICATIONS_PER_PAGE = 10;
let currentPage = 1;

// Template de la page de revendications
const categoryTitleTemplate = `<h2 id="section-title"></h2><section id="revendications-section"></section>`;


/**
 * Génère les liens de navigation thématiques dans le menu latéral.
 * @param {HTMLElement} menuList Le conteneur <ul> du menu.
 */
function renderCategoryMenu(menuList) {
    const categories = Object.keys(window.allData || {});

    // Retirer les anciens liens pour insérer les nouveaux
    let separator = menuList.querySelector('.category-title');
    if (!separator) return;

    let currentNode = separator.nextElementSibling;
    while (currentNode) {
        const nextNode = currentNode.nextElementSibling;
        currentNode.remove();
        currentNode = nextNode;
    }

    categories.forEach((key) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        
        const displayTitle = key.replace(/_/g, ' ')
                                .replace(/\b\w/g, char => char.toUpperCase());

        a.href = `#${key}`;
        a.textContent = displayTitle;
        a.dataset.route = key;
        a.classList.add('nav-link');
        
        a.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = `#${key}`; 
        });

        li.appendChild(a);
        menuList.appendChild(li);
    });
}

/**
 * Affiche la section spécifiée par sa clé de catégorie.
 * @param {string} categoryKey La clé de la catégorie à afficher.
 * @param {HTMLElement} dynamicContentContainer Le conteneur principal à remplir.
 */
function showSection(categoryKey, dynamicContentContainer) {
    if (!window.allData[categoryKey]) return;

    // 1. Charger la structure de la page Revendications
    dynamicContentContainer.innerHTML = categoryTitleTemplate; 
    
    // Récupérer les éléments DOM après l'injection
    const sectionTitle = document.getElementById('section-title');
    const revendicationsSection = document.getElementById('revendications-section');
    
    // 2. Mise à jour du titre
    const displayTitle = categoryKey.replace(/_/g, ' ')
                                    .replace(/\b\w/g, char => char.toUpperCase());
    sectionTitle.textContent = `Thème : ${displayTitle}`;

    currentPage = 1;
    window.currentCategoryKey = categoryKey; 

    // 3. Afficher les revendications
    renderRevendications(revendicationsSection);
}


/**
 * Affiche les revendications sous forme de cartes avec indicateurs.
 * @param {HTMLElement} container Le conteneur où insérer les cartes.
 */
function renderRevendications(container) {
    const categoryKey = window.currentCategoryKey;
    const revendications = window.allData[categoryKey] || [];
    
    const totalRevendications = revendications.length;
    const totalPages = Math.ceil(totalRevendications / REVENDICATIONS_PER_PAGE);

    const startIndex = (currentPage - 1) * REVENDICATIONS_PER_PAGE;
    const endIndex = Math.min(startIndex + REVENDICATIONS_PER_PAGE, totalRevendications);
    const revendicationsToShow = revendications.slice(startIndex, endIndex);
    
    // --- Génération du Contenu des Cartes ---
    let cardsHTML = `<div id="revendications-list">`;
    
    revendicationsToShow.forEach((item) => {
        const safeRevendication = item.revendication.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        
        const totalVotes = item.totalVotes || 0; 
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
                        Votes totaux (Oui/Non/Abstention): ${totalVotes} 
                        <span class="vote-count">(${participationText})</span>
                    </p>
                </div>
                
                <div class="card-actions">
                    <button class="action-btn open-modal-btn" 
                            data-revendication-text="${safeRevendication}" 
                            data-category-title="Thème : ${document.getElementById('section-title').textContent.replace('Thème : ', '')}"
                            data-item-id="${item.id}"
                            >
                        Analyser et Optimiser
                    </button>
                </div>
            </div>
        `;
    });
    cardsHTML += '</div>';

    // --- Génération des Contrôles de Pagination ---
    const paginationHTML = `
        <div id="pagination-controls" aria-label="Contrôles de pagination pour la section">
            <button id="prev-btn" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}>Précédent</button>
            <span id="page-info">Page ${currentPage} sur ${totalPages}</span>
            <button id="next-btn" class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''}>Suivant</button>
        </div>
    `;

    // Insérer le contenu
    container.innerHTML = cardsHTML + paginationHTML;

    // Attacher les écouteurs après l'injection HTML
    attachRevendicationListeners(container, totalPages);
}

/**
 * Attache les écouteurs pour la pagination et l'ouverture de la modale.
 */
function attachRevendicationListeners(container, totalPages) {
    const revendicationsSection = container.querySelector('#revendications-section');

    document.querySelectorAll('.open-modal-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const text = button.dataset.revendicationText; 
            const sectionTitleText = button.dataset.categoryTitle;
            const itemId = button.dataset.itemId;
            
            if (typeof openModal === 'function') {
                openModal(sectionTitleText, text, itemId); 
            } else {
                console.error("La fonction openModal n'est pas définie.");
            }
        });
    });

    document.getElementById('prev-btn')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderRevendications(revendicationsSection);
            document.getElementById('content-area')?.scrollIntoView({ behavior: 'smooth' });
        }
    });

    document.getElementById('next-btn')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderRevendications(revendicationsSection);
            document.getElementById('content-area')?.scrollIntoView({ behavior: 'smooth' });
        }
    });
}