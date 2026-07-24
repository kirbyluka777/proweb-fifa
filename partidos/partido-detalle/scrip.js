document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('id') || 1; 

    loadMatchDetails(matchId);
});

async function loadMatchDetails(matchId) {
    const baseUrl = `https://wc-api-u378.onrender.com/wc-api/api/v1/matches/${matchId}`;
    const getProxyUrl = (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`;

    const matchHeader = document.querySelector('.match-header');
    const pitchSection = document.querySelector('.pitch');
    const statsSection = document.querySelector('.stats');
    const timelineSection = document.querySelector('.timeline');
    const lineupsSection = document.querySelector('section:last-of-type');

    try {
        let res = await fetch(baseUrl).catch(() => null);
        if (!res || !res.ok) {
            res = await fetch(getProxyUrl(baseUrl));
        }

        if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
        const match = await res.json();

        // 1. EXTRAER DATOS
        const homeTeam = match.home_team?.name || match.home_team?.country || 'Local';
        const awayTeam = match.away_team?.name || match.away_team?.country || 'Visitante';
        const homeScore = match.home_score?.total ?? 0;
        const awayScore = match.away_score?.total ?? 0;
        
        const dateStr = match.date || 'Por definir';
        const timeStr = match.time || '00:00:00';
        const cityName = match.city?.name || match.city?.city || 'Sede por definir';
        const stadiumName = match.city?.stadium || match.city?.stadium_name || 'Estadio por definir';
        const referee = match.referee || 'Por definir';
        const roundNum = match.round;
        const roundName = (roundNum !== undefined && roundNum !== 0) ? `Ronda ${roundNum}` : (match.group ? `Grupo ${match.group}` : 'Fase de Grupos');
        
        // 2. VALIDACIÓN INFALIBLE DE ESTATUS Y FECHA
        const statusStr = (match.status || '').toLowerCase();
        const finishedStatuses = ['finished', 'completed', 'full_time', 'ft', 'played'];
        let isFinished = finishedStatuses.includes(statusStr);
        const isLive = ['live', 'in_progress', '1h', '2h', 'ht'].includes(statusStr);

        // Si la API no dice "finished", pero la fecha y hora ya pasaron por más de 3 horas, es un partido terminado
        const matchDateObj = new Date(`${dateStr}T${timeStr}`);
        if (!isFinished && !isLive && !isNaN(matchDateObj.getTime())) {
            if (matchDateObj.getTime() < Date.now() - (3 * 3600 * 1000)) {
                isFinished = true;
            }
        }

        // 3. RENDERIZAR ENCABEZADO
        let headerHtml = `
            <h2>${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}</h2>
            <p><strong>Fecha:</strong> ${dateStr} | <strong>Hora:</strong> ${timeStr} | <strong>Estadio:</strong> ${stadiumName}, ${cityName}</p>
            <p><strong>Árbitro:</strong> ${referee} | <strong>Ronda:</strong> ${roundName}</p>
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

        // 4. RENDERIZAR ALINEACIONES EN CANCHA (.pitch)
        const homeLineup = match.line_ups?.home;
        const awayLineup = match.line_ups?.away;
        const homeStarters = homeLineup?.starting_players || [];
        const awayStarters = awayLineup?.starting_players || [];

        if (homeStarters.length < 11 || awayStarters.length < 11) {
            pitchSection.innerHTML = `<div class="alert" style="background:#111; color:#ffb703; padding:1rem; border:1px solid #ffb703;">Alineación no disponible en cancha (Menos de 11 titulares confirmados)</div>`;
        } else {
            pitchSection.innerHTML = `
                <div class="pitch-lineup">
                    <div class="team-pitch">
                        <h4 style="color:var(--fifa-lime); border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:0.5rem;">${homeTeam} (${homeLineup.formation || 'N/A'})</h4>
                        <p style="line-height:1.8;">${homeStarters.map(p => `<strong>#${p.shirt_number || ''}</strong> ${p.name || p.player_name}`).join('<br>')}</p>
                    </div>
                    <div class="team-pitch">
                        <h4 style="color:var(--fifa-lime); border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:0.5rem;">${awayTeam} (${awayLineup.formation || 'N/A'})</h4>
                        <p style="line-height:1.8;">${awayStarters.map(p => `<strong>#${p.shirt_number || ''}</strong> ${p.name || p.player_name}`).join('<br>')}</p>
                    </div>
                </div>
            `;
        }

        // 5. RENDERIZAR PLANTILLAS Y DT
        const renderPlayersList = (players) => players.map(p => `<li><strong style="color:var(--fifa-gold);">#${p.shirt_number || '-'}</strong> ${p.name || p.player_name || 'Jugador'} ${p.position ? `<span style="color:#aaa; font-size:0.9em;">(${p.position})</span>` : ''}</li>`).join('');

        if (lineupsSection) {
            lineupsSection.className = 'lineups-box';
            lineupsSection.innerHTML = `
                <h3>Alineaciones y Dirección Técnica</h3>
                <div class="lineups-grid">
                    <div class="team-lineup-col">
                        <h4 style="color:var(--fifa-blue); font-size:1.3rem;">${homeTeam}</h4>
                        <p><strong>Formación:</strong> ${homeLineup?.formation || 'Por definir'}</p>
                        <p><strong>DT / Coach:</strong> <span style="color:var(--fifa-lime);">${homeLineup?.coach || 'Por definir'}</span></p>
                        <h5 style="margin-top:1.5rem; border-bottom:1px solid #444; padding-bottom:0.3rem;">Titulares:</h5>
                        <ul>${homeStarters.length ? renderPlayersList(homeStarters) : '<li>Pendiente</li>'}</ul>
                        <h5 style="margin-top:1.5rem; border-bottom:1px solid #444; padding-bottom:0.3rem;">Sustitutos:</h5>
                        <ul>${homeLineup?.substitutes?.length ? renderPlayersList(homeLineup.substitutes) : '<li>No disponible</li>'}</ul>
                    </div>
                    <div class="team-lineup-col">
                        <h4 style="color:var(--fifa-pink); font-size:1.3rem;">${awayTeam}</h4>
                        <p><strong>Formación:</strong> ${awayLineup?.formation || 'Por definir'}</p>
                        <p><strong>DT / Coach:</strong> <span style="color:var(--fifa-lime);">${awayLineup?.coach || 'Por definir'}</span></p>
                        <h5 style="margin-top:1.5rem; border-bottom:1px solid #444; padding-bottom:0.3rem;">Titulares:</h5>
                        <ul>${awayStarters.length ? renderPlayersList(awayStarters) : '<li>Pendiente</li>'}</ul>
                        <h5 style="margin-top:1.5rem; border-bottom:1px solid #444; padding-bottom:0.3rem;">Sustitutos:</h5>
                        <ul>${awayLineup?.substitutes?.length ? renderPlayersList(awayLineup.substitutes) : '<li>No disponible</li>'}</ul>
                    </div>
                </div>
            `;
        }

        // 6. RENDERIZAR ESTADÍSTICAS (ALTO CONTRASTE)
        let statsHtml = `<h3>Estadísticas del Partido</h3>`;
        const statsGroups = match.statistics || [];
        
        if (statsGroups.length === 0) {
            statsHtml += `<p style="color:#aaa;">Estadísticas aún no disponibles para este encuentro.</p>`;
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

        // 7. RENDERIZAR CRONOLOGÍA (LIMPIA Y LEGIBLE)
        let timelineHtml = `<h3>Cronología del Partido</h3>`;
        const events = match.chronology || [];

        if (events.length === 0) {
            timelineHtml += `<p style="color:#aaa;">No se han registrado eventos en este partido.</p>`;
        } else {
            timelineHtml += `<div class="timeline-list">`;
            events.sort((a, b) => (a.time || 0) - (b.time || 0)).forEach(ev => {
                const minuto = ev.time !== undefined ? `${ev.time}'` : "--'";
                const tipo = ev.type ? `[${ev.type.toUpperCase()}]` : '';
                const jugador = ev.player?.name || ev.player?.player_name || '';
                const entra = ev.player_in?.name || ev.player_in?.player_name ? `🟢 Entra: ${ev.player_in?.name || ev.player_in?.player_name}` : '';
                const sale = ev.player_out?.name || ev.player_out?.player_name ? `🔴 Sale: ${ev.player_out?.name || ev.player_out?.player_name}` : '';
                const tarjeta = ev.card ? (ev.card.toLowerCase().includes('yellow') || ev.card.toLowerCase().includes('amarilla') ? `🟨 Tarjeta Amarilla` : `🟥 Tarjeta Roja`) : '';

                let desc = `<strong style="color:#fff;">${tipo} ${jugador}</strong> ${tarjeta}`;
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
        matchHeader.innerHTML = `
            <h2>Error al cargar el partido</h2>
            <p>No se pudo conectar con el servidor o el ID seleccionado no existe.</p>
        `;
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