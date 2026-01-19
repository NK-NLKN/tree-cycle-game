console.log("Tree Cycle Game Initialized");

// Configuration
// Changed to 'let' to ensure mutability is clear
let CONFIG = {
    degree: 2, // Binary tree
    depth: 4,  // Default, but overwritten by startLevel
    nodeSize: 35,
    verticalSpacing: 100,
    colors: ['#FF5252', '#448AFF', '#00E676', '#FFD740'] // Red, Blue, Green, Yellow
};

// Level Data
// Removed first 10 levels (which were Depth 2)
// Original arrays had 30 items. Now 20 items.
const LEVEL_CONFIG = {
    turnLimits: [9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 13, 13, 13, 13, 14, 14, 14, 14, 15, 15],
    scoreTargets: [700, 800, 900, 1000, 1150, 1300, 1450, 1600, 1800, 2000, 2600, 3000, 3500, 4100, 4800, 5600, 6500, 7500, 8700, 10000]
};

// State
let nodes = []; // Flat array of all nodes (can also be a map id->node)
let rootNode = null;
let nextNodeId = 1;

// Level State
let currentLevelIdx = 0; // 0-based
let movesLeft = 0;
let targetScore = 0;

let isProcessing = false; // block input while cascading
let score = 0;
let turnState = {
    active: false,
    baseScore: 0,
    matchCount: 0
};

class Node {
    constructor(depth, parent = null) {
        this.id = nextNodeId++;
        this.depth = depth;
        this.parent = parent; // Reference to parent Node object
        this.children = [];   // Array of references to child Node objects
        this.color = this.getRandomColor();
        this.x = 0;
        this.y = 0;
        this.element = null; // DOM Element
    }

    getRandomColor() {
        return CONFIG.colors[Math.floor(Math.random() * CONFIG.colors.length)];
    }
}

function initGame() {
    startLevel(0);
}

function startLevel(idx) {
    if (idx >= LEVEL_CONFIG.turnLimits.length) {
        alert("You beat the whole game! Restarting.");
        idx = 0;
    }

    currentLevelIdx = idx;
    movesLeft = LEVEL_CONFIG.turnLimits[idx];
    targetScore = LEVEL_CONFIG.scoreTargets[idx];
    score = 0;

    // Set Difficulty (Tree Depth)
    if (currentLevelIdx < 10) {
        CONFIG.depth = 3; // Levels 1-10: Depth 3 (Medium Tree, 15 Nodes)
    } else {
        CONFIG.depth = 4; // Levels 11+: Depth 4 (Full Tree, 31 Nodes)
    }

    console.log(`Starting Level ${currentLevelIdx + 1}. Depth: ${CONFIG.depth}`);

    // Reset Board Logic
    const container = document.getElementById('game-container');

    // Completely clear container including SVG and UI to rebuild fresh
    container.innerHTML = '';

    // Re-add SVG structure
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute('id', 'connections');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '10');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    polygon.setAttribute('fill', 'rgba(255,255,255,0.8)');
    marker.appendChild(polygon);
    defs.appendChild(marker);
    svg.appendChild(defs);
    container.appendChild(svg);

    // Re-add UI
    const uiHeader = document.createElement('div');
    uiHeader.id = 'ui-header';
    uiHeader.innerHTML = `
        <div id="level-display">Level: ${currentLevelIdx + 1}</div>
        <div id="moves-display">Moves: ${movesLeft}</div>
        <div id="score-display">Score: 0 / ${targetScore}</div>
    `;
    container.appendChild(uiHeader);

    const comboDisplay = document.createElement('div');
    comboDisplay.id = 'combo-display';
    container.appendChild(comboDisplay);

    const overlay = document.createElement('div');
    overlay.id = 'message-overlay';
    overlay.className = 'hidden';
    overlay.innerHTML = `
        <h2 id="message-title">Level Complete!</h2>
        <button id="message-btn">Next Level</button>
    `;
    container.appendChild(overlay);

    nodes = [];
    nextNodeId = 1;
    rootNode = null;
    indicatorGroup = null; // Reset indicator group reference

    // Rebuild
    createTree();
    calculatePositions();
    preventInitialMatches();
    renderTree();

    turnState.active = false;
    isProcessing = false;
    updateScoreUI();
}

// Reset for a new turn
function startTurn() {
    turnState = {
        active: true,
        baseScore: 0,
        matchCount: 0
    };
    updateScoreUI();
}

function updateScoreUI() {
    const sEl = document.getElementById('score-display');
    const mEl = document.getElementById('moves-display');
    const lEl = document.getElementById('level-display');

    if (sEl) sEl.innerText = `Score: ${score} / ${targetScore}`;
    if (mEl) mEl.innerText = `Moves: ${movesLeft}`;
    if (lEl) lEl.innerText = `Level: ${currentLevelIdx + 1}`;

    // Combo
    const comboEl = document.getElementById('combo-display');
    if (comboEl) {
        if (turnState.active && turnState.matchCount > 1) {
            const mult = Math.min(4, 1 + (turnState.matchCount - 1) * 0.5);
            comboEl.innerText = `x${mult} Combo!`;
        } else {
            // Already cleared in finalize
        }
    }
}

