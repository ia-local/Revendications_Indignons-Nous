// script.js

// Configuration
const REVENDICATIONS_PER_PAGE = 10;
let currentPage = 1;
let currentSectionIndex = 0;
let data = {}; // Stockera les données de revendocations.json

// Sélecteurs DOM
const menuList = document.getElementById('menu-list');
const contentArea = document.getElementById('content-area');
const sectionTitle = document.getElementById('section-title');
const sectionContact = document.getElementById('section-contact');
const revendicationsSection = document.getElementById('revendications-section');

/**
 * Charge les données JSON et initialise l'interface.
 */
async function initialize() {
    try {
        const response = await fetch('revendications.json');
        data = await response.json();
        
        // Initialiser le menu
        renderMenu();
        
        // Afficher la première section par défaut
        if (data.sections && data.sections.length > 0) {
            sectionContact.textContent = data.contact;
            showSection(0);
        }

    } catch (error) {
        console.error('Erreur de chargement des données:', error);
        contentArea.innerHTML = '<p style="color: red;">Erreur lors du chargement des revendications.</p>';
    }
}

/**
 * Génère les liens de navigation dans le menu latéral.
 */
function renderMenu() {
    menuList.innerHTML = '';
    data.sections.forEach((section, index) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#section-${index}`;
        a.textContent = section.titre;
        a.dataset.index = index;
        
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const newIndex = parseInt(e.target.dataset.index);
            if (newIndex !== currentSectionIndex) {
                showSection(newIndex);
            }
        });

        li.appendChild(a);
        menuList.appendChild(li);
    });
}

/**
 * Affiche la section spécifiée par son index.
 * @param {number} index L'index de la section à afficher.
 */
function showSection(index) {
    if (index < 0 || index >= data.sections.length) return;

    currentSectionIndex = index;
    currentPage = 1;

    // Met à jour le titre de la section
    sectionTitle.textContent = data.sections[index].titre;

    // Met à jour l'état actif du menu
    document.querySelectorAll('#menu-list a').forEach(link => {
        link.classList.remove('active');
        if (parseInt(link.dataset.index) === index) {
            link.classList.add('active');
        }
    });

    // Affiche les revendications pour la première page de cette section
    renderRevendications();
}

/**
 * Affiche les revendications pour la page actuelle de la section courante,
 * et les rend cliquables pour ouvrir la modale.
 */
function renderRevendications() {
    const section = data.sections[currentSectionIndex];
    const totalRevendications = section.revendications.length;
    const totalPages = Math.ceil(totalRevendications / REVENDICATIONS_PER_PAGE);

    // Calculer les index de début et de fin pour la pagination
    const startIndex = (currentPage - 1) * REVENDICATIONS_PER_PAGE;
    const endIndex = Math.min(startIndex + REVENDICATIONS_PER_PAGE, totalRevendications);
    const revendicationsToShow = section.revendications.slice(startIndex, endIndex);
    
    // Générer la liste des revendications avec des liens (utilisant <ol> pour la numérotation)
    let listHTML = `<ol id="revendications-list" start="${startIndex + 1}">`;
    
    revendicationsToShow.forEach((revendication, localIndex) => {
        const globalIndex = startIndex + localIndex; // L'index dans la liste complète de la section
        
        // Remplace les guillemets simples/doubles pour éviter de casser l'attribut data
        const safeRevendication = revendication.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

        listHTML += `
            <li class="revendication-item">
                <a href="#" class="open-modal-link" data-revendication-text="${safeRevendication}" data-global-index="${globalIndex}">
                    ${revendication}
                </a>
            </li>`;
    });
    listHTML += '</ol>';

    // Générer les contrôles de pagination
    const paginationHTML = `
        <div id="pagination-controls" aria-label="Contrôles de pagination pour la section">
            <button id="prev-btn" class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''}>Précédent</button>
            <span id="page-info">Page ${currentPage} sur ${totalPages}</span>
            <button id="next-btn" class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''}>Suivant</button>
        </div>
    `;

    // Insérer le contenu dans la section
    revendicationsSection.innerHTML = listHTML + paginationHTML;

    // NOUVEAU: Ajouter les écouteurs d'événements pour les liens de revendication
    document.querySelectorAll('.open-modal-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Récupère le texte de la revendication (décodé)
            const text = e.target.dataset.revendicationText; 
            const sectionTitle = data.sections[currentSectionIndex].titre;
            
            // Appel de la fonction définie dans modal.js
            if (typeof openModal === 'function') {
                openModal(sectionTitle, text);
            } else {
                console.error("La fonction openModal n'est pas définie. Assurez-vous que modal.js est bien chargé.");
            }
        });
    });

    // Ajouter les écouteurs d'événements pour les boutons de pagination
    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderRevendications();
            contentArea.scrollIntoView({ behavior: 'smooth' }); // Remonter en haut de la page
        }
    });

    document.getElementById('next-btn').addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            renderRevendications();
            contentArea.scrollIntoView({ behavior: 'smooth' }); // Remonter en haut de la page
        }
    });
}

// Lancement de l'initialisation
document.addEventListener('DOMContentLoaded', initialize);