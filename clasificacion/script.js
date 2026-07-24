const API_BASE = 'https://wc-api-u378.onrender.com/wc-api/api/v1';

let standingsByGroup = {};
let groupNames = [];
let bracketConnections = [];
let bracketResizeObserver;
let bracketDrawFrame = 0;
let redrawBracket = () => {};

async function fetchApi(endpoint) {
    const apiUrl = `${API_BASE}/${endpoint}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
    return await fetchWithCache(proxyUrl)
}

function asCollection(data) {
    return Array.isArray(data) ? data : Object.values(data || {});
}

function apiGroupNames(apiStandings, teams, matches) {
    return [...new Set([
        ...Object.keys(apiStandings || {}),
        ...teams.map((team) => team.group),
        ...matches.map((match) => match.group)
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

function apiGroupRounds(matches) {
    return new Set(
        matches.filter((match) => match.group).map((match) => match.round)
    );
}

function editDistance(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex];
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            current[rightIndex] = Math.min(
                current[rightIndex - 1] + 1,
                previous[rightIndex] + 1,
                previous[rightIndex - 1] + (
                    left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
                )
            );
        }
        previous.splice(0, previous.length, ...current);
    }

    return previous[right.length];
}

function apiTeamMap(teams, matches) {
    const teamMap = new Map(teams.map((team) => [team.id, team]));
    const participantIds = new Set(
        matches.flatMap((match) => [match.home_id, match.away_id]).filter(Boolean)
    );
    const unseenTeams = teams.filter((team) => !participantIds.has(team.id));
    const unknownIds = [...participantIds].filter((id) =>
        !teamMap.has(id) && /^[A-Z]+$/.test(id)
    );

    unknownIds.forEach((id) => {
        const ranked = unseenTeams
            .map((team) => ({ team, distance: editDistance(id, team.id) }))
            .sort((a, b) => a.distance - b.distance);
        const closest = ranked[0];
        const uniquelyClosest = closest && ranked[1]?.distance !== closest.distance;
        const closestUnknowns = closest && unknownIds.filter((candidate) =>
            editDistance(candidate, closest.team.id) === closest.distance
        );

        if (
            uniquelyClosest &&
            closest.distance === 1 &&
            closestUnknowns.length === 1
        ) {
            teamMap.set(id, closest.team);
        }
    });

    return teamMap;
}

function emptyStanding(team) {
    return {
        team,
        position: 0,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_scored: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0
    };
}

function deriveStandings(teams, matches, groups, teamMap) {
    const tables = Object.fromEntries(groups.map((group) => [group, []]));
    const rows = new Map();
    const groupRounds = apiGroupRounds(matches);

    teams.forEach((team) => {
        if (!tables[team.group]) return;
        const standing = emptyStanding(team);
        tables[team.group].push(standing);
        rows.set(team.id, standing);
    });

    matches
        .filter((match) => groupRounds.has(match.round))
        .filter((match) => String(match.status).toLowerCase() === 'ended')
        .forEach((match) => {
            const home = rows.get(teamMap.get(match.home_id)?.id);
            const away = rows.get(teamMap.get(match.away_id)?.id);
            if (!home && !away) return;

            const homeGoals = Number(match.home_score?.total) || 0;
            const awayGoals = Number(match.away_score?.total) || 0;
            if (home) {
                home.matches += 1;
                home.goals_scored += homeGoals;
                home.goals_against += awayGoals;
            }
            if (away) {
                away.matches += 1;
                away.goals_scored += awayGoals;
                away.goals_against += homeGoals;
            }

            if (homeGoals > awayGoals) {
                if (home) {
                    home.wins += 1;
                    home.points += 3;
                }
                if (away) away.losses += 1;
            } else if (awayGoals > homeGoals) {
                if (away) {
                    away.wins += 1;
                    away.points += 3;
                }
                if (home) home.losses += 1;
            } else {
                if (home) {
                    home.draws += 1;
                    home.points += 1;
                }
                if (away) {
                    away.draws += 1;
                    away.points += 1;
                }
            }
        });

    groups.forEach((group) => {
        tables[group].forEach((row) => {
            row.goal_difference = row.goals_scored - row.goals_against;
        });
        tables[group].sort((a, b) =>
            b.points - a.points ||
            b.goal_difference - a.goal_difference ||
            b.goals_scored - a.goals_scored ||
            a.team.name.localeCompare(b.team.name, 'es')
        );
        tables[group].forEach((row, index) => {
            row.position = index + 1;
        });
    });

    return tables;
}

function normalizeApiStandings(apiStandings, groups) {
    const normalized = {};
    groups.forEach((group) => {
        normalized[group] = asCollection(apiStandings[group]).map((row) => ({
            ...row,
            losses: row.losses ?? row.loss ?? 0
        }));
    });
    return normalized;
}

function renderGroupOptions(groups) {
    const filter = document.getElementById('group-filter');
    const allOption = filter.options[0];
    const options = groups.map((group) => {
        const option = document.createElement('option');
        option.value = group;
        option.textContent = `Grupo ${group}`;
        return option;
    });
    filter.replaceChildren(allOption, ...options);
}

function teamCell(row) {
    const wrapper = document.createElement('div');
    const position = document.createElement('span');
    const name = document.createElement('span');
    const team = row.team;

    wrapper.className = 'team-cell';
    position.className = 'position';
    position.textContent = row.position;
    name.textContent = team?.name || team?.id || '';
    wrapper.append(position);

    const content = team?.id ? document.createElement('a') : document.createElement('span');
    content.className = 'team-link';
    if (team?.id) {
        content.href = `/equipos/equipo-detalle/?id=${encodeURIComponent(team.id)}`;
        content.setAttribute('aria-label', `Ver detalles de ${team.name || team.id}`);
    }

    const flagUrl = team?.flag_url || team?.flag_uri;
    if (flagUrl) {
        const flag = document.createElement('img');
        flag.className = 'team-flag';
        flag.src = flagUrl;
        flag.alt = '';
        content.append(flag);
    }

    content.append(name);
    wrapper.append(content);
    return wrapper;
}

function tableCell(content) {
    const cell = document.createElement('td');
    if (content instanceof Node) cell.append(content);
    else cell.textContent = content;
    return cell;
}

function createGroupTable(group, rows) {
    const article = document.createElement('article');
    const title = document.createElement('h3');
    const wrap = document.createElement('div');
    const table = document.createElement('table');
    const head = document.createElement('thead');
    const body = document.createElement('tbody');

    article.className = 'group-table';
    article.dataset.group = group;
    title.textContent = `Grupo ${group}`;
    wrap.className = 'table-wrap';
    table.className = 'data-table';
    head.innerHTML = '<tr><th>Equipo</th><th>Pts</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>DG</th></tr>';

    rows.forEach((standing) => {
        const row = document.createElement('tr');
        row.append(
            tableCell(teamCell(standing)),
            tableCell(standing.points),
            tableCell(standing.matches),
            tableCell(standing.wins),
            tableCell(standing.draws),
            tableCell(standing.losses),
            tableCell(standing.goal_difference)
        );
        body.append(row);
    });

    table.append(head, body);
    wrap.append(table);
    article.append(title, wrap);
    return article;
}

function renderStandings(selectedGroup = 'all') {
    const grid = document.getElementById('standings-grid');
    const groups = selectedGroup === 'all' ? groupNames : [selectedGroup];
    grid.replaceChildren(...groups.map((group) => createGroupTable(group, standingsByGroup[group] || [])));
}

function teamName(id, teamMap) {
    return teamMap.get(id)?.name || id || '';
}

function matchWinnerId(match) {
    if (String(match.status).toLowerCase() !== 'ended') return null;

    const homePenalty = Number(match.home_score?.penalty);
    const awayPenalty = Number(match.away_score?.penalty);
    if (
        Number.isFinite(homePenalty) &&
        Number.isFinite(awayPenalty) &&
        homePenalty !== awayPenalty
    ) {
        return homePenalty > awayPenalty ? match.home_id : match.away_id;
    }

    const homeScore = Number(match.home_score?.total);
    const awayScore = Number(match.away_score?.total);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore === awayScore) {
        return null;
    }
    return homeScore > awayScore ? match.home_id : match.away_id;
}

function matchTeam(id, score, teamMap, isWinner) {
    const team = teamMap.get(id);
    const row = team?.id ? document.createElement('a') : document.createElement('div');
    const left = document.createElement('div');
    const name = document.createElement('span');
    const result = document.createElement('strong');

    row.className = `bracket-team${isWinner ? ' bracket-team--winner' : ''}`;
    row.title = teamName(id, teamMap);
    if (team?.id) {
        row.href = `/equipos/equipo-detalle/?id=${encodeURIComponent(team.id)}`;
        row.setAttribute('aria-label', `Ver detalles de ${team.name || team.id}`);
    }
    left.className = 'bracket-team__left';
    name.className = 'bracket-team__name';
    name.textContent = team?.id || id || '';
    result.className = 'bracket-team__score';
    result.textContent = score;
    const flagUrl = team?.flag_url || team?.flag_uri;
    if (flagUrl) {
        const flag = document.createElement('img');
        flag.className = 'bracket-team__flag';
        flag.src = flagUrl;
        flag.alt = '';
        left.append(flag);
    }
    left.append(name);
    row.append(left, result);
    return row;
}

function createMatchCard(match, teamMap, side, matchNumber, { isFinal = false } = {}) {
    const card = document.createElement('article');
    const row = document.createElement('div');
    const content = document.createElement('div');
    const teams = document.createElement('div');
    const label = document.createElement('span');
    const datetime = document.createElement('p');
    const winnerId = matchWinnerId(match);
    const homeScore = match.home_score?.total ?? '';
    const awayScore = match.away_score?.total ?? '';

    card.className = `bracket-match bracket-match--${side}`;
    card.dataset.matchNumber = matchNumber;
    row.className = 'bracket-match__row';
    content.className = 'bracket-match__content';
    teams.className = 'bracket-match__teams';
    label.className = 'bracket-match__label';
    label.textContent = `M${matchNumber}`;
    datetime.className = 'bracket-match__datetime';
    if (String(match.status).toLowerCase() === 'ended') {
        datetime.textContent = 'Finalizado';
    } else if (String(match.status).toLowerCase() === 'halftime') {
        datetime.textContent = 'Descanso';
    } else {
        datetime.innerHTML = `<span>${match.date || ''}</span><span>${match.time?.slice(0, 5) || ''}</span>`;
    }

    teams.append(
        matchTeam(match.home_id, homeScore, teamMap, winnerId === match.home_id),
        matchTeam(match.away_id, awayScore, teamMap, winnerId === match.away_id)
    );

    if (isFinal && winnerId) {
        const message = document.createElement('p');
        message.className = 'bracket-match__winner-message';
        message.textContent = `¡Felicidades, ${teamName(winnerId, teamMap)}!`;
        teams.append(message);
    }

    content.append(datetime, teams);
    row.append(label, content);
    card.append(row);
    return card;
}

function numberedKnockoutMatches(matches) {
    const groupRounds = apiGroupRounds(matches);
    const groupMatchCount = matches.filter((match) => groupRounds.has(match.round)).length;

    return matches
        .filter((match) => !groupRounds.has(match.round))
        .sort((a, b) =>
            `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) ||
            String(a.id).localeCompare(String(b.id), 'es', { numeric: true })
        )
        .map((match, index) => ({ match, number: groupMatchCount + index + 1 }));
}