function handleNodeClick(node) {
    if (isProcessing || movesLeft <= 0) return;
    if (node.children.length === 0) return;

    startTurn();
    cycleNode(node);

    // Refresh indicators
    hideCycleIndicators();
    showCycleIndicators(node);
}

function checkLevelStatus() {
    const overlay = document.getElementById('message-overlay');
    const title = document.getElementById('message-title');
    const btn = document.getElementById('message-btn');

    // Win immediately if target score reached
    if (score >= targetScore) {
        // Win
        title.innerText = `Level ${currentLevelIdx + 1} Complete!`;
        title.style.color = '#00E676';
        btn.innerText = "Next Level";
        btn.onclick = () => startLevel(currentLevelIdx + 1);
        overlay.classList.remove('hidden');
        isProcessing = true;
    } else if (movesLeft <= 0) {
        // Loss (only if moves run out AND score not met)
        title.innerText = "Out of Moves!";
        title.style.color = '#FF5252';
        btn.innerText = "Try Again";
        btn.onclick = () => startLevel(currentLevelIdx);
        overlay.classList.remove('hidden');
        isProcessing = true;
    }
}

function finalizeTurn() {
    if (turnState.matchCount > 0) {
        const multiplier = Math.min(4, 1 + (turnState.matchCount - 1) * 0.5);
        const turnTotal = Math.floor(turnState.baseScore * multiplier);
        score += turnTotal;
        updateScoreUI();

        // Clear combo
        const comboEl = document.getElementById('combo-display');
        if (comboEl) comboEl.innerText = '';
    }
    turnState.active = false;

    // Decrease Moves
    movesLeft--;
    updateScoreUI();

    checkLevelStatus();
}


function preventInitialMatches() {
    let attempts = 0;
    while (attempts < 50) {
        const matches = findMatchesInternal();
        if (matches.size === 0) break;

        console.log(`Resolving ${matches.size} initial matches...`);
        matches.forEach(node => {
            node.color = node.getRandomColor();
        });
        attempts++;
    }
}

function findMatchesInternal() {
    const matchedNodes = new Set();
    const visited = new Set();

    for (let node of nodes) {
        if (!visited.has(node) && node.color !== null) {
            const group = getConnectedGroup(node);
            group.forEach(n => visited.add(n));

            if (group.length >= 3) {
                group.forEach(n => matchedNodes.add(n));
            }
        }
    }
    return matchedNodes;
}

function createTree() {
    rootNode = new Node(0);
    nodes.push(rootNode);

    let currentLevel = [rootNode];
    // Loop based on CONFIG.depth
    for (let d = 1; d <= CONFIG.depth; d++) {
        let nextLevel = [];
        for (let parentNode of currentLevel) {
            for (let i = 0; i < CONFIG.degree; i++) {
                let child = new Node(d, parentNode);
                parentNode.children.push(child);
                nodes.push(child);
                nextLevel.push(child);
            }
        }
        currentLevel = nextLevel;
    }
}

function calculatePositions() {
    const container = document.getElementById('game-container');
    const width = container.clientWidth;
    const startY = 80;

    const levels = [];
    for (let i = 0; i <= CONFIG.depth; i++) levels[i] = [];
    nodes.forEach(n => levels[n.depth].push(n));

    // Strategy 2: Leaf-based positioning
    // 1. Position leaves evenly.
    const leaves = levels[CONFIG.depth];
    const leafCount = leaves.length;

    const leafSpacing = leafCount > 0 ? (width - 40) / leafCount : width;

    leaves.forEach((node, i) => {
        node.x = 20 + i * leafSpacing + leafSpacing / 2;
        node.y = startY + node.depth * CONFIG.verticalSpacing;
    });

    // 2. Work up
    for (let d = CONFIG.depth - 1; d >= 0; d--) {
        levels[d].forEach(node => {
            node.y = startY + node.depth * CONFIG.verticalSpacing;
            if (node.children.length > 0) {
                const firstChild = node.children[0];
                const lastChild = node.children[node.children.length - 1];
                node.x = (firstChild.x + lastChild.x) / 2;
            }
        });
    }
}

function renderTree() {
    const container = document.getElementById('game-container');
    const svg = document.getElementById('connections');

    nodes.forEach(node => {
        if (node.parent) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', node.parent.x);
            line.setAttribute('y1', node.parent.y);
            line.setAttribute('x2', node.x);
            line.setAttribute('y2', node.y);
            line.setAttribute('stroke', 'rgba(255,255,255,0.3)');
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
        }
    });

    nodes.forEach(node => {
        const el = document.createElement('div');
        el.className = 'node';
        el.style.backgroundColor = node.color;
        el.style.left = node.x + 'px';
        el.style.top = node.y + 'px';
        el.id = `node-${node.id}`;

        el.addEventListener('click', () => handleNodeClick(node));
        el.addEventListener('mouseenter', () => showCycleIndicators(node));
        el.addEventListener('mouseleave', () => hideCycleIndicators());

        container.appendChild(el);
        node.element = el;
    });
}

