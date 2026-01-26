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
        this.DEBUG_ENABLED = true;

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

    addApiNode() {
        const node = {
            id: `node_${this.nodeIdCounter++}`,
            type: 'api_request',
            x: 300,
            y: 100,
            method: 'POST',
            url: 'https://api.example.com/endpoint',
            headers: '{}',
            body: '{}',
            extractVars: '[]',
            ignoreError: false, // Whether to ignore error responses and not create error connections
            isStart: false
        };

        this.nodes.push(node);
        this.render();
        this.selectNode(node.id);
        return node;
    }

    addConditionNode() {
        const node = {
            id: `node_${this.nodeIdCounter++}`,
            type: 'condition',
            x: 300,
            y: 100,
            condition: '{{user_text}} == "999"',
            isStart: false
        };

        this.nodes.push(node);
        this.render();
        this.selectNode(node.id);
        return node;
    }

    addTransformNode() {
        const node = {
            id: `node_${this.nodeIdCounter++}`,
            type: 'transform',
            x: 300,
            y: 100,
            transformations: [],
            isStart: false
        };

        this.nodes.push(node);
        this.render();
        this.selectNode(node.id);
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
        // Remove only regular node connections (without buttonId and without type)
        // Preserve API connections (which have a type property)
        this.connections = this.connections.filter(c =>
            !(c.from === fromNodeId && !c.buttonId && !c.type)
        );

        if (toNodeId && fromNodeId && toNodeId !== fromNodeId) {
            this.connections.push({
                id: `conn_${this.nodeIdCounter++}`,
                from: fromNodeId,
                to: toNodeId
            });
        }

        this.render();
    }

    addApiConnection(fromNodeId, toNodeId, connectionType) {
        // Remove any existing API connections of the same type from this node
        // But keep other types (e.g., keep 'error' when adding 'success')
        this.connections = this.connections.filter(c =>
            !(c.from === fromNodeId && c.type === connectionType)
        );

        if (toNodeId && fromNodeId && toNodeId !== fromNodeId) {
            this.connections.push({
                id: `conn_${this.nodeIdCounter++}`,
                from: fromNodeId,
                to: toNodeId,
                type: connectionType  // 'success' or 'error'
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
            // Handle condition connector clicks
            if (e.target.closest('.condition-connector')) {
                const connectorEl = e.target.closest('.condition-connector');
                const connectionType = connectorEl.dataset.connectionType;
                const nodeId = connectorEl.closest('.node').dataset.id;

                this.draggedConnector = {
                    type: 'condition',
                    id: `${nodeId}_${connectionType}`,
                    fromNode: nodeId,
                    connectionType: connectionType
                };
                this.tempConnection = {
                    startX: x,
                    startY: y,
                    endX: x,
                    endY: y
                };
                e.stopPropagation();
                return;
            }
            // Handle API connector clicks
            else if (e.target.closest('.api-connector')) {
                const connectorEl = e.target.closest('.api-connector');
                const connectionType = connectorEl.dataset.connectionType;
                const nodeId = connectorEl.closest('.node').dataset.id;

                this.draggedConnector = {
                    type: 'api',
                    id: `${nodeId}_${connectionType}`,
                    fromNode: nodeId,
                    connectionType: connectionType
                };
                this.tempConnection = {
                    startX: x,
                    startY: y,
                    endX: x,
                    endY: y
                };
                e.stopPropagation();
                return;
            }
            // Handle regular button clicks
            else if (e.target.closest('.node-button') && e.target.closest('.node-button').dataset.buttonConnectable === 'true') {
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
            }
            // Handle node connector clicks
            else if (e.target.closest('.node') && e.target.closest('.node').dataset.nodeConnectable === 'true') {
                const nodeId = e.target.closest('.node').dataset.id;
                const node = this.nodes.find(n => n.id === nodeId);

                if (e.target.classList.contains('delete-btn')) {
                    this.deleteNode(nodeId);
                    e.stopPropagation();
                    return;
                }

                // Prevent node connections for API and condition nodes - they should only use specific connectors
                if (node && (node.type === 'api_request' || node.type === 'condition')) {
                    // Don't allow general node connections for API and condition nodes
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
                } else if (this.draggedConnector.type === 'api') {
                    this.addApiConnection(this.draggedConnector.fromNode, toNodeId, this.draggedConnector.connectionType);
                } else if (this.draggedConnector.type === 'condition') {
                    this.addConditionConnection(this.draggedConnector.fromNode, toNodeId, this.draggedConnector.connectionType);
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

        this.render();
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

        let html = '';

        if (node.type === 'api_request') {
            const headersData = this.parseHeaders(node.headers || '{}');
            const extractVarsData = JSON.parse(node.extractVars || '[]');

            html = `
                <div class="property-group">
                    <label>Метод:</label>
                    <select id="apiMethod">
                        <option value="GET" ${node.method === 'GET' ? 'selected' : ''}>GET</option>
                        <option value="POST" ${node.method === 'POST' ? 'selected' : ''}>POST</option>
                        <option value="PUT" ${node.method === 'PUT' ? 'selected' : ''}>PUT</option>
                        <option value="DELETE" ${node.method === 'DELETE' ? 'selected' : ''}>DELETE</option>
                        <option value="PATCH" ${node.method === 'PATCH' ? 'selected' : ''}>PATCH</option>
                    </select>
                </div>
                <div class="property-group">
                    <label>URL:</label>
                    <input type="text" id="apiUrl" value="${node.url}" placeholder="https://api.example.com/{{user_text}}">
                </div>
                <div class="property-group">
                    <label>Заголовки:</label>
                    <div id="headersList">
                        ${headersData.map((h, i) => `
                            <div class="header-row">
                                <input type="text" class="header-key-input" data-index="${i}" value="${h.key}" placeholder="Название">
                                <input type="text" class="header-value-input" data-index="${i}" value="${h.value}" placeholder="Значение">
                                <button class="btn-remove-header" data-node-id="${node.id}" data-index="${i}">✕</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-add" id="btnAddHeader" data-node-id="${node.id}">+ Добавить заголовок</button>
                </div>
                <div class="property-group">
                    <label>Тело запроса (JSON):</label>
                    <textarea id="apiBody" rows="5" placeholder='{"text": "{{user_text}}"}'>${node.body || '{}'}</textarea>
                </div>
                <div class="property-group">
                    <label>Извлечь переменные из ответа: <span class="tooltip-icon" data-tooltip="Извлекает данные из JSON ответа API в переменные для использования в следующих узлах. Поддерживает вложенность через точку.">ℹ️</span></label>
                    <div class="help-box">
                        <div class="help-box-title">Примеры:</div>
                        <div>• <code>data.user_id</code> → <code>user_id</code></div>
                        <div>• <code>items[0].name</code> → <code>first_item_name</code></div>
                        <div>• <code>response.success</code> → <code>is_success</code></div>
                    </div>
                    <div id="extractVarsList">
                        ${extractVarsData.map((v, i) => `
                            <div class="extract-vars-row">
                                <input type="text" class="extract-field-input" data-index="${i}" value="${v.field}" placeholder="data.user_id">
                                <input type="text" class="extract-var-input" data-index="${i}" value="${v.var}" placeholder="user_id">
                                <button class="btn-remove-extract" data-node-id="${node.id}" data-index="${i}">✕</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-add" id="btnAddExtractVar" data-node-id="${node.id}">+ Добавить переменную</button>
                </div>
                <div class="property-group">
                    <label>
                        <input type="checkbox" id="apiIgnoreError" ${node.ignoreError ? 'checked' : ''}>
                        Игнорировать ошибочные ответы API <span class="tooltip-icon" data-tooltip="Если включено, при ошибке API не будет создаваться отдельное соединение">ℹ️</span>
                    </label>
                </div>
                <button class="btn btn-action" onclick="flowEditor.testApiRequest('${node.id}')">🧪 Тестировать запрос <span class="tooltip-icon" data-tooltip="Выполняет запрос к API без сохранения переменных. Полезно для проверки URL, заголовков и ответа сервера перед деплоем бота.">ℹ️</span></button>
            `;
        } else if (node.type === 'condition') {
            html = `
                <div class="property-group">
                    <label>Условие: <span class="tooltip-icon" data-tooltip="Выражение для проверки. Можно использовать переменные и операторы сравнения (==, !=, >, <, >=, <=)">ℹ️</span></label>
                    <textarea id="nodeCondition" rows="3" placeholder='{{user_text}} == "999"'>${node.condition || ''}</textarea>
                </div>
                <div class="help-box">
                    <div class="help-box-title">Примеры:</div>
                    <div>• <code>{{user_text}} == "999"</code></div>
                    <div>• <code>{{response.success}} == true</code></div>
                    <div>• <code>{{contact_phone}} != "" && {{geo_latitude}} > 0</code></div>
                </div>
                <div class="property-group">
                    <label>Доступные переменные:</label>
                    <div class="variables-list">
                        <code>{{user_text}}</code> — текст пользователя<br>
                        <code>{{contact_phone}}</code> — телефон<br>
                        <code>{{contact_name}}</code> — полное имя<br>
                        <code>{{contact_first_name}}</code> — имя<br>
                        <code>{{contact_last_name}}</code> — фамилия<br>
                        <code>{{geo_latitude}}</code> — широта<br>
                        <code>{{geo_longitude}}</code> — долгота<br>
                        <code>{{response}}</code> — полный ответ API (если предыдущий узел был API)<br>
                        <code>{{*_переменные*}}</code> — переменные, извлеченные из API
                    </div>
                </div>
            `;
        } else if (node.type === 'transform') {
            const transformations = node.transformations || [];
            html = `
                <div class="property-group">
                    <label>Трансформации переменных:</label>
                    <div class="help-box">
                        <div class="help-box-title">Создайте новые переменные на основе существующих:</div>
                        <div>• Исходное значение: <code>{{var_name}}</code></div>
                        <div>• Выражение: используйте JavaScript для трансформации</div>
                        <div>• Результат: сохраняется как <code>{{new_var_name}}</code></div>
                    </div>
                    <div id="transformationsList">
                        ${transformations.map((t, i) => `
                            <div class="transform-row">
                                <input type="text" class="transform-var-input" data-index="${i}" value="${t.var || ''}" placeholder="new_var_name">
                                <span>=</span>
                                <input type="text" class="transform-expression-input" data-index="${i}" value="${t.expression || ''}" placeholder="{{contact_name}} + ' - ' + {{contact_phone}}">
                                <button class="btn-remove-transform" data-node-id="${node.id}" data-index="${i}">✕</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-add" id="btnAddTransform" data-node-id="${node.id}">+ Добавить трансформацию</button>
                </div>
                <div class="property-group">
                    <label>Доступные переменные:</label>
                    <div class="variables-list">
                        <code>{{user_text}}</code> — текст пользователя<br>
                        <code>{{contact_phone}}</code> — телефон<br>
                        <code>{{contact_name}}</code> — полное имя<br>
                        <code>{{contact_first_name}}</code> — имя<br>
                        <code>{{contact_last_name}}</code> — фамилия<br>
                        <code>{{geo_latitude}}</code> — широта<br>
                        <code>{{geo_longitude}}</code> — долгота<br>
                        <code>{{response}}</code> — полный ответ API<br>
                        <code>{{*_переменные*}}</code> — переменные из API и предыдущих трансформаций
                    </div>
                </div>
            `;
        } else {
            html = `
                <div class="property-group">
                    <label>Текст сообщения:</label>
                    <textarea id="nodeText">${node.text}</textarea>
                </div>
                <div class="property-group">
                    <label>
                        <input type="checkbox" id="nodeCollectInput" ${node.collectInput ? 'checked' : ''}>
                        Собирать текстовые сообщения от пользователя <span class="tooltip-icon" data-tooltip="Если включено, текстовое сообщение пользователя будет сохранено в переменную {{user_text}} для использования в следующих узлах">ℹ️</span>
                    </label>
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
        }

        this.nodeProperties.innerHTML = html;

        this.setupNodePropertyListeners(node);
    }

    setupNodePropertyListeners(node) {
        if (node.type === 'api_request') {
            const apiMethod = document.getElementById('apiMethod');
            const apiUrl = document.getElementById('apiUrl');
            const apiBody = document.getElementById('apiBody');

            if (apiMethod) {
                apiMethod.addEventListener('change', (e) => {
                    this.updateNode(node.id, { method: e.target.value });
                });
            }
            if (apiUrl) {
                apiUrl.addEventListener('input', (e) => {
                    this.updateNode(node.id, { url: e.target.value });
                });
            }
            if (apiBody) {
                apiBody.addEventListener('input', (e) => {
                    this.updateNode(node.id, { body: e.target.value });
                });
            }

            document.querySelectorAll('.btn-remove-header').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const nodeId = e.target.dataset.nodeId;
                    const index = parseInt(e.target.dataset.index);
                    this.removeHeader(nodeId, index);
                });
            });

            document.querySelectorAll('.btn-remove-extract').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const nodeId = e.target.dataset.nodeId;
                    const index = parseInt(e.target.dataset.index);
                    this.removeExtractVar(nodeId, index);
                });
            });

            document.getElementById('btnAddHeader').addEventListener('click', (e) => {
                e.preventDefault();
                const nodeId = e.target.dataset.nodeId;
                this.addHeader(nodeId);
            });

            document.getElementById('btnAddExtractVar').addEventListener('click', (e) => {
                e.preventDefault();
                const nodeId = e.target.dataset.nodeId;
                this.addExtractVar(nodeId);
            });

            document.querySelectorAll('.header-key-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    this.updateHeader(node.id, parseInt(e.target.dataset.index), 'key', e.target.value);
                });
            });
            document.querySelectorAll('.header-value-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    this.updateHeader(node.id, parseInt(e.target.dataset.index), 'value', e.target.value);
                });
            });

            document.querySelectorAll('.extract-field-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    this.updateExtractVar(node.id, parseInt(e.target.dataset.index), 'field', e.target.value);
                });
            });
            document.querySelectorAll('.extract-var-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    this.updateExtractVar(node.id, parseInt(e.target.dataset.index), 'var', e.target.value);
                });
            });

            const apiIgnoreError = document.getElementById('apiIgnoreError');
            if (apiIgnoreError) {
                apiIgnoreError.addEventListener('change', (e) => {
                    this.updateNode(node.id, { ignoreError: e.target.checked });
                });
            }
        } else if (node.type === 'condition') {
            const nodeCondition = document.getElementById('nodeCondition');
            if (nodeCondition) {
                nodeCondition.addEventListener('input', (e) => {
                    this.updateNode(node.id, { condition: e.target.value });
                });
            }
        } else {
            const textArea = document.getElementById('nodeText');
            if (textArea) {
                textArea.addEventListener('input', (e) => {
                    this.updateNode(node.id, { text: e.target.value });
                });
            }

            const collectInput = document.getElementById('nodeCollectInput');
            if (collectInput) {
                collectInput.addEventListener('change', (e) => {
                    this.updateNode(node.id, { collectInput: e.target.checked });
                });
            }

            if (node.type === 'menu' || node.type === 'universal') {
                this.renderButtonsList(node);

                document.querySelectorAll('.button-type-input').forEach(select => {
                    select.addEventListener('change', (e) => {
                        this.updateButtonType(node.id, parseInt(e.target.dataset.index), e.target.value);
                    });
                });

                document.querySelectorAll('.button-url-input').forEach(input => {
                    input.addEventListener('input', (e) => {
                        this.updateButtonUrl(node.id, parseInt(e.target.dataset.index), e.target.value);
                    });
                });
            }

            if (node.type === 'transform') {
                document.querySelectorAll('.btn-remove-transform').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const nodeId = e.target.dataset.nodeId;
                        const index = parseInt(e.target.dataset.index);
                        this.removeTransform(nodeId, index);
                    });
                });

                document.getElementById('btnAddTransform').addEventListener('click', (e) => {
                    e.preventDefault();
                    const nodeId = e.target.dataset.nodeId;
                    this.addTransform(nodeId);
                });

                document.querySelectorAll('.transform-var-input').forEach(input => {
                    input.addEventListener('input', (e) => {
                        this.updateTransform(node.id, parseInt(e.target.dataset.index), 'var', e.target.value);
                    });
                });

                document.querySelectorAll('.transform-expression-input').forEach(input => {
                    input.addEventListener('input', (e) => {
                        this.updateTransform(node.id, parseInt(e.target.dataset.index), 'expression', e.target.value);
                    });
                });
            }
        }
    }

    parseHeaders(headersStr) {
        try {
            const parsed = JSON.parse(headersStr);
            if (Array.isArray(parsed)) {
                return parsed;
            } else if (typeof parsed === 'object') {
                return Object.keys(parsed).map(key => ({ key, value: parsed[key] }));
            }
            return [{ key: 'Content-Type', value: 'application/json' }];
        } catch {
            return [{ key: 'Content-Type', value: 'application/json' }];
        }
    }

    addHeader(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const headersData = this.parseHeaders(node.headers || '{}');
        headersData.push({ key: '', value: '' });

        this.updateNode(nodeId, { headers: JSON.stringify(headersData) });
        this.showNodeProperties(node);
    }

    removeHeader(nodeId, index) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const headersData = this.parseHeaders(node.headers || '{}');
        headersData.splice(index, 1);

        this.updateNode(nodeId, { headers: JSON.stringify(headersData) });
        this.showNodeProperties(node);
    }

    updateHeader(nodeId, index, field, value) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const headersData = this.parseHeaders(node.headers || '{}');
        headersData[index][field] = value;

        this.updateNode(nodeId, { headers: JSON.stringify(headersData) });
    }

    addExtractVar(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const extractVars = JSON.parse(node.extractVars || '[]');
        extractVars.push({ field: '', var: '' });

        this.updateNode(nodeId, { extractVars: JSON.stringify(extractVars) });
        this.showNodeProperties(node);
    }

    removeExtractVar(nodeId, index) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const extractVars = JSON.parse(node.extractVars || '[]');
        extractVars.splice(index, 1);

        this.updateNode(nodeId, { extractVars: JSON.stringify(extractVars) });
        this.showNodeProperties(node);
    }

    updateExtractVar(nodeId, index, field, value) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const extractVars = JSON.parse(node.extractVars || '[]');
        extractVars[index][field] = value;

        this.updateNode(nodeId, { extractVars: JSON.stringify(extractVars) });
    }

    addTransform(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const transformations = node.transformations || [];
        transformations.push({ var: '', expression: '' });

        this.updateNode(nodeId, { transformations });
        this.showNodeProperties(node);
    }

    removeTransform(nodeId, index) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const transformations = node.transformations || [];
        transformations.splice(index, 1);

        this.updateNode(nodeId, { transformations });
        this.showNodeProperties(node);
    }

    updateTransform(nodeId, index, field, value) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const transformations = node.transformations || [];
        transformations[index][field] = value;

        this.updateNode(nodeId, { transformations });
    }

    async testApiRequest(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        try {
            const method = document.getElementById('apiMethod').value;
            const url = document.getElementById('apiUrl').value;
            const headersData = this.parseHeaders(node.headers || '{}');
            const headersObj = {};
            headersData.forEach(h => {
                if (h.key) headersObj[h.key] = h.value;
            });
            const bodyStr = document.getElementById('apiBody').value;

            const options = {
                method: method,
                headers: headersObj
            };

            if (method !== 'GET' && method !== 'HEAD') {
                try {
                    options.body = JSON.parse(bodyStr);
                } catch {
                    options.body = bodyStr;
                }
            }

            const response = await fetch(url, options);
            const result = await response.text();

            alert(`Статус: ${response.status}\n\nОтвет:\n${result.substring(0, 500)}`);
        } catch (error) {
            alert(`Ошибка: ${error.message}`);
        }
    }
    
    renderButtonsList(node) {
        const list = document.getElementById('buttonsList');
        if (!list) return;
        
        list.innerHTML = node.buttons.map((btn, index) => `
            <div class="button-item">
                <input type="text" class="button-text-input" data-index="${index}" value="${btn.text}" onchange="flowEditor.updateButtonText('${node.id}', ${index}, this.value)">
                <select class="button-type-input" data-index="${index}" onchange="flowEditor.updateButtonType('${node.id}', ${index}, this.value)">
                    <option value="callback" ${btn.type === 'callback' ? 'selected' : ''}>Callback</option>
                    <option value="link" ${btn.type === 'link' ? 'selected' : ''}>Ссылка</option>
                    <option value="web_app" ${btn.type === 'web_app' ? 'selected' : ''}>Мини-приложение</option>
                    <option value="request_contact" ${btn.type === 'request_contact' ? 'selected' : ''}>Запросить контакт</option>
                    <option value="request_location" ${btn.type === 'request_location' ? 'selected' : ''}>Запросить геолокацию</option>
                    <option value="message" ${btn.type === 'message' ? 'selected' : ''}>Отправить сообщение</option>
                </select>
                ${btn.type === 'link' || btn.type === 'web_app' ? `<input type="text" class="button-url-input" data-index="${index}" value="${btn.url || ''}" placeholder="${btn.type === 'link' ? 'URL ссылки' : 'ID мини-приложения'}" onchange="flowEditor.updateButtonUrl('${node.id}', ${index}, this.value)">` : ''}
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
                nextNodeId: null,
                type: 'callback',
                url: '',
                appId: ''
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

    updateButtonType(nodeId, buttonIndex, type) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.buttons && node.buttons[buttonIndex]) {
            node.buttons[buttonIndex].type = type;
            this.render();
            this.showNodeProperties(node);
        }
    }

    updateButtonUrl(nodeId, buttonIndex, url) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.buttons && node.buttons[buttonIndex]) {
            node.buttons[buttonIndex].url = url;
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
            let nodeTypeClass = node.type;
            if (node.type === 'universal') nodeTypeClass = 'message';

            let icon = '';
            if (node.isStart) icon = '🚀 Начало';
            else if (node.type === 'message' || node.type === 'universal') icon = '💬 Элемент';
            else if (node.type === 'api_request') icon = '🌐 API Запрос';
            else if (node.type === 'condition') icon = '🔀 Условие';
            else if (node.type === 'transform') icon = '⚙️ Обработка данных';

            let content = '';
            if (node.type === 'api_request') {
                content = `<div class="node-text">${node.method} ${this.escapeHtml(node.url).substring(0, 40)}...</div>`;
            } else if (node.type === 'condition') {
                content = `<div class="node-text">${this.escapeHtml(node.condition)}</div>`;
            } else if (node.type === 'transform') {
                const transformations = node.transformations || [];
                const count = transformations.length;
                content = `<div class="node-text">${count} трансформаций</div>`;
            } else {
                content = `<div class="node-text">${this.escapeHtml(node.text).replace(/\n/g, '<br>')}</div>`;
            }

            return `
            <div class="node node-${nodeTypeClass} ${this.selectedNode === node.id ? 'selected' : ''} ${isDisconnected ? 'disconnected' : ''}"
                 data-id="${node.id}"
                 data-node-connectable="true"
                 style="left: ${node.x}px; top: ${node.y}px;">
                <div class="node-header">
                    <span>${icon}</span>
                    ${!node.isStart ? '<button class="delete-btn" data-delete-node="true">🗑️</button>' : ''}
                </div>
                <div class="node-content">
                    ${content}
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
                    ${isConnectMode && node.type === 'api_request' ? `
                        <div class="api-connection-options">
                            <div class="api-connector api-success-connector" data-connection-type="success" title="Соединение при успешном ответе">
                                <div class="connector-badge">✅</div>
                                <span>Success</span>
                            </div>
                            ${!node.ignoreError ? `
                                <div class="api-connector api-error-connector" data-connection-type="error" title="Соединение при ошибке">
                                    <div class="connector-badge">❌</div>
                                    <span>Error</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${isConnectMode && node.type === 'condition' ? `
                        <div class="condition-connection-options">
                            <div class="condition-connector condition-true-connector" data-connection-type="true" title="Соединение при выполнении условия">
                                <div class="connector-badge">✓</div>
                                <span>True</span>
                            </div>
                            <div class="condition-connector condition-false-connector" data-connection-type="false" title="Соединение при невыполнении условия">
                                <div class="connector-badge">✗</div>
                                <span>False</span>
                            </div>
                        </div>
                    ` : ''}
                    ${isConnectMode && !node.isStart && node.type !== 'api_request' && node.type !== 'condition' ? '<div class="node-connector-target" title="Перетащите для соединения"></div>' : ''}
                </div>
            </div>
        `}).join('');

        this.nodesContainer.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
        this.connectionsSvg.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
    }

    attachNodeEventListeners() {
        console.log('=== ATTACH NODE EVENT LISTENERS ===');
        this.nodesContainer.querySelectorAll('[data-delete-node="true"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Delete button clicked!');
                e.preventDefault();
                e.stopPropagation();
                const nodeEl = e.target.closest('.node');
                if (nodeEl) {
                    this.deleteNode(nodeEl.dataset.id);
                }
            });
        });
    }

    renderConnections() {
        let svg = `
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#95a5a6"/>
                </marker>
                <marker id="arrowhead-success" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#38ef7d"/>
                </marker>
                <marker id="arrowhead-error" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#e74c3c"/>
                </marker>
            </defs>
        `;
        
        this.connections.forEach(conn => {
            const path = this.calculateConnectionPath(conn);
            if (path) {
                const fromNode = this.nodes.find(n => n.id === conn.from);
                const toNode = this.nodes.find(n => n.id === conn.to);

                let stroke = '#95a5a6';
                let marker = 'url(#arrowhead)';

                if (conn.type === 'success') {
                    stroke = '#38ef7d';
                    marker = 'url(#arrowhead-success)';
                } else if (conn.type === 'error') {
                    stroke = '#e74c3c';
                    marker = 'url(#arrowhead-error)';
                } else if (conn.type === 'true') {
                    stroke = '#38ef7d';
                    marker = 'url(#arrowhead-success)';
                } else if (conn.type === 'false') {
                    stroke = '#e74c3c';
                    marker = 'url(#arrowhead-error)';
                }

                let cssClass = 'connection-line';
                if (conn.type === 'success') {
                    cssClass += ' success';
                } else if (conn.type === 'error') {
                    cssClass += ' error';
                }

                // Add stroke-width variation for better visual distinction
                let strokeWidth = 2;
                if (conn.type === 'success') {
                    strokeWidth = 3;
                } else if (conn.type === 'error') {
                    strokeWidth = 3;
                }

                svg += `<path class="${cssClass}" d="${path}" style="stroke: ${stroke}; stroke-width: ${strokeWidth}; marker-end: ${marker};" />`;

                let label = '';
                let startX = fromNode.x + 250;
                let startY = fromNode.y + 50;
                const endX = toNode.x;
                const endY = toNode.y + 50;

                if (conn.buttonId && fromNode.buttons) {
                    const button = fromNode.buttons.find(b => b.id === conn.buttonId);
                    if (button) {
                        const btnIndex = fromNode.buttons.findIndex(b => b.id === conn.buttonId);
                        if (btnIndex !== -1) {
                            startY = fromNode.y + 70 + (btnIndex * 35);
                        }
                        label = button.text;
                    }
                } else {
                    startY = fromNode.y + 50;
                    if (conn.type === 'success') label = '✅ Success';
                    else if (conn.type === 'error') label = '❌ Error';
                    else if (conn.type === 'true') label = '✓ True';
                    else if (conn.type === 'false') label = '✗ False';
                }

                if (label) {
                    const midX = (startX + endX) / 2;
                    const midY = (startY + endY) / 2;
                    svg += `<text class="connection-label" x="${midX}" y="${midY}" text-anchor="middle">${this.escapeHtml(label)}</text>`;
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
        const apiNodeErrors = [];
        const conditionNodeErrors = [];

        if (this.nodes.length === 0) return { valid: true, disconnected: [], apiErrors: [], conditionErrors: [] };

        connectedNodeIds.add('start');

        this.connections.forEach(conn => {
            connectedNodeIds.add(conn.to);
            nodeIdWithOutgoing.add(conn.from);
        });

        this.nodes.forEach(node => {
            const hasIncomingConnection = connectedNodeIds.has(node.id);
            const hasOutgoingConnection = nodeIdWithOutgoing.has(node.id);
            const isConnected = hasIncomingConnection || hasOutgoingConnection;

            if (!node.isStart && !isConnected) {
                disconnectedNodes.push(node.id);
            }

            // Check API nodes for required connections
            if (node.type === 'api_request') {
                const apiConnections = this.connections.filter(c => c.from === node.id);
                const hasSuccess = apiConnections.some(c => c.type === 'success');
                const hasError = apiConnections.some(c => c.type === 'error');

                if (!node.ignoreError && (!hasSuccess || !hasError)) {
                    let errorMessage = `API узел "${node.url ? node.url.substring(0, 30) + '...' : 'Без URL'}" требует подключения как минимум Success и Error.`;
                    if (!hasSuccess) errorMessage += ' Отсутствует Success соединение.';
                    if (!hasError) errorMessage += ' Отсутствует Error соединение.';
                    apiNodeErrors.push(errorMessage);
                } else if (node.ignoreError && !hasSuccess) {
                    const errorMessage = `API узел "${node.url ? node.url.substring(0, 30) + '...' : 'Без URL'}" требует подключения Success соединения.`;
                    apiNodeErrors.push(errorMessage);
                }
            }
            // Check condition nodes for required connections
            else if (node.type === 'condition') {
                const conditionConnections = this.connections.filter(c => c.from === node.id);
                const hasTrue = conditionConnections.some(c => c.type === 'true');
                const hasFalse = conditionConnections.some(c => c.type === 'false');

                if (!hasTrue || !hasFalse) {
                    let errorMessage = `Условный узел "${node.condition !== undefined && node.condition !== null ? node.condition.substring(0, 30) + '...' : 'Без условия'}" требует подключения True и False.`;
                    if (!hasTrue) errorMessage += ' Отсутствует True соединение.';
                    if (!hasFalse) errorMessage += ' Отсутствует False соединение.';
                    conditionNodeErrors.push(errorMessage);
                }
            }
        });

        return {
            valid: disconnectedNodes.length === 0 && apiNodeErrors.length === 0 && conditionNodeErrors.length === 0,
            disconnected: disconnectedNodes,
            apiErrors: apiNodeErrors,
            conditionErrors: conditionNodeErrors
        };
    }

    // Original version without debug output for other potential calls
    validateConnectivityOriginal() {
        const disconnectedNodes = [];
        const connectedNodeIds = new Set();
        const nodeIdWithOutgoing = new Set();
        const apiNodeErrors = [];
        const conditionNodeErrors = [];

        if (this.nodes.length === 0) return { valid: true, disconnected: [], apiErrors: [], conditionErrors: [] };

        connectedNodeIds.add('start');

        this.connections.forEach(conn => {
            connectedNodeIds.add(conn.to);
            nodeIdWithOutgoing.add(conn.from);
        });

        this.nodes.forEach(node => {
            const hasIncomingConnection = connectedNodeIds.has(node.id);
            const hasOutgoingConnection = nodeIdWithOutgoing.has(node.id);
            const isConnected = hasIncomingConnection || hasOutgoingConnection;

            if (!node.isStart && !isConnected) {
                disconnectedNodes.push(node.id);
            }

            // Check API nodes for required connections
            if (node.type === 'api_request') {
                const apiConnections = this.connections.filter(c => c.from === node.id);
                const hasSuccess = apiConnections.some(c => c.type === 'success');
                const hasError = apiConnections.some(c => c.type === 'error');

                if (!node.ignoreError && (!hasSuccess || !hasError)) {
                    let errorMessage = `API узел "${node.url && typeof node.url === 'string' ? node.url.substring(0, 30) + '...' : 'Без URL'}" требует подключения как минимум Success и Error.`;
                    if (!hasSuccess) errorMessage += ' Отсутствует Success соединение.';
                    if (!hasError) errorMessage += ' Отсутствует Error соединение.';
                    apiNodeErrors.push(errorMessage);
                } else if (node.ignoreError && !hasSuccess) {
                    apiNodeErrors.push(`API узел "${node.url && typeof node.url === 'string' ? node.url.substring(0, 30) + '...' : 'Без URL'}" требует подключения Success соединения.`);
                }
            }
            // Check condition nodes for required connections
            else if (node.type === 'condition') {
                const conditionConnections = this.connections.filter(c => c.from === node.id);
                const hasTrue = conditionConnections.some(c => c.type === 'true');
                const hasFalse = conditionConnections.some(c => c.type === 'false');

                if (!hasTrue || !hasFalse) {
                    let errorMessage = `Условный узел "${node.condition !== undefined && node.condition !== null && typeof node.condition === 'string' ? node.condition.substring(0, 30) + '...' : 'Без условия'}" требует подключения True и False.`;
                    if (!hasTrue) errorMessage += ' Отсутствует True соединение.';
                    if (!hasFalse) errorMessage += ' Отсутствует False соединение.';
                    conditionNodeErrors.push(errorMessage);
                }
            }
        });

        return {
            valid: disconnectedNodes.length === 0 && apiNodeErrors.length === 0 && conditionNodeErrors.length === 0,
            disconnected: disconnectedNodes,
            apiErrors: apiNodeErrors,
            conditionErrors: conditionNodeErrors
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

        const validation = this.validateConnectivityOriginal(); // Use the safe version

        if (!validation.valid) {
            let errorMessage = "Невозможно сохранить! ";

            if (validation.disconnected.length > 0) {
                const nodeNames = validation.disconnected.map(id => {
                    const node = this.nodes.find(n => n.id === id);
                    return node ? (node.text && typeof node.text === 'string' ? node.text.substring(0, 20) + '...' : (node.condition && typeof node.condition === 'string' ? node.condition.substring(0, 20) + '...' : node.type + '...')) : id;
                }).join(', ');
                errorMessage += `Существуют несвязанные элементы:\n\n${nodeNames}\n\n`;
            }

            if (validation.apiErrors.length > 0) {
                errorMessage += "Проблемы с API узлами:\n\n";
                errorMessage += validation.apiErrors.join('\n');
                errorMessage += "\n\n";
            }

            if (validation.conditionErrors.length > 0) {
                errorMessage += "Проблемы с условными узлами:\n\n";
                errorMessage += validation.conditionErrors.join('\n');
                errorMessage += "\n\n";
            }

            errorMessage += "Все элементы должны быть подключены к цепочке диалога.";
            alert(errorMessage);
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
            alert('Ошибка при сохранении диалога: ' + error.message);
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

function addMenuNode() {
    flowEditor.addUniversalElement();
}

function addApiNode() {
    flowEditor.addApiNode();
}

function addConditionNode() {
    flowEditor.addConditionNode();
}

function addTransformNode() {
    flowEditor.addTransformNode();
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

    // Initialize tooltip functionality
    initializeTooltips();
});

// Initialize tooltip functionality
function initializeTooltips() {
    // Create tooltip container if it doesn't exist
    let tooltip = document.querySelector('.custom-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
            max-width: 250px;
            word-wrap: break-word;
            white-space: normal;
        `;
        document.body.appendChild(tooltip);
    }

    // Add mouse events to all tooltip icons
    document.addEventListener('mouseover', function(e) {
        const tooltipIcon = e.target.closest('.tooltip-icon');
        if (tooltipIcon) {
            const text = tooltipIcon.getAttribute('data-tooltip');
            if (text) {
                tooltip.textContent = text;
                tooltip.style.opacity = '1';
            }
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (tooltip.style.opacity === '1') {
            tooltip.style.left = (e.pageX + 10) + 'px';
            tooltip.style.top = (e.pageY - 30) + 'px';
        }
    });

    document.addEventListener('mouseout', function(e) {
        const tooltipIcon = e.target.closest('.tooltip-icon');
        if (tooltipIcon) {
            tooltip.style.opacity = '0';
        }
    });
}

// Global function to toggle debug mode
function toggleDebug() {
    let debugDiv = document.getElementById('debug-info');

    if (!debugDiv) {
        // Create debug div if it doesn't exist
        debugDiv = document.createElement('div');
        debugDiv.id = 'debug-info';
        debugDiv.style.cssText = `
            position: fixed;
            top: 50px;
            right: 10px;
            width: 300px;
            max-height: calc(100vh - 70px);
            background: #fff;
            border: 2px solid #ff0000;
            border-radius: 5px;
            padding: 10px;
            z-index: 10000;
            overflow-y: auto;
            font-size: 12px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(debugDiv);
    }

    // Show the debug div and update content
    debugDiv.style.display = 'block';
    updateDebugInfo();
}

// Function to update debug information
function updateDebugInfo() {
    const debugDiv = document.getElementById('debug-info');
    if (!debugDiv || debugDiv.style.display === 'none') return;

    if (typeof flowEditor !== 'undefined') {
        const validation = flowEditor.validateConnectivityOriginal();

        let debugContent = `
            <h4 style="margin:0 0 10px 0; color: red; display:flex; justify-content:space-between; align-items:center;">
                <span>DEBUG INFO</span>
                <button onclick="toggleDebug()" style="background:#ffcccc; border:1px solid #cc0000; padding:2px 5px; cursor:pointer; margin-left:10px;">X</button>
            </h4>

            <div style="margin-bottom: 10px;">
                <strong>Общая информация:</strong><br>
                - Всего узлов: ${flowEditor.nodes.length}<br>
                - Всего соединений: ${flowEditor.connections.length}<br>
                - Текущий масштаб: ${(flowEditor.scale * 100).toFixed(0)}%<br>
                - Смещение: X=${Math.round(flowEditor.offset.x)}, Y=${Math.round(flowEditor.offset.y)}<br>
                - Выбранный узел: ${flowEditor.selectedNode || 'нет'}<br>
                - Режим: ${flowEditor.mode}<br>
                - Текущий бот ID: ${flowEditor.currentBotId || 'не выбран'}<br>
            </div>

            <div style="margin-bottom: 10px;">
                <strong>Валидация:</strong><br>
                - Валидно: ${validation.valid ? 'да' : 'нет'}<br>
                - Отсоединённые узлы: ${validation.disconnected.length}<br>
                - Ошибки API: ${validation.apiErrors.length}<br>
                - Ошибки условий: ${validation.conditionErrors.length}<br>
            </div>
        `;

        // Add list of nodes if there are any
        if (flowEditor.nodes.length > 0) {
            debugContent += `<div style="margin-bottom: 10px;"><strong>Узлы:</strong><br>`;
            flowEditor.nodes.forEach(node => {
                debugContent += `&bull; ${node.id} (${node.type}) - ${node.isStart ? 'START' : 'Regular'}<br>`;
            });
            debugContent += `</div>`;
        }

        // Add list of connections if there are any
        if (flowEditor.connections.length > 0) {
            debugContent += `<div style="margin-bottom: 10px;"><strong>Соединения:</strong><br>`;
            flowEditor.connections.forEach(conn => {
                let connDesc = `${conn.from} &rarr; ${conn.to}`;
                if (conn.type) {
                    connDesc += ` (${conn.type})`;
                } else if (conn.buttonId) {
                    connDesc += ` (button: ${conn.buttonId})`;
                }
                debugContent += `&bull; ${connDesc}<br>`;
            });
            debugContent += `</div>`;
        }

        // Add validation errors if any
        if (!validation.valid) {
            debugContent += `<div style="margin-bottom: 10px;"><strong>Ошибки валидации:</strong><br>`;
            if (validation.disconnected.length > 0) {
                debugContent += `<em>Отсоединенённые узлы:</em><br>`;
                validation.disconnected.forEach(nodeId => {
                    debugContent += `&bull; ${nodeId}<br>`;
                });
            }
            if (validation.apiErrors.length > 0) {
                debugContent += `<em>Ошибки API:</em><br>`;
                validation.apiErrors.forEach(error => {
                    debugContent += `&bull; ${error}<br>`;
                });
            }
            if (validation.conditionErrors.length > 0) {
                debugContent += `<em>Ошибки условий:</em><br>`;
                validation.conditionErrors.forEach(error => {
                    debugContent += `&bull; ${error}<br>`;
                });
            }
            debugContent += `</div>`;
        }

        debugDiv.innerHTML = debugContent;
    } else {
        debugDiv.innerHTML = `
            <h4 style="margin:0 0 5px 0; color: red; display:flex; justify-content:space-between; align-items:center;">
                <span>DEBUG INFO</span>
                <button onclick="toggleDebug()" style="background:#ffcccc; border:1px solid #cc0000; padding:2px 5px; cursor:pointer; margin-left:10px;">X</button>
            </h4>
            <p>Объект flowEditor не найден</p>
        `;
    }
}

// Periodically update debug info if window is open
setInterval(() => {
    const debugDiv = document.getElementById('debug-info');
    if (debugDiv && debugDiv.style.display !== 'none') {
        updateDebugInfo();
    }
}, 1000); // Update every second

// Create debug toggle slider in the UI
function createDebugToggleButton() {
    // Create container for the slider
    const sliderContainer = document.createElement('div');
    sliderContainer.id = 'debug-slider-container';
    sliderContainer.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10002;
        display: flex;
        align-items: center;
    `;

    // Create the slider switch
    const sliderSwitch = document.createElement('label');
    sliderSwitch.className = 'debug-toggle-switch';
    sliderSwitch.style.cssText = `
        position: relative;
        display: inline-block;
        width: 50px;
        height: 26px;
    `;

    // Create the checkbox input
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'debug-toggle-checkbox';
    checkbox.style.cssText = `
        opacity: 0;
        width: 0;
        height: 0;
    `;

    // Create the slider element
    const slider = document.createElement('span');
    slider.className = 'debug-slider';
    slider.style.cssText = `
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
        border-radius: 34px;
    `;

    // Add pseudo-element for the slider thumb
    const sliderThumb = document.createElement('span');
    sliderThumb.style.cssText = `
        position: absolute;
        content: "";
        height: 20px;
        width: 20px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
    `;

    // Add debug label
    const debugLabel = document.createElement('span');
    debugLabel.textContent = 'DBG';
    debugLabel.style.cssText = `
        margin-right: 8px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: #333;
        font-weight: bold;
    `;

    // Assemble the elements
    slider.appendChild(sliderThumb);
    sliderSwitch.appendChild(checkbox);
    sliderSwitch.appendChild(slider);
    sliderContainer.appendChild(debugLabel);
    sliderContainer.appendChild(sliderSwitch);

    // Add event listener to the checkbox
    checkbox.addEventListener('change', function() {
        if (this.checked) {
            toggleDebug();
        } else {
            const debugDiv = document.getElementById('debug-info');
            if (debugDiv) {
                debugDiv.style.display = 'none';
            }
        }
        // Update debug info immediately when toggled
        setTimeout(updateDebugInfo, 100);
    });

    document.body.appendChild(sliderContainer);
}

// Initialize the debug toggle button when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(createDebugToggleButton, 100); // Small delay to ensure DOM is fully loaded
});