function knockoutStages(entries) {
    const stagesByRound = new Map();

    entries.forEach((entry) => {
        const round = entry.match.round;
        if (!stagesByRound.has(round)) {
            stagesByRound.set(round, { round, entries: [] });
        }
        stagesByRound.get(round).entries.push(entry);
    });

    const stages = [...stagesByRound.values()];
    const sideStages = stages
        .filter((stage) => stage.entries.length > 1)
        .sort((a, b) => b.entries.length - a.entries.length);
    const centerStages = stages
        .filter((stage) => stage.entries.length === 1)
        .sort((a, b) => a.entries[0].number - b.entries[0].number);

    return { sideStages, centerStages };
}

function createBracketLeaf(entry, teamMap, side) {
    const leaf = document.createElement('div');
    const match = createMatchCard(entry.match, teamMap, side, entry.number);
    leaf.className = `bracket-leaf bracket-leaf--${side}`;
    leaf.append(match);
    return { element: leaf, output: match };
}

function createBracketNode(sourceA, sourceB, targetEntry, teamMap, side) {
    const node = document.createElement('div');
    const sources = document.createElement('div');
    const target = document.createElement('div');
    const targetMatch = createMatchCard(targetEntry.match, teamMap, side, targetEntry.number);

    node.className = `bracket-node bracket-node--${side}`;
    node.dataset.targetMatch = targetEntry.number;
    sources.className = 'bracket-node__sources bracket-pair';
    sources.dataset.targetMatch = targetEntry.number;
    sourceA.element.dataset.pairSlot = 'a';
    sourceB.element.dataset.pairSlot = 'b';
    target.className = 'bracket-node__target';
    sources.append(sourceA.element, sourceB.element);
    target.append(targetMatch);
    node.append(sources, target);

    bracketConnections.push({
        node,
        sourceA: sourceA.output,
        sourceB: sourceB.output,
        target: targetMatch,
        side,
        svg: null
    });

    return { element: node, output: targetMatch };
}