let indicatorGroup = null;

function showCycleIndicators(node) {
    if (node.children.length === 0 || isProcessing) return;

    const svg = document.getElementById('connections');

    if (!indicatorGroup) {
        indicatorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        indicatorGroup.setAttribute('id', 'indicators');
        svg.appendChild(indicatorGroup);
    }
    indicatorGroup.innerHTML = '';

    const color = 'rgba(255, 255, 255, 0.8)';
    const width = Math.max(1, 4 - node.depth);

    const leftChild = node.children[0];
    const rightChild = node.children[1];

    if (!leftChild || !rightChild) return;

    const paths = [
        { start: rightChild, end: node },
        { start: node, end: leftChild },
        { start: leftChild, end: rightChild }
    ];

    paths.forEach(path => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', path.start.x);
        line.setAttribute('y1', path.start.y);
        line.setAttribute('x2', path.end.x);
        line.setAttribute('y2', path.end.y);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', width);
        line.setAttribute('marker-end', 'url(#arrowhead)');
        line.setAttribute('stroke-dasharray', '5,5');

        const animate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        animate.setAttribute('attributeName', 'stroke-dashoffset');
        animate.setAttribute('from', '10');
        animate.setAttribute('to', '0');
        animate.setAttribute('dur', '1s');
        animate.setAttribute('repeatCount', 'indefinite');
        line.appendChild(animate);

        indicatorGroup.appendChild(line);
    });
}

function hideCycleIndicators() {
    if (indicatorGroup) {
        indicatorGroup.innerHTML = '';
    }
}

function cycleNode(node) {
    if (node.children.length === 0) return;

    const parentColor = node.color;
    const childColors = node.children.map(c => c.color);

    node.color = childColors[childColors.length - 1];

    node.children[0].color = parentColor;
    for (let i = 1; i < node.children.length; i++) {
        node.children[i].color = childColors[i - 1];
    }

    updateNodeVisuals(node);
    node.children.forEach(c => updateNodeVisuals(c));

    checkMatches();
}

function updateNodeVisuals(node) {
    if (node.element) {
        node.element.style.backgroundColor = node.color;
    }
}

function checkMatches() {
    isProcessing = true;
    const visited = new Set();
    const matchedGroups = [];

    // 1. Identify all unique groups
    for (let node of nodes) {
        if (!visited.has(node) && node.color !== null) {
            const group = getConnectedGroup(node);
            group.forEach(n => visited.add(n));

            if (group.length >= 3) {
                matchedGroups.push(group);
            }
        }
    }

    if (matchedGroups.length > 0) {
        matchedGroups.forEach(group => {
            // Scoring: (Count - 2) * 100
            const pts = (group.length - 2) * 100;
            turnState.baseScore += pts;
            turnState.matchCount++;

            // Remove
            const nodeSet = new Set(group);
            removeNodes(nodeSet);
        });

        updateScoreUI();
        setTimeout(runGravityLoop, 300);
    } else {
        isProcessing = false; // Reset processing state
        if (turnState.active) {
            finalizeTurn();
        }
        console.log("No matches found. Turn ready.");
    }
}

function getConnectedGroup(startNode) {
    const group = [];
    const color = startNode.color;
    const queue = [startNode];
    const visitedInSearch = new Set();
    visitedInSearch.add(startNode);

    while (queue.length > 0) {
        const current = queue.shift();
        group.push(current);

        const neighbors = [];
        if (current.parent) neighbors.push(current.parent);
        if (current.children) neighbors.push(...current.children);

        for (let neighbor of neighbors) {
            if (!visitedInSearch.has(neighbor) && neighbor.color === color) {
                visitedInSearch.add(neighbor);
                queue.push(neighbor);
            }
        }
    }
    return group;
}

function removeNodes(nodeSet) {
    nodeSet.forEach(node => {
        node.color = null;
        updateNodeVisuals(node);
    });
}

function runGravityLoop() {
    let changed = applyGravityStep();

    if (rootNode.color === null) {
        rootNode.color = rootNode.getRandomColor();
        updateNodeVisuals(rootNode);
        changed = true;
    }

    if (changed) {
        setTimeout(runGravityLoop, 200);
    } else {
        checkMatches();
    }
}

function applyGravityStep() {
    let changed = false;

    for (let d = CONFIG.depth - 1; d >= 0; d--) {
        const levelNodes = nodes.filter(n => n.depth === d);

        for (let node of levelNodes) {
            if (node.color !== null) {
                const target = node.children.find(c => c.color === null);

                if (target) {
                    target.color = node.color;
                    node.color = null;
                    updateNodeVisuals(target);
                    updateNodeVisuals(node);
                    changed = true;
                }
            }
        }
    }
    return changed;
}

window.onload = initGame;
