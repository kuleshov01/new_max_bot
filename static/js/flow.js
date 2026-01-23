class FlowEditor {
    constructor() {
        this.nodes = [];
        this.connections = [];
        this.selectedNode = null;
        this.draggedNode = null;
        this.draggedConnector = null;
        this.tempConnection = null;
        this.nodeIdCounter = 0;
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.isDraggingCanvas = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.currentBotId = null;
        this.mode = 'edit';

        this.init();
    }
    
    init() {
        this.canvas = document.getElementById('flowCanvas');
        this.nodesContainer = document.getElementById('nodes');
        this.connectionsSvg = document.getElementById('connections');
        this.nodeProperties = document.getElementById('nodeProperties');
        this.botSelect = document.getElementById('botSelect');
        
        this.setupEventListeners();
        this.loadBotFromUrl();
        this.loadBots();
        
        if (!this.currentBotId) {
            this.createStartNode();
        }
        this.render();
    }
    
    loadBotFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const botId = urlParams.get('botId');
        if (botId) {
            this.currentBotId = parseInt(botId);
            this.loadBotFlow(this.currentBotId);
        }
    }
    
    async loadBots() {
        try {
            const response = await fetch('/api/bots');
            const bots = await response.json();
            
            this.botSelect.innerHTML = '<option value="new">+ Создать нового бота...</option>';
            bots.forEach(bot => {
                const option = document.createElement('option');
                option.value = bot.id;
                option.textContent = bot.name;
                if (bot.id === this.currentBotId) {
                    option.selected = true;
                }
                this.botSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading bots:', error);
        }
    }
    
    async loadBotFlow(botId) {
        try {
            const response = await fetch(`/api/bots/${botId}/flow`);
            const flowData = await response.json();
            
            if (flowData && flowData.nodes) {
                this.nodes = flowData.nodes;
                this.connections = flowData.connections || [];
                this.maxNodeId();
                this.render();
            }
        } catch (error) {
            console.error('Error loading bot flow:', error);
        }
    }
    
    maxNodeId() {
        let maxId = 0;
        this.nodes.forEach(node => {
            const match = node.id.match(/node_(\d+)/);
            if (match) {
                const id = parseInt(match[1]);
                if (id > maxId) {
                    maxId = id;
                }
            }
        });
        this.nodeIdCounter = maxId + 1;
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleCanvasMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleCanvasMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        this.botSelect.addEventListener('change', this.handleBotChange.bind(this));
    }
    
    createStartNode() {
        const startNode = {
            id: 'start',
            type: 'message',
            x: 100,
            y: 100,
            text: '👋 Добро пожаловать!\n\nВыберите действие:',
            buttons: [],
            isStart: true
        };
        this.nodes.push(startNode);
    }
    
    addNode(type, x, y) {
        const node = {
            id: `node_${this.nodeIdCounter++}`,
            type: type,
            x: x,
            y: y,
            text: type === 'message' ? 'Введите сообщение...' : 'Выберите вариант:',
            buttons: [],
            isStart: false
        };

        if (type === 'menu') {
            node.buttons = [
                { id: `btn_${this.nodeIdCounter}_0`, text: 'Вариант 1', nextNodeId: null },
                { id: `btn_${this.nodeIdCounter}_1`, text: 'Вариант 2', nextNodeId: null },
                { id: `btn_${this.nodeIdCounter}_back`, text: '⬅️ Назад', nextNodeId: null, isBack: true }
            ];
        }

        this.nodes.push(node);
        this.render();
        return node;
    }

    addUniversalElement() {
        const node = {
            id: `node_${this.nodeIdCounter++}`,
            type: 'universal',
            x: 300,
            y: 100,
            text: 'Введите сообщение...',
            buttons: [
                { id: `btn_${this.nodeIdCounter}_0`, text: 'Вариант 1', nextNodeId: null },
                { id: `btn_${this.nodeIdCounter}_1`, text: 'Вариант 2', nextNodeId: null }
            ],
            isStart: false
        };

        this.nodes.push(node);
        this.render();
        return node;
    }
    
    updateNode(nodeId, updates) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            Object.assign(node, updates);
            this.render();
        }
    }
    
    deleteNode(nodeId) {
        if (nodeId === 'start') return;
        
        this.nodes = this.nodes.filter(n => n.id !== nodeId);
        this.connections = this.connections.filter(c => 
            c.from !== nodeId && c.to !== nodeId
        );
        
        this.nodes.forEach(node => {
            if (node.buttons) {
                node.buttons.forEach(btn => {
                    if (btn.nextNodeId === nodeId) {
                        btn.nextNodeId = null;
                    }
                });
            }
        });
        
        if (this.selectedNode === nodeId) {
            this.selectedNode = null;
            this.showNodeProperties(null);
        }
        
        this.render();
    }
    
    addConnection(buttonId, toNodeId, fromNodeId) {
        this.connections = this.connections.filter(c => c.buttonId !== buttonId);

        if (toNodeId && fromNodeId && toNodeId !== fromNodeId) {
            this.connections.push({
                id: `conn_${this.nodeIdCounter++}`,
                buttonId: buttonId,
                from: fromNodeId,
                to: toNodeId
            });

            const fromNode = this.nodes.find(n => n.id === fromNodeId);
            if (fromNode && fromNode.buttons) {
                const button = fromNode.buttons.find(b => b.id === buttonId);
                if (button) {
                    button.nextNodeId = toNodeId;
                }
            }
        } else {
            const fromNode = this.nodes.find(n => n.id === fromNodeId);
            if (fromNode && fromNode.buttons) {
                const button = fromNode.buttons.find(b => b.id === buttonId);
                if (button) {
                    button.nextNodeId = null;
                }
            }
        }

        this.render();
    }

    addNodeConnection(fromNodeId, toNodeId) {
        this.connections = this.connections.filter(c => !(c.from === fromNodeId && !c.buttonId));

        if (toNodeId && fromNodeId && toNodeId !== fromNodeId) {
            this.connections.push({
                id: `conn_${this.nodeIdCounter++}`,
                from: fromNodeId,
                to: toNodeId
            });
        }

        this.render();
    }

    findNodeIdByButton(buttonId) {
        for (const node of this.nodes) {
            if (node.buttons) {
                for (const button of node.buttons) {
                    if (button.id === buttonId) {
                        return node.id;
                    }
                }
            }
        }
        return null;
    }
    
    handleCanvasMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offset.x) / this.scale;
        const y = (e.clientY - rect.top - this.offset.y) / this.scale;

        if (this.mode === 'connect') {
            if (e.target.closest('.node-button') && e.target.closest('.node-button').dataset.buttonConnectable === 'true') {
                const buttonEl = e.target.closest('.node-button');
                const buttonId = buttonEl.dataset.buttonId;
                const nodeId = buttonEl.closest('.node').dataset.id;

                this.draggedConnector = { type: 'button', id: buttonId, fromNode: nodeId };
                this.tempConnection = {
                    startX: x,
                    startY: y,
                    endX: x,
                    endY: y
                };
                e.stopPropagation();
                return;
            } else if (e.target.closest('.node') && e.target.closest('.node').dataset.nodeConnectable === 'true') {
                const nodeId = e.target.closest('.node').dataset.id;
                if (e.target.classList.contains('delete-btn')) {
                    this.deleteNode(nodeId);
                    e.stopPropagation();
                    return;
                }

                this.draggedConnector = { type: 'node', id: nodeId };
                this.tempConnection = {
                    startX: x,
                    startY: y,
                    endX: x,
                    endY: y
                };
                e.stopPropagation();
                return;
            }
        }

        if (e.target.closest('.node')) {
            const nodeEl = e.target.closest('.node');
            const nodeId = nodeEl.dataset.id;

            if (e.target.classList.contains('delete-btn')) {
                this.deleteNode(nodeId);
                e.stopPropagation();
                return;
            }

            this.selectNode(nodeId);
            this.draggedNode = nodeId;
            this.dragOffset = {
                x: x - this.nodes.find(n => n.id === nodeId).x,
                y: y - this.nodes.find(n => n.id === nodeId).y
            };
            e.stopPropagation();
        } else {
            this.isDraggingCanvas = true;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this.selectedNode = null;
            this.showNodeProperties(null);
            this.render();
        }
    }
    
    handleCanvasMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offset.x) / this.scale;
        const y = (e.clientY - rect.top - this.offset.y) / this.scale;
        
        if (this.draggedConnector) {
            this.tempConnection.endX = x;
            this.tempConnection.endY = y;
            this.renderConnections();
        } else if (this.draggedNode) {
            const node = this.nodes.find(n => n.id === this.draggedNode);
            if (node) {
                node.x = x - this.dragOffset.x;
                node.y = y - this.dragOffset.y;
                this.render();
            }
        } else if (this.isDraggingCanvas) {
            const dx = e.clientX - this.lastMousePos.x;
            const dy = e.clientY - this.lastMousePos.y;
            this.offset.x += dx;
            this.offset.y += dy;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this.render();
        }
    }
    
    handleCanvasMouseUp(e) {
        if (this.draggedConnector) {
            const target = e.target.closest('.node');
            if (target) {
                const toNodeId = target.dataset.id;

                if (this.draggedConnector.type === 'button') {
                    this.addConnection(this.draggedConnector.id, toNodeId, this.draggedConnector.fromNode);
                } else if (this.draggedConnector.type === 'node') {
                    this.addNodeConnection(this.draggedConnector.id, toNodeId);
                }
            } else {
                this.renderConnections();
            }
            this.draggedConnector = null;
            this.tempConnection = null;
        }

        this.draggedNode = null;
        this.isDraggingCanvas = false;
    }
    
    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.scale *= delta;
        this.scale = Math.min(Math.max(this.scale, 0.3), 3);
        this.render();
    }
    
    handleKeyDown(e) {
        if (e.key === 'Delete' && this.selectedNode && this.selectedNode !== 'start') {
            this.deleteNode(this.selectedNode);
        }
    }
    
    handleBotChange(e) {
        const botId = e.target.value;
        if (botId === 'new') {
            this.createNewBot();
        } else if (botId) {
            this.loadBotFlow(botId);
        }
    }

    setMode(mode) {
        this.mode = mode;
        document.getElementById('modeEdit').classList.toggle('active', mode === 'edit');
        document.getElementById('modeConnect').classList.toggle('active', mode === 'connect');

        if (mode === 'connect') {
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.canvas.style.cursor = 'grab';
        }
    }
    selectNode(nodeId) {
        this.selectedNode = nodeId;
        const node = this.nodes.find(n => n.id === nodeId);
        this.showNodeProperties(node);
        this.render();
    }
    
    showNodeProperties(node) {
        if (!node) {
            this.nodeProperties.innerHTML = '<p>Выберите узел для редактирования</p>';
            return;
        }

        let html = `
            <div class="property-group">
                <label>Текст сообщения:</label>
                <textarea id="nodeText">${node.text}</textarea>
            </div>
        `;

        if ((node.type === 'menu' || node.type === 'universal') && node.buttons) {
            html += `
                <div class="property-group">
                    <label>Кнопки:</label>
                    <div id="buttonsList"></div>
                    <button class="btn btn-add" onclick="flowEditor.addButton('${node.id}')">+ Добавить кнопку</button>
                </div>
            `;
        }

        this.nodeProperties.innerHTML = html;

        const textArea = document.getElementById('nodeText');
        textArea.addEventListener('input', (e) => {
            this.updateNode(node.id, { text: e.target.value });
        });

        if (node.type === 'menu' || node.type === 'universal') {
            this.renderButtonsList(node);
        }
    }
    
    renderButtonsList(node) {
        const list = document.getElementById('buttonsList');
        if (!list) return;
        
        list.innerHTML = node.buttons.map((btn, index) => `
            <div class="button-item">
                <input type="text" class="button-text-input" data-index="${index}" value="${btn.text}" onchange="flowEditor.updateButtonText('${node.id}', ${index}, this.value)">
                <button class="remove-button" onclick="flowEditor.removeButton('${node.id}', ${index})">✕</button>
            </div>
        `).join('');
    }
    
    addButton(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.buttons) {
            const buttonId = `btn_${this.nodeIdCounter++}`;
            node.buttons.push({
                id: buttonId,
                text: `Кнопка ${node.buttons.length + 1}`,
                nextNodeId: null
            });
            this.render();
            this.showNodeProperties(node);
        }
    }
    
    removeButton(nodeId, buttonIndex) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.buttons) {
            const buttonId = node.buttons[buttonIndex].id;
            node.buttons.splice(buttonIndex, 1);
            this.connections = this.connections.filter(c => c.buttonId !== buttonId);
            this.render();
            this.showNodeProperties(node);
        }
    }
    
    updateButtonText(nodeId, buttonIndex, text) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.buttons && node.buttons[buttonIndex]) {
            node.buttons[buttonIndex].text = text;
            this.render();
        }
    }
    
    async createNewBot() {
        const name = prompt('Введите название нового бота:');
        if (!name) return;
        
        const token = prompt('Введите токен бота:');
        if (!token) return;
        
        try {
            const response = await fetch('/api/bots', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, token })
            });
            
            if (response.ok) {
                const bot = await response.json();
                this.currentBotId = bot.id;
                await this.loadBots();
                this.nodes = [];
                this.connections = [];
                this.createStartNode();
                this.render();
                alert(`Бот "${name}" создан успешно!`);
            } else {
                alert('Ошибка при создании бота');
            }
        } catch (error) {
            console.error('Error creating bot:', error);
            alert('Ошибка при создании бота');
        }
    }
    
    render() {
        this.syncConnections();
        this.renderNodes();
        this.renderConnections();
    }

    renderNodes() {
        const validation = this.validateConnectivity();
        const disconnectedIds = new Set(validation.disconnected);
        const isConnectMode = this.mode === 'connect';

        this.nodesContainer.className = isConnectMode ? 'mode-connect' : 'mode-edit';

        this.nodesContainer.innerHTML = this.nodes.map(node => {
            const isDisconnected = !node.isStart && disconnectedIds.has(node.id);
            const nodeTypeClass = node.type === 'universal' ? 'message' : node.type;
            return `
            <div class="node node-${nodeTypeClass} ${this.selectedNode === node.id ? 'selected' : ''} ${isDisconnected ? 'disconnected' : ''}"
                 data-id="${node.id}"
                 data-node-connectable="true"
                 style="left: ${node.x}px; top: ${node.y}px;">
                <div class="node-header">
                    <span>${node.isStart ? '🚀 Начало' : (node.type === 'message' || node.type === 'universal' ? '💬 Элемент' : '🎯 Элемент')}</span>
                    ${!node.isStart ? '<button class="delete-btn">🗑️</button>' : ''}
                </div>
                <div class="node-content">
                    <div class="node-text">${this.escapeHtml(node.text).replace(/\n/g, '<br>')}</div>
                    ${node.buttons && node.buttons.length > 0 ? `
                        <div class="node-buttons">
                            ${node.buttons.map(btn => `
                                <div class="node-button" data-button-connectable="true" data-button-id="${btn.id}">
                                    <span>${btn.text}</span>
                                    ${isConnectMode ? '<div class="connector-badge">🔗</div>' : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    ${isConnectMode && !node.isStart ? '<div class="node-connector-target" title="Перетащите для соединения"></div>' : ''}
                </div>
            </div>
        `}).join('');

        this.nodesContainer.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
        this.connectionsSvg.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
    }

    renderConnections() {
        let svg = `
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#95a5a6"/>
                </marker>
            </defs>
        `;
        
        this.connections.forEach(conn => {
            const path = this.calculateConnectionPath(conn);
            if (path) {
                svg += `<path class="connection-line" d="${path}" />`;
                
                const fromNode = this.nodes.find(n => n.id === conn.from);
                const toNode = this.nodes.find(n => n.id === conn.to);
                if (fromNode && fromNode.buttons && toNode) {
                    const button = fromNode.buttons.find(b => b.id === conn.buttonId);
                    if (button) {
                        let startY = fromNode.y + 50;
                        const btnIndex = fromNode.buttons.findIndex(b => b.id === conn.buttonId);
                        if (btnIndex !== -1) {
                            startY = fromNode.y + 70 + (btnIndex * 35);
                        }
                        
                        const startX = fromNode.x + 250;
                        const endX = toNode.x;
                        const endY = toNode.y + 50;
                        
                        const midX = (startX + endX) / 2;
                        const midY = (startY + endY) / 2;
                        
                        svg += `<text class="connection-label" x="${midX}" y="${midY}" text-anchor="middle">${this.escapeHtml(button.text)}</text>`;
                    }
                }
            }
        });
        
        if (this.tempConnection) {
            svg += `<path class="connection-line" d="M ${this.tempConnection.startX} ${this.tempConnection.startY} L ${this.tempConnection.endX} ${this.tempConnection.endY}" style="stroke-dasharray: 5,5;" />`;
        }
        
        this.connectionsSvg.innerHTML = svg;
    }
    
    calculateConnectionPath(conn) {
        const fromNode = this.nodes.find(n => n.id === conn.from);
        const toNode = this.nodes.find(n => n.id === conn.to);

        if (!fromNode || !toNode) return null;

        let startY = fromNode.y + 50;

        if (conn.buttonId && fromNode.buttons) {
            const btnIndex = fromNode.buttons.findIndex(b => b.id === conn.buttonId);
            if (btnIndex !== -1) {
                startY = fromNode.y + 70 + (btnIndex * 35);
            }
        } else if (!conn.buttonId) {
            startY = fromNode.y + 50;
        }

        const startX = fromNode.x + 250;
        const endX = toNode.x;
        const endY = toNode.y + 50;

        const midX = (startX + endX) / 2;

        return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    validateConnectivity() {
        const disconnectedNodes = [];
        const connectedNodeIds = new Set();
        const nodeIdWithOutgoing = new Set();

        if (this.nodes.length === 0) return { valid: true, disconnected: [] };

        connectedNodeIds.add('start');

        this.connections.forEach(conn => {
            connectedNodeIds.add(conn.to);
            nodeIdWithOutgoing.add(conn.from);
        });

        this.nodes.forEach(node => {
            if (!node.isStart && !connectedNodeIds.has(node.id) && !nodeIdWithOutgoing.has(node.id)) {
                disconnectedNodes.push(node.id);
            }
        });

        return {
            valid: disconnectedNodes.length === 0,
            disconnected: disconnectedNodes
        };
    }

    syncConnections() {
        this.nodes.forEach(node => {
            if (node.buttons) {
                node.buttons.forEach(btn => {
                    if (btn.nextNodeId) {
                        const existingConn = this.connections.find(c => c.buttonId === btn.id);
                        if (!existingConn) {
                            this.connections.push({
                                id: `conn_${this.nodeIdCounter++}`,
                                buttonId: btn.id,
                                from: node.id,
                                to: btn.nextNodeId
                            });
                        } else if (existingConn.to !== btn.nextNodeId) {
                            existingConn.to = btn.nextNodeId;
                        }
                    } else {
                        this.connections = this.connections.filter(c => c.buttonId !== btn.id);
                    }
                });
            }
        });
    }

    async saveFlow() {
        this.syncConnections();

        const validation = this.validateConnectivity();
        if (!validation.valid && validation.disconnected.length > 0) {
            const nodeNames = validation.disconnected.map(id => {
                const node = this.nodes.find(n => n.id === id);
                return node ? node.text.substring(0, 20) + '...' : id;
            }).join(', ');
            alert(`Невозможно сохранить! Существуют несвязанные элементы:\n\n${nodeNames}\n\nВсе элементы должны быть подключены к цепочке диалога.`);
            return;
        }

        if (!this.currentBotId) {
            alert('Сначала выберите бота для сохранения');
            return;
        }

        const flowData = {
            nodes: this.nodes,
            connections: this.connections
        };

        try {
            const response = await fetch(`/api/bots/${this.currentBotId}/flow`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(flowData)
            });
            if (response.ok) {
                alert('Диалог сохранен успешно!');
            } else {
                alert('Ошибка при сохранении диалога');
            }
        } catch (error) {
            console.error('Error saving flow:', error);
            alert('Ошибка при сохранении диалога');
        }
    }
    
    exportFlow() {
        const flowData = {
            nodes: this.nodes,
            connections: this.connections
        };
        const json = JSON.stringify(flowData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bot-flow.json';
        a.click();
    }
    
    importFlow() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    this.nodes = data.nodes || [];
                    this.connections = data.connections || [];
                    this.render();
                    alert('Диалог загружен!');
                } catch (error) {
                    alert('Ошибка при загрузке файла');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
}

function addElement() {
    flowEditor.addUniversalElement();
}

function saveFlow() {
    flowEditor.saveFlow();
}

function exportFlow() {
    flowEditor.exportFlow();
}

function importFlow() {
    flowEditor.importFlow();
}

function setMode(mode) {
    flowEditor.setMode(mode);
}

let flowEditor;
document.addEventListener('DOMContentLoaded', () => {
    flowEditor = new FlowEditor();
});