function resolveFeederEntry(reference, candidates, usedEntries) {
    const available = candidates.filter((candidate) => !usedEntries.has(candidate));
    const digits = String(reference || '').match(/^[WL](\d+)$/i)?.[1];

    if (digits) {
        const exact = available.find((candidate) => candidate.number === Number(digits));
        if (exact) return exact;

        const prefixMatches = available.filter((candidate) =>
            String(candidate.number).startsWith(digits)
        );
        if (prefixMatches.length === 1) return prefixMatches[0];
    }

    const winnerMatches = available.filter((candidate) =>
        matchWinnerId(candidate.match) === reference
    );
    return winnerMatches.length === 1 ? winnerMatches[0] : null;
}

function resolveFeederEntries(entry, candidates) {
    const used = new Set();
    const references = [entry.match.home_id, entry.match.away_id];

    return references.map((reference) => {
        const source = resolveFeederEntry(reference, candidates, used);
        if (!source) {
            throw new Error(`No se pudo resolver el origen API de ${reference}`);
        }
        used.add(source);
        return source;
    });
}

function buildBracketBranch(entry, previousStages, teamMap, side) {
    if (!previousStages.length) return createBracketLeaf(entry, teamMap, side);

    const [previousStage, ...earlierStages] = previousStages;
    const [sourceEntryA, sourceEntryB] = resolveFeederEntries(entry, previousStage.entries);
    return createBracketNode(
        buildBracketBranch(sourceEntryA, earlierStages, teamMap, side),
        buildBracketBranch(sourceEntryB, earlierStages, teamMap, side),
        entry,
        teamMap,
        side
    );
}

