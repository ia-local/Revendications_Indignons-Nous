// app.js (Routage et initialisation globale)

// Variables globales partagées entre tous les modules
window.allData = {}; 
window.currentCategoryKey = ''; 

// Sélecteurs DOM centraux
const dynamicContentContainer = document.getElementById('content-area');
const menuList = document.getElementById('menu-list');

/**
 * Charge les données depuis l'API ou le mode statique et initialise l'application.
 */
async function initialize() {
    try {
        // Tenter de charger les données via l'API (Mode Serveur)
        const apiResponse = await fetch('/api/data');
        if (!apiResponse.ok) {
            throw new Error(`Erreur API: ${apiResponse.status} - Tentative de chargement statique...`);
        }
        window.allData = await apiResponse.json();
        console.log("Mode: API (Serveur Node.js) - Données chargées.");
        
    } catch (error) {
        console.warn('Erreur de connexion API:', error.message);
        
        // Si l'API échoue, basculer en mode statique (sans vote ni IA)
        try {
            const staticResponse = await fetch('revendications.json'); 
            if (!staticResponse.ok) {
                throw new Error("Erreur de chargement du fichier de secours statique.");
            }
            const oldData = await staticResponse.json();
            
            // Adapter l'ancienne structure statique à la nouvelle
            window.allData = {};
            oldData.sections.forEach(section => {
                const key = section.titre.toLowerCase().replace(/ /g, '_').replace('é', 'e');
                window.allData[key] = section.revendications.map((r, i) => ({
                    revendication: r,
                    id: `${key}-${i}`,
                    category: key,
                    votes: { oui: 0, non: 0, abstention: 0 },
                    totalVotes: 0,
                    ric_type: 'Législatif',
                    priority: 'Faible',
                    totalScore: 0 // Nécessaire pour le Dashboard
                }));
            });
            console.log("Mode: Statique (GitHub Pages) - Vote/IA désactivés.");
            
        } catch (staticError) {
            console.error('Erreur de chargement statique:', staticError);
            dynamicContentContainer.innerHTML = `<p class="error-message">❌ Impossible de charger les données.</p>`;
            return;
        }
    }
    
    // Poursuite de l'initialisation (commun aux deux modes)
    if (typeof renderCategoryMenu === 'function') {
        renderCategoryMenu(menuList);
    }
    
    handleRouting();
    
    window.addEventListener('hashchange', handleRouting);
    
    document.querySelectorAll('.nav-link, .header-nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = e.target.getAttribute('href'); 
        });
    });
}

/**
 * Gère le routage basé sur le fragment URL (#hash).
 */
function handleRouting() {
    const hash = window.location.hash.substring(1);
    
    const firstCategory = Object.keys(window.allData)[0] || 'dashboard';
    const targetRoute = hash || firstCategory; 

    // 1. Gérer le Dashboard
    if (targetRoute === 'dashboard') {
        if (typeof loadDashboard === 'function') {
            loadDashboard(dynamicContentContainer); 
        }
    } 
    // 2. Gérer la catégorie de revendications
    else if (window.allData[targetRoute]) {
        if (typeof showSection === 'function') {
            showSection(targetRoute, dynamicContentContainer); 
        }
    } else {
        // Si la route est inconnue, rediriger vers la route par défaut (la première catégorie)
        if (targetRoute !== firstCategory) {
             window.location.hash = `#${firstCategory}`;
        }
    }

    // Mettre à jour l'état actif dans le menu (Sidebar et Header)
    document.querySelectorAll('.nav-link, .header-nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${targetRoute}`) {
            link.classList.add('active');
        }
    });
}


document.addEventListener('DOMContentLoaded', initialize);