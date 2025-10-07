// dashboard.js

// NOTE: Les fonctions rendues ici (renderSummaryCards, renderPriorityList, renderActionHub)
// nécessitent les styles définis dans dashboard.css pour un affichage correct.

const DASHBOARD_HTML_TEMPLATE = `
    <div class="dashboard-page">
        <h2 class="dashboard-main-title">Tableau de Bord : Pilotage des Actions Démocratiques</h2>
        <p class="dashboard-intro">Ce centre de pilotage identifie les revendications les plus soutenues par les citoyens (votes par points) et formalise les prochaines étapes d'action RIC (Référendum d'Initiative Citoyenne).</p>

        <section class="dashboard-section" id="stats-summary">
            <h3>Synthèse Globale de l'Engagement</h3>
            <div class="stat-cards-container" id="summary-cards">
            </div>
        </section>

        <section class="dashboard-section" id="priority-chart-section">
            <h3>Répartition par Priorité Initiale et Poids des Votes</h3>
            <div class="chart-area" id="priority-chart">
            </div>
        </section>

        <section class="dashboard-section" id="action-hub-section">
            <h3>🚀 Hub d'Action RIC : Top 5 des Projets Prioritaires</h3>
            <p>Ces projets ont la plus haute combinaison de priorité initiale et de score de vote total. Ils sont prêts à passer à la phase de formalisation (RIC).</p>
            <div id="action-list-container">
            </div>
        </section>
    </div>
`;


/**
 * Charge la structure du dashboard et affiche les statistiques.
 * @param {HTMLElement} container Le conteneur principal à remplir (dynamicContentContainer).
 */
async function loadDashboard(container) {
    container.innerHTML = DASHBOARD_HTML_TEMPLATE;
    
    // S'assurer que les données sont à jour (surtout après un vote)
    // Nous demandons à l'API de recharger/trier les données
    if (window.allData && Object.keys(window.allData).length > 0) {
        try {
            // 1. Charger les statistiques de l'API
            const statsResponse = await fetch('/api/stats');
            const stats = await statsResponse.json();
            
            // 2. Rendre les statistiques (Appel aux fonctions de rendu)
            renderSummaryCards(stats);
            renderPriorityList(stats);
            
            // 3. Charger toutes les revendications triées pour le Hub d'Action
            const allRevendicationsResponse = await fetch('/api/data');
            const allRevendications = await allRevendicationsResponse.json();

            renderActionHub(allRevendications);

        } catch (error) {
            console.error('Erreur lors du chargement des statistiques du Dashboard:', error);
            document.getElementById('stats-summary').innerHTML = `<p class="error-message">❌ Impossible de charger les statistiques depuis l'API.</p>`;
        }
    } else {
        container.innerHTML = `<p class="error-message">Veuillez d'abord charger les données de revendications.</p>`;
    }
}

/**
 * Affiche les cartes de synthèse globale (Total, Votes, Priorité).
 */
function renderSummaryCards(stats) {
    const container = document.getElementById('summary-cards');
    if (!container) return;
    
    const totalRev = stats.totalRevendications;
    const totalVotes = stats.totalVotes;
    const highPrioCount = stats.byPriority['Élevé'] || 0;
    const avgPrioPercentage = totalRev > 0 ? ((highPrioCount / totalRev) * 100).toFixed(1) : 0;
    
    // NOTE: Le totalVotes ici est le vote RIC simple (oui/non/abstention), pas le score par points.
    
    const cards = [
        { title: "Revendications Totales", value: totalRev, icon: "📋" },
        { title: "Priorité Élevée", value: `${highPrioCount} (${avgPrioPercentage}%)`, icon: "🔥" },
        { title: "Votes Simples Enregistrés", value: totalVotes, icon: "🗳️" }
    ];

    container.innerHTML = cards.map(card => `
        <div class="stat-card">
            <span class="stat-icon">${card.icon}</span>
            <div class="stat-details">
                <p class="stat-value">${card.value}</p>
                <p class="stat-title">${card.title}</p>
            </div>
        </div>
    `).join('');
}

/**
 * Affiche la répartition des revendications par priorité (Tableau).
 */
function renderPriorityList(stats) {
    const container = document.getElementById('priority-chart');
    if (!container) return;

    let html = `
        <h3>Répartition par Priorité (Base Initiale)</h3>
        <table class="priority-table">
            <thead>
                <tr>
                    <th>Priorité</th>
                    <th>Nombre de Revendications</th>
                    <th>Pourcentage</th>
                </tr>
            </thead>
            <tbody>
    `;

    const total = stats.totalRevendications;
    const priorities = ['Élevé', 'Moyen', 'Faible'];
    
    priorities.forEach(prio => {
        const count = stats.byPriority[prio] || 0;
        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        const colorClass = `priority-${prio.toLowerCase()}`;

        html += `
            <tr class="${colorClass}">
                <td><span class="priority-tag-small ${colorClass}">${prio}</span></td>
                <td>${count}</td>
                <td>${percentage}%</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;
    container.innerHTML = html;
}

/**
 * Affiche les 5 revendications ayant le plus de votes (Total score, si implémenté dans l'API)
 * @param {object} allRevendications Les données brutes chargées depuis /api/data.
 */
function renderActionHub(allRevendications) {
    const container = document.getElementById('action-list-container');
    if (!container) return;

    // 1. Aplatir la liste
    let globalList = [];
    for (const category in allRevendications) {
        globalList.push(...allRevendications[category]);
    }
    
    // 2. Trier par Score (totalScore)
    const topActions = globalList
        .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)) // Trié par le nouveau champ totalScore
        .slice(0, 5); 

    if (topActions.length === 0) {
        container.innerHTML = "<p>Aucune revendication n'a encore reçu de score pour définir les actions prioritaires.</p>";
        return;
    }

    container.innerHTML = topActions.map((item, index) => `
        <div class="action-card priority-${item.priority.toLowerCase()}">
            <div class="action-rank">#${index + 1}</div>
            <div class="action-details">
                <p class="action-title">${item.revendication}</p>
                <p class="action-meta">
                    Type RIC: <strong>${item.ric_type}</strong> | Score Total: <strong>${item.totalScore || 0}</strong> points | Catégorie: ${item.category.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}
                </p>
            </div>
            <button class="formalize-btn" 
                    data-item-id="${item.id}"
                    data-revendication-text="${item.revendication.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}" 
                    data-ric-type="${item.ric_type}">
                Formaliser l'Action
            </button>
        </div>
    `).join('');

    // Ajouter l'écouteur d'événement pour le bouton de formalisation
    document.querySelectorAll('.formalize-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            // Ouvrir la modale d'analyse pour le projet sélectionné
            if (typeof openModal === 'function') {
                const text = button.dataset.revendicationText; 
                const itemId = button.dataset.itemId;
                openModal(`Action RIC: ${button.dataset.ricType}`, text, itemId); 
            }
        });
    });
}