function buildBracketHalf(rootEntry, previousStages, teamMap, side) {
    const root = buildBracketBranch(rootEntry, previousStages, teamMap, side);
    root.element.classList.add('bracket-half', `bracket-half--${side}`);
    return root;
}

function createCenterColumn(finalEntry, thirdPlaceEntry, teamMap) {
    const center = document.createElement('div');
    center.className = 'bracket-center';

    let finalStage = null;
    let finalMatch = null;
    if (finalEntry) {
        finalStage = document.createElement('section');
        const finalTitle = document.createElement('h3');
        finalMatch = createMatchCard(
            finalEntry.match,
            teamMap,
            'center',
            finalEntry.number,
            { isFinal: true }
        );
        finalStage.className = 'bracket-center__stage bracket-center__stage--final';
        finalTitle.className = 'bracket-center__stage-title';
        finalTitle.textContent = 'Final';
        finalMatch.classList.add('bracket-match--final');
        finalStage.append(finalTitle, finalMatch);
        center.append(finalStage);
    }

    let thirdStage = null;
    let thirdMatch = null;
    if (thirdPlaceEntry) {
        thirdStage = document.createElement('section');
        const thirdTitle = document.createElement('h4');
        thirdMatch = createMatchCard(thirdPlaceEntry.match, teamMap, 'center', thirdPlaceEntry.number);
        thirdStage.className = 'bracket-center__stage bracket-center__stage--third';
        thirdTitle.className = 'bracket-center__stage-title';
        thirdTitle.textContent = 'Tercer lugar';
        thirdMatch.classList.add('bracket-match--third');
        thirdStage.append(thirdTitle, thirdMatch);
        center.append(thirdStage);
    }

    return {
        element: center,
        finalStage,
        finalMatch,
        thirdStage,
        thirdMatch
    };
}

function sideStageLabel(stage) {
    const matches = stage.entries.length;
    if (matches === 16) return 'Dieciseisavos';
    if (matches === 8) return 'Octavos';
    if (matches === 4) return 'Cuartos de final';
    if (matches === 2) return 'Semifinales';
    return `Ronda ${stage.round}`;
}

function createBracketHeaders(sideStages) {
    const headers = document.createElement('div');
    const leftLabels = sideStages.map(sideStageLabel);
    const labels = [...leftLabels, ...leftLabels.toReversed()];

    headers.className = 'bracket-headers';
    labels.forEach((label, index) => {
        const heading = document.createElement('h3');
        heading.textContent = label;
        if (index >= leftLabels.length) heading.className = 'bracket-headers__right';
        headers.append(heading);
    });
    return headers;
}

function pointRelativeTo(
    element,
    edge,
    containerRect,
    edgeSelector = '.bracket-match__teams',
    centerSelector = edgeSelector
) {
    const edgeAnchor = element.querySelector(edgeSelector) || element;
    const centerAnchor = element.querySelector(centerSelector) || edgeAnchor;
    const edgeRect = edgeAnchor.getBoundingClientRect();
    const centerRect = centerAnchor.getBoundingClientRect();
    const edgeX = edge === 'left' ? edgeRect.left : edgeRect.right;
    return {
        x: Math.round(edgeX - containerRect.left) + 0.5,
        y: Math.round(
            centerRect.top + centerRect.height / 2 - containerRect.top
        ) + 0.5
    };
}

function bracePath(connection, containerRect) {
    const sourceEdge = connection.side === 'left' ? 'right' : 'left';
    const targetEdge = connection.side === 'left' ? 'left' : 'right';
    const pointA = pointRelativeTo(connection.sourceA, sourceEdge, containerRect);
    const pointB = pointRelativeTo(connection.sourceB, sourceEdge, containerRect);
    const target = pointRelativeTo(
        connection.target,
        targetEdge,
        containerRect,
        '.bracket-match__label',
        '.bracket-match__teams'
    );
    const top = pointA.y <= pointB.y ? pointA : pointB;
    const bottom = pointA.y <= pointB.y ? pointB : pointA;
    const direction = Math.sign(target.x - top.x) || (connection.side === 'left' ? 1 : -1);
    const radius = Math.min(
        4,
        Math.abs(target.x - top.x) / 2,
        Math.abs(target.y - top.y) / 2,
        Math.abs(bottom.y - target.y) / 2
    );
    const spineX = top.x + direction * radius;

    return [
        `M ${top.x} ${top.y}`,
        `C ${top.x + direction * radius} ${top.y}, ${spineX} ${top.y + radius}, ${spineX} ${top.y + radius * 2}`,
        `V ${target.y} H ${target.x}`,
        `M ${bottom.x} ${bottom.y}`,
        `C ${bottom.x + direction * radius} ${bottom.y}, ${spineX} ${bottom.y - radius}, ${spineX} ${bottom.y - radius * 2}`,
        `V ${target.y} H ${target.x}`
    ].join(' ');
}

function createConnectorSvg(className, rect) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', className);
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    svg.setAttribute('width', rect.width);
    svg.setAttribute('height', rect.height);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    return svg;
}

function appendPath(svg, pathData) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'bracket-connector__path');
    path.setAttribute('d', pathData);
    svg.append(path);
}

function drawNodeConnectors() {
    bracketConnections.forEach((connection) => {
        connection.svg?.remove();
        const rect = connection.node.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const svg = createConnectorSvg('bracket-node__connector', rect);
        appendPath(svg, bracePath(connection, rect));
        connection.node.prepend(svg);
        connection.svg = svg;
    });
}

function boxRelativeTo(element, selector, containerRect) {
    const rect = (element.querySelector(selector) || element).getBoundingClientRect();
    return {
        top: rect.top - containerRect.top,
        right: rect.right - containerRect.left,
        bottom: rect.bottom - containerRect.top,
        left: rect.left - containerRect.left,
        width: rect.width,
        height: rect.height
    };
}

function positionCenterStages(body, leftSemi, rightSemi, center) {
    const bodyRect = body.getBoundingClientRect();
    const leftBox = boxRelativeTo(leftSemi, '.bracket-match__content', bodyRect);
    const rightBox = boxRelativeTo(rightSemi, '.bracket-match__content', bodyRect);
    const pairTop = Math.min(leftBox.top, rightBox.top);
    const pairBottom = Math.max(leftBox.bottom, rightBox.bottom);

    if (center.finalStage) {
        const stageHeight = center.finalStage.getBoundingClientRect().height;
        const top = Math.max(0, pairTop - stageHeight - 40);
        center.finalStage.style.top = `${Math.round(top)}px`;
    }

    if (center.thirdStage) {
        const stageHeight = center.thirdStage.getBoundingClientRect().height;
        const top = Math.min(bodyRect.height - stageHeight, pairBottom + 40);
        center.thirdStage.style.top = `${Math.round(top)}px`;
    }
}

function bridgePath(leftSemi, rightSemi, placement, containerRect) {
    const leftBox = boxRelativeTo(leftSemi, '.bracket-match__content', containerRect);
    const rightBox = boxRelativeTo(rightSemi, '.bracket-match__content', containerRect);
    const leftX = Math.round(leftBox.left + leftBox.width / 2) + 0.5;
    const rightX = Math.round(rightBox.left + rightBox.width / 2) + 0.5;
    const middleX = (leftX + rightX) / 2;
    const curve = 4;
    const tick = 10;

    if (placement === 'top') {
        const y = Math.round(Math.min(leftBox.top, rightBox.top) - 16) + 0.5;
        return [
            `M ${leftX} ${y + curve}`,
            `C ${leftX} ${y + curve / 2}, ${leftX + curve / 2} ${y}, ${leftX + curve} ${y}`,
            `H ${rightX - curve}`,
            `C ${rightX - curve / 2} ${y}, ${rightX} ${y + curve / 2}, ${rightX} ${y + curve}`,
            `M ${middleX} ${y} V ${y - tick}`
        ].join(' ');
    }

    const y = Math.round(Math.max(leftBox.bottom, rightBox.bottom) + 16) + 0.5;
    return [
        `M ${leftX} ${y - curve}`,
        `C ${leftX} ${y - curve / 2}, ${leftX + curve / 2} ${y}, ${leftX + curve} ${y}`,
        `H ${rightX - curve}`,
        `C ${rightX - curve / 2} ${y}, ${rightX} ${y - curve / 2}, ${rightX} ${y - curve}`,
        `M ${middleX} ${y} V ${y + tick}`
    ].join(' ');
}

function drawFinalConnectors(body, leftSemi, rightSemi, center) {
    body.querySelector(':scope > .bracket-final-connectors')?.remove();
    if (!leftSemi || !rightSemi) return;

    const rect = body.getBoundingClientRect();
    const svg = createConnectorSvg('bracket-final-connectors', rect);
    appendPath(svg, bridgePath(leftSemi, rightSemi, 'top', rect));
    if (center.thirdMatch) {
        appendPath(svg, bridgePath(leftSemi, rightSemi, 'bottom', rect));
    }
    body.prepend(svg);
}

function scheduleConnectorDraw(body, leftSemi, rightSemi, center) {
    cancelAnimationFrame(bracketDrawFrame);
    bracketDrawFrame = requestAnimationFrame(() => {
        positionCenterStages(body, leftSemi, rightSemi, center);
        drawNodeConnectors();
        drawFinalConnectors(body, leftSemi, rightSemi, center);
        bracketDrawFrame = 0;
    });
}

function setupClassificationTabs() {
    const tablist = document.querySelector('.classification-tabs');
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];

    const activateTab = (tab, moveFocus = false) => {
        tabs.forEach((item) => {
            const isActive = item === tab;
            const panel = document.getElementById(item.getAttribute('aria-controls'));
            item.classList.toggle('is-active', isActive);
            item.setAttribute('aria-selected', isActive);
            item.tabIndex = isActive ? 0 : -1;
            panel.hidden = !isActive;
        });

        if (moveFocus) tab.focus();
        if (tab.id === 'brackets-tab') redrawBracket();
    };

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => activateTab(tab));
    });

    tablist.addEventListener('keydown', (event) => {
        const currentIndex = tabs.indexOf(document.activeElement);
        if (currentIndex < 0) return;

        let nextIndex;
        if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        if (nextIndex === undefined) return;

        event.preventDefault();
        activateTab(tabs[nextIndex], true);
    });
}

function enableBracketPanning(view) {
    if (!view || view.dataset.mousePan === 'true') return;

    let pointerId = null;
    let originX = 0;
    let originY = 0;
    let originScrollLeft = 0;
    let originScrollTop = 0;

    const stopPanning = (event) => {
        if (pointerId !== event.pointerId) return;
        if (view.hasPointerCapture(pointerId)) view.releasePointerCapture(pointerId);
        pointerId = null;
        view.classList.remove('is-panning');
    };

    view.dataset.mousePan = 'true';
    view.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;

        pointerId = event.pointerId;
        originX = event.clientX;
        originY = event.clientY;
        originScrollLeft = view.scrollLeft;
        originScrollTop = view.scrollTop;
        view.classList.add('is-panning');
        view.setPointerCapture(pointerId);
        event.preventDefault();
    });
    view.addEventListener('pointermove', (event) => {
        if (pointerId !== event.pointerId) return;
        view.scrollLeft = originScrollLeft - (event.clientX - originX);
        view.scrollTop = originScrollTop - (event.clientY - originY);
    });
    view.addEventListener('pointerup', stopPanning);
    view.addEventListener('pointercancel', stopPanning);
    view.addEventListener('lostpointercapture', (event) => {
        if (pointerId !== event.pointerId) return;
        pointerId = null;
        view.classList.remove('is-panning');
    });
    view.addEventListener('dragstart', (event) => event.preventDefault());
}

function renderBracket(matches, teamMap) {
    const bracket = document.getElementById('tournament-brackets');
    const bracketView = bracket.closest('.tournament-brackets-view');
    const { sideStages, centerStages } = knockoutStages(numberedKnockoutMatches(matches));
    bracket.style.setProperty('--bracket-stage-columns', sideStages.length * 2);
    bracket.style.setProperty('--bracket-half-width', `${sideStages.length * 11.5}rem`);
    const semifinalStage = sideStages.at(-1);
    const previousStages = sideStages.slice(0, -1).toReversed();
    const finalStage = centerStages.find((stage) => {
        const match = stage.entries[0].match;
        return [match.home_id, match.away_id].every((id) => /^W/i.test(id));
    }) || centerStages.at(-1);
    const thirdPlaceStage = centerStages.find((stage) => {
        const match = stage.entries[0].match;
        return [match.home_id, match.away_id].every((id) => /^L/i.test(id));
    }) || centerStages.find((stage) => stage !== finalStage);
    const [leftSemifinal, rightSemifinal] = semifinalStage.entries;

    bracketConnections = [];
    bracketResizeObserver?.disconnect();
    const left = buildBracketHalf(leftSemifinal, previousStages, teamMap, 'left');
    const right = buildBracketHalf(rightSemifinal, previousStages, teamMap, 'right');
    const center = createCenterColumn(
        finalStage?.entries[0],
        thirdPlaceStage?.entries[0],
        teamMap
    );
    const body = document.createElement('div');
    body.className = 'bracket-body';
    body.append(left.element, right.element, center.element);

    bracket.replaceChildren(createBracketHeaders(sideStages), body);
    enableBracketPanning(bracketView);
    redrawBracket = () => scheduleConnectorDraw(body, left.output, right.output, center);
    redrawBracket();

    if ('ResizeObserver' in window) {
        bracketResizeObserver = new ResizeObserver(() =>
            scheduleConnectorDraw(body, left.output, right.output, center)
        );
        bracketResizeObserver.observe(body);
        if (bracketView) bracketResizeObserver.observe(bracketView);
        bracketResizeObserver.observe(left.output);
        bracketResizeObserver.observe(right.output);
        if (center.finalStage) bracketResizeObserver.observe(center.finalStage);
        if (center.thirdStage) bracketResizeObserver.observe(center.thirdStage);
    }
}

async function loadClassification() {
    const [apiStandings, matchesData, teamsData] = await Promise.all([
        fetchApi('standings'),
        fetchApi('matches'),
        fetchApi('teams')
    ]);

    const matches = asCollection(matchesData);
    const teams = asCollection(teamsData);
    const teamMap = apiTeamMap(teams, matches);
    groupNames = apiGroupNames(apiStandings, teams, matches);
    const derivedStandings = deriveStandings(teams, matches, groupNames, teamMap);
    const apiTables = normalizeApiStandings(apiStandings, groupNames);
    standingsByGroup = Object.fromEntries(groupNames.map((group) => [
        group,
        apiTables[group].length ? apiTables[group] : derivedStandings[group]
    ]));

    renderGroupOptions(groupNames);
    renderStandings();
    renderBracket(matches, teamMap);
}

document.getElementById('group-filter').addEventListener('change', (event) => {
    renderStandings(event.target.value);
});

document.addEventListener('DOMContentLoaded', () => {
    setupClassificationTabs();
    loadClassification();
});
