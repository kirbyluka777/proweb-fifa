document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('id') || 1;

    loadMatchDetails(matchId);
});

async function loadMatchDetails(matchId) {
    const baseUrl = `/api/v1/matches/${encodeURIComponent(matchId)}`;

    const matchHeader = document.querySelector('.match-header');
    const highlightsSection = document.getElementById('highlights-section');
    const pitchSection = document.querySelector('.pitch');
    const statsSection = document.querySelector('.stats');
    const timelineSection = document.querySelector('.timeline');
    const lineupsSection = document.getElementById('lineups-section');
    const detailPage = document.getElementById('match-detail');

    try {

        const match = await fetchWithCache(baseUrl)

        const homeTeam = match.home_team?.name || match.home_team?.country || 'Local';
        const awayTeam = match.away_team?.name || match.away_team?.country || 'Visitante';
        const homeFlag = match.home_team?.flag_uri || match.home_team?.flag_url || '';
        const awayFlag = match.away_team?.flag_uri || match.away_team?.flag_url || '';
        const homeScore = match.home_score?.total ?? 0;
        const awayScore = match.away_score?.total ?? 0;

        const dateStr = match.date || 'Por definir';
        const timeStr = match.time || '00:00:00';
        const cityName = match.city?.name || match.city?.city || 'Sede por definir';
        const stadiumName = match.city?.stadium?.name || match.city?.stadium_name || 'Estadio por definir';
        const referee = match.referee || 'Por definir';
        const roundNum = match.round;
        const roundName = (roundNum !== undefined && roundNum !== 0) ? `Ronda ${roundNum}` : (match.group ? `Grupo ${match.group}` : 'Fase de Grupos');
        document.title = `${homeTeam} vs. ${awayTeam} - FIFA World Cup 2026`;

        const statusStr = (match.status || '').toLowerCase();
        const finishedStatuses = ['ended', 'finished', 'completed', 'full_time', 'ft', 'played'];
        let isFinished = finishedStatuses.includes(statusStr);
        const isLive = ['live', 'in_progress', '1h', '2h', 'ht'].includes(statusStr);

        const matchDateObj = new Date(`${dateStr}T${timeStr}`);
        if (!isFinished && !isLive && !isNaN(matchDateObj.getTime())) {
            isFinished=true;
        }

        let headerHtml = `
            <p class="match-eyebrow">${roundName}</p>
            <h1>${homeTeam} vs. ${awayTeam}</h1>
            <div class="match-scoreboard">
                <div class="scoreboard-team">
                    ${homeFlag ? `<img class="scoreboard-flag" src="${homeFlag}" alt="">` : ''}
                    <span>Local</span>
                    <strong>${homeTeam}</strong>
                </div>
                <div class="scoreboard-score" aria-label="${homeScore} a ${awayScore}">
                    <span>${homeScore}</span>
                    <i>–</i>
                    <span>${awayScore}</span>
                </div>
                <div class="scoreboard-team">
                    ${awayFlag ? `<img class="scoreboard-flag" src="${awayFlag}" alt="">` : ''}
                    <span>Visitante</span>
                    <strong>${awayTeam}</strong>
                </div>
            </div>
            <div class="match-meta">
                <div class="match-meta-item"><span>Fecha</span><strong>${dateStr}</strong></div>
                <div class="match-meta-item"><span>Hora</span><strong>${timeStr}</strong></div>
                <div class="match-meta-item"><span>Estadio</span><strong>${stadiumName}, ${cityName}</strong></div>
                <div class="match-meta-item"><span>Árbitro</span><strong>${referee}</strong></div>
            </div>
        `;

        if (isFinished) {
            headerHtml += `<div class="status-badge status-finished">✔ Partido Finalizado</div>`;
        } else if (isLive) {
            headerHtml += `<div class="status-badge status-live">🔴 ¡EN VIVO!</div>`;
        } else if (dateStr !== 'Por definir') {
            headerHtml += `<div id="countdown-timer" class="status-badge status-countdown">⏳ Calculando tiempo para el inicio...</div>`;
            iniciarCuentaRegresiva(`${dateStr}T${timeStr}`);
        }

        matchHeader.innerHTML = headerHtml;

        renderHighlights(match.highlight, highlightsSection);

        const homeLineup = match.line_ups?.home;
        const awayLineup = match.line_ups?.away;
        const homeStarters = homeLineup?.starting_players || [];
        const awayStarters = awayLineup?.starting_players || [];

        if (homeStarters.length < 11 || awayStarters.length < 11) {
            pitchSection.innerHTML = `
                <div class="section-heading">
                    <div>
                        <p>Once inicial</p>
                        <h2>Alineación del partido</h2>
                    </div>
                </div>
                <div class="alert">Alineación no disponible: faltan titulares por confirmar.</div>
            `;
        } else {
            pitchSection.innerHTML = `
                <div class="section-heading">
                    <div>
                        <p>Once inicial</p>
                        <h2>Alineación del partido</h2>
                    </div>
                </div>
                <div class="pitch-lineup">
                    <div class="team-pitch">
                        <h3>${homeTeam} · ${homeLineup.formation || 'Por definir'}</h3>
                        <ul>${homeStarters.map(p => `<li><strong class="player-number">#${p.shirt_number ?? p.number ?? '-'}</strong> ${p.name || p.player_name || 'Jugador'}</li>`).join('')}</ul>
                    </div>
                    <div class="team-pitch">
                        <h3>${awayTeam} · ${awayLineup.formation || 'Por definir'}</h3>
                        <ul>${awayStarters.map(p => `<li><strong class="player-number">#${p.shirt_number ?? p.number ?? '-'}</strong> ${p.name || p.player_name || 'Jugador'}</li>`).join('')}</ul>
                    </div>
                </div>
            `;
        }

        const renderPlayersList = (players) => players.map(p => `<li><strong class="player-number">#${p.shirt_number ?? p.number ?? '-'}</strong> ${p.name || p.player_name || 'Jugador'} ${p.position ? `<span class="player-position">(${p.position})</span>` : ''}</li>`).join('');

        if (lineupsSection) {
            lineupsSection.innerHTML = `
                <div class="section-heading">
                    <div>
                        <p>Planteles</p>
                        <h2>Alineaciones y dirección técnica</h2>
                    </div>
                </div>
                <div class="lineups-grid">
                    <div class="team-lineup-col">
                        <h3>${homeTeam}</h3>
                        <div class="lineup-meta">
                            <p><strong>Formación:</strong> ${homeLineup?.formation || 'Por definir'}</p>
                            <p><strong>DT:</strong> ${homeLineup?.coach || 'Por definir'}</p>
                        </div>
                        <h4>Titulares</h4>
                        <ul>${homeStarters.length ? renderPlayersList(homeStarters) : '<li>Pendiente</li>'}</ul>
                        <h4>Sustitutos</h4>
                        <ul>${homeLineup?.substitutes?.length ? renderPlayersList(homeLineup.substitutes) : '<li>No disponible</li>'}</ul>
                    </div>
                    <div class="team-lineup-col">
                        <h3>${awayTeam}</h3>
                        <div class="lineup-meta">
                            <p><strong>Formación:</strong> ${awayLineup?.formation || 'Por definir'}</p>
                            <p><strong>DT:</strong> ${awayLineup?.coach || 'Por definir'}</p>
                        </div>
                        <h4>Titulares</h4>
                        <ul>${awayStarters.length ? renderPlayersList(awayStarters) : '<li>Pendiente</li>'}</ul>
                        <h4>Sustitutos</h4>
                        <ul>${awayLineup?.substitutes?.length ? renderPlayersList(awayLineup.substitutes) : '<li>No disponible</li>'}</ul>
                    </div>
                </div>
            `;
        }

        let statsHtml = `
            <div class="section-heading">
                <div>
                    <p>Datos del juego</p>
                    <h2>Estadísticas</h2>
                </div>
            </div>
        `;
        const statsGroups = match.statistics || [];

        if (statsGroups.length === 0) {
            statsHtml += `<p class="empty-state">Estadísticas aún no disponibles para este encuentro.</p>`;
        } else {
            statsHtml += `<ul class="stats-list">`;
            statsGroups.forEach(group => {
                const statItems = group.statistics || [];
                statItems.forEach(item => {
                    const name = item.name || 'Estadística';
                    const hVal = item.home !== undefined ? item.home : (item.home_value !== undefined ? item.home_value : 0);
                    const aVal = item.away !== undefined ? item.away : (item.away_value !== undefined ? item.away_value : 0);
                    statsHtml += `
                        <li>
                            <span class="stat-label">${name}</span>
                            <span class="stat-value">${homeTeam} ${hVal} - ${aVal} ${awayTeam}</span>
                        </li>
                    `;
                });
            });
            statsHtml += `</ul>`;
        }
        statsSection.innerHTML = statsHtml;

        let timelineHtml = `
            <div class="section-heading">
                <div>
                    <p>Minuto a minuto</p>
                    <h2>Cronología</h2>
                </div>
            </div>
        `;
        const events = match.chronology || [];

        if (events.length === 0) {
            timelineHtml += `<p class="empty-state">No se han registrado eventos en este partido.</p>`;
        } else {
            timelineHtml += `<div class="timeline-list">`;
            events.sort((a, b) => (a.time || 0) - (b.time || 0)).forEach(ev => {
                const minuto = ev.time !== undefined ? `${ev.time}'` : "--'";
                const tipo = ev.type ? `[${ev.type.toUpperCase()}]` : '';
                const jugador = ev.player?.name || ev.player?.player_name || '';
                const entra = ev.player_in?.name || ev.player_in?.player_name ? `🟢 Entra: ${ev.player_in?.name || ev.player_in?.player_name}` : '';
                const sale = ev.player_out?.name || ev.player_out?.player_name ? `🔴 Sale: ${ev.player_out?.name || ev.player_out?.player_name}` : '';
                const tarjeta = ev.card ? (ev.card.toLowerCase().includes('yellow') || ev.card.toLowerCase().includes('amarilla') ? `🟨 Tarjeta Amarilla` : `🟥 Tarjeta Roja`) : '';

                let desc = `<strong>${tipo} ${jugador}</strong> ${tarjeta}`;
                if (entra || sale) desc = `${entra} <br> ${sale}`;

                timelineHtml += `
                    <div class="timeline-item">
                        <div class="timeline-time">${minuto}</div>
                        <div class="timeline-text">${desc}</div>
                    </div>
                `;
            });
            timelineHtml += `</div>`;
        }
        timelineSection.innerHTML = timelineHtml;

    } catch (error) {
        console.error("Error cargando detalle del partido:", error);
        matchHeader.classList.add('is-error');
        matchHeader.innerHTML = `
            <p class="match-eyebrow">Información no disponible</p>
            <h1>Error al cargar el partido</h1>
            <p>No se pudo conectar con el servidor o el ID seleccionado no existe.</p>
        `;
        highlightsSection.hidden = true;
        pitchSection.hidden = true;
        statsSection.hidden = true;
        timelineSection.hidden = true;
        lineupsSection.hidden = true;
    } finally {
        detailPage?.setAttribute('aria-busy', 'false');
    }
}

function renderHighlights(highlights, section) {
    if (!section) return;

    const clips = Array.isArray(highlights)
        ? highlights.filter(clip => getSafeHttpUrl(clip?.url))
        : [];

    section.innerHTML = '';

    const heading = document.createElement('div');
    heading.className = 'section-heading';
    heading.innerHTML = `
        <div>
            <p>Momentos destacados</p>
            <h2>Highlights</h2>
        </div>
        ${clips.length ? `<span class="section-count">${clips.length} videos</span>` : ''}
    `;
    section.appendChild(heading);

    if (clips.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'empty-state';
        emptyState.textContent = 'Los highlights de este partido aún no están disponibles.';
        section.appendChild(emptyState);
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'highlights-grid';
    section.appendChild(grid);

    const loadMoreContainer = document.createElement('div');
    loadMoreContainer.className = 'highlights-more';
    const loadMoreButton = document.createElement('button');
    loadMoreButton.className = 'highlights-more-button';
    loadMoreButton.type = 'button';
    loadMoreButton.textContent = 'Ver más highlights';
    loadMoreContainer.appendChild(loadMoreButton);
    section.appendChild(loadMoreContainer);

    const batchSize = 6;
    let renderedCount = 0;

    const renderNextBatch = () => {
        clips.slice(renderedCount, renderedCount + batchSize).forEach((clip, index) => {
            grid.appendChild(createHighlightCard(clip, renderedCount + index));
        });

        renderedCount = Math.min(renderedCount + batchSize, clips.length);
        loadMoreContainer.hidden = renderedCount >= clips.length;
    };

    loadMoreButton.addEventListener('click', renderNextBatch);
    renderNextBatch();
}

function createHighlightCard(clip, index) {
    const card = document.createElement('article');
    card.className = 'highlight-card';

    const link = document.createElement('a');
    link.className = 'highlight-card__link';
    link.href = getSafeHttpUrl(clip.url);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Reproducir ${clip.title || 'highlight del partido'} (abre en una pestaña nueva)`);

    const media = document.createElement('span');
    media.className = 'highlight-card__media';

    const thumbnailUrl = getSafeHttpUrl(clip.thumbnail_url);
    if (thumbnailUrl) {
        const image = document.createElement('img');
        image.src = thumbnailUrl;
        image.alt = '';
        image.loading = index < 3 ? 'eager' : 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => {
            image.remove();
            media.classList.add('highlight-card__media--fallback');
        }, { once: true });
        media.appendChild(image);
    } else {
        media.classList.add('highlight-card__media--fallback');
    }

    const playIcon = document.createElement('span');
    playIcon.className = 'highlight-card__play';
    playIcon.setAttribute('aria-hidden', 'true');
    playIcon.textContent = '▶';
    media.appendChild(playIcon);

    const body = document.createElement('span');
    body.className = 'highlight-card__body';

    const subtitle = document.createElement('span');
    subtitle.className = 'highlight-card__type';
    subtitle.textContent = clip.subtitle || 'Video del partido';

    const title = document.createElement('strong');
    title.className = 'highlight-card__title';
    title.textContent = clip.title || 'Momento destacado';

    const action = document.createElement('span');
    action.className = 'highlight-card__action';
    action.textContent = 'Ver video ↗';

    body.append(subtitle, title, action);
    link.append(media, body);
    card.appendChild(link);

    return card;
}

function getSafeHttpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';

    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
}

function iniciarCuentaRegresiva(targetDateString) {
    const timerElement = document.getElementById('countdown-timer');
    if (!timerElement) return;

    const targetTime = new Date(targetDateString).getTime();
    if (isNaN(targetTime)) {
        timerElement.textContent = '⏳ Fecha y hora por confirmar';
        return;
    }

    const actualizar = () => {
        const ahora = new Date().getTime();
        const diferencia = targetTime - ahora;

        if (diferencia <= 0) {
            timerElement.textContent = '🔴 ¡El partido está por comenzar o en curso!';
            return;
        }

        const dias = Math.floor(diferencia / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((diferencia % (1000 * 60)) / 1000);

        timerElement.textContent = `⏳ Faltan: ${dias}d ${horas}h ${minutos}m ${segundos}s para el inicio`;
    };

    actualizar();
    setInterval(actualizar, 1000);
}
