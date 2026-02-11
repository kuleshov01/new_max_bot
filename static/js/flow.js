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
        this.selectedConnection = null;
        this.currentCommandId = null; // ID текущей редактируемой команды
        this.isEditingCommand = false; // Режим редактирования команды
        this.controlPoints = {}; // Опорные точки для изгиба линий
        this.draggedControlPoint = null;
        this.draggedPointStart = null;
        this.resizingNode = null;
        this.resizeHandle = null;
        this.resizeStart = { x: 0, y: 0, width: 0, height: 0 };
        this.currentEditingNodeId = null;
        this.connectionClicked = false; // Флаг для предотвращения сброса выделения связи
        this.commandClicked = false; // Флаг для предотвращения сброса выделения команды
        this.suppressCommandsRender = false; // Флаг для предотвращения перерисовки списка команд
        
        // Touch support properties
        this.lastTouchDistance = 0;
        this.lastTouchCenter = { x: 0, y: 0 };
        this.touchStartScale = 1;
        this.touchStartOffset = { x: 0, y: 0 };
        this.initialTouchDistance = 0;  // Начальное расстояние при начале pinch zoom
        
        // Pointer tracking for pinch-to-zoom
        this.activePointers = new Map();  // pointerId -> {x, y}
        
        // Gesture tracking properties
        this.longPressTimer = null;
        this.longPressDuration = 500; // ms
        this.longPressNode = null;
        this.lastTapTime = 0;
        this.doubleTapDelay = 300; // ms
        this.swipeStartX = 0;
        this.swipeStartY = 0;
        this.swipeThreshold = 50; // px
        this.edgeSwipeThreshold = 30; // px от края экрана
        this.isEdgeSwipe = false;
        this.gestureInProgress = false;

        // Undo/Redo history
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50; // Максимальный размер истории

        // Helper function to build API URL with base path
        this.apiUrl = (path) => {
            const baseUrl = window.API_BASE_URL || '';
            return baseUrl + '/' + path.replace(/^\/+/, '');
        };

        this.init();
    }
    
    init() {
        console.log('=== INIT START ===');
        this.canvas = document.getElementById('flowCanvas');
        this.nodesContainer = document.getElementById('nodes');
        this.connectionsSvg = document.getElementById('connections');
        this.nodeProperties = document.getElementById('nodeProperties');

        console.log('=== INIT ===', 'canvas:', !!this.canvas, 'nodesContainer:', !!this.nodesContainer, 'BOT_ID:', window.BOT_ID);

        this.setupEventListeners();
        this.setupRippleEffect(); // Добавляем ripple-эффект
        this.setupBottomSheets();
        this.setupAccordion(); // Добавляем аккордеон для sidebar
        this.loadBotFromUrl();

        this.loadCommands(); // Загружаем команды при инициализации
        this.updateZoomLevel();
        this.render();
        console.log('=== INIT END ===');
    }

    setupRippleEffect() {
        // Добавляем ripple-эффект для всех кнопок
        const buttons = document.querySelectorAll('.menu-btn, .icon-btn');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.createRipple(e, button);
            });
        });

        // Обработчики для кнопок инструментов
        const toolButtons = document.querySelectorAll('.tool-btn');
        toolButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tool = button.getAttribute('data-tool');
                this.handleToolClick(tool);
                this.createRipple(e, button);
            });
        });

        // Обработчики для кнопок зума
        const resetZoomBtn = document.getElementById('reset-zoom');
        if (resetZoomBtn) {
            resetZoomBtn.addEventListener('click', (e) => {
                this.zoomReset();
                this.createRipple(e, resetZoomBtn);
            });
        }

        const zoomInfoBtn = document.getElementById('zoom-info');
        if (zoomInfoBtn) {
            zoomInfoBtn.addEventListener('click', (e) => {
                this.zoomReset();
                this.createRipple(e, zoomInfoBtn);
            });
        }

        // Обработчики для Bottom Sheets
        this.setupBottomSheets();
    }

    setupBottomSheets() {
        // Клик на меню → открыть commands sheet
        const menuBtn = document.querySelector('.menu-btn');
        const commandsSheet = document.getElementById('commands-sheet');
        if (menuBtn && commandsSheet) {
            menuBtn.addEventListener('click', () => {
                this.openBottomSheet(commandsSheet);
            });
        }

        // Клик на закрыть → закрыть sheet
        const closeButtons = document.querySelectorAll('.close-btn');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const sheet = button.closest('.bottom-sheet');
                if (sheet) {
                    this.closeBottomSheet(sheet);
                }
            });
        });

        // Клик вне sheet → закрыть
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('bottom-sheet')) {
                this.closeBottomSheet(e.target);
            }
        });

        // Обработчик для формы свойств узла
        const propertiesForm = document.getElementById('node-properties-form');
        if (propertiesForm) {
            propertiesForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveNodeProperties();
            });
        }
    }

    setupAccordion() {
        // Обработчики для заголовков секций аккордеона
        const sectionHeaders = document.querySelectorAll('.section-header');
        sectionHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const section = header.getAttribute('data-section');
                this.toggleSection(section);
            });
        });

        // Обработчики для drag-and-drop инструментов
        const toolItems = document.querySelectorAll('.tool-item');
        toolItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                const tool = item.getAttribute('data-tool');
                e.dataTransfer.setData('tool', tool);
                item.style.opacity = '0.5';
            });

            item.addEventListener('dragend', (e) => {
                item.style.opacity = '1';
            });

            // Клик на инструмент → добавить узел
            item.addEventListener('click', (e) => {
                const tool = item.getAttribute('data-tool');
                this.handleToolClick(tool);
            });
        });
    }

    toggleSection(sectionName) {
        const header = document.querySelector(`.section-header[data-section="${sectionName}"]`);
        const content = document.getElementById(`${sectionName}-section`);
        
        if (!header || !content) return;

        const isCollapsed = content.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Развернуть секцию
            content.classList.remove('collapsed');
            header.setAttribute('aria-expanded', 'true');
            // Изменить стрелку с ▶ на ▼
            const span = header.querySelector('span');
            if (span) {
                span.textContent = span.textContent.replace('▶', '▼');
            }
        } else {
            // Свернуть секцию
            content.classList.add('collapsed');
            header.setAttribute('aria-expanded', 'false');
            // Изменить стрелку с ▼ на ▶
            const span = header.querySelector('span');
            if (span) {
                span.textContent = span.textContent.replace('▼', '▶');
            }
        }
    }

    openPropertiesSheet(node) {
        const propertiesSheet = document.getElementById('properties-sheet');
        if (!propertiesSheet) return;

        // Заполняем форму данными узла
        this.populatePropertiesForm(node);

        // Обновляем заголовок с типом узла
        const nodeTypeSpan = propertiesSheet.querySelector('.node-type');
        if (nodeTypeSpan) {
            const typeNames = {
                'message': 'Сообщение',
                'menu': 'Меню',
                'api_request': 'API запрос',
                'condition': 'Условие',
                'transform': 'Трансформация'
            };
            nodeTypeSpan.textContent = typeNames[node.type] || node.type;
        }

        // Открываем sheet
        this.openBottomSheet(propertiesSheet);
    }

    populatePropertiesForm(node) {
        const form = document.getElementById('node-properties-form');
        if (!form) return;

        // Очищаем форму
        form.innerHTML = '';

        // Добавляем поля в зависимости от типа узла
        switch(node.type) {
            case 'message':
            case 'menu':
                this.addTextField(form, 'text', 'Текст:', node.text || '');
                this.addCheckboxField(form, 'format', 'Формат Markdown', node.format === 'markdown');
                break;
            case 'api_request':
                this.addTextField(form, 'url', 'URL:', node.url || '');
                this.addTextField(form, 'method', 'Метод:', node.method || 'GET');
                this.addCheckboxField(form, 'debug', 'Режим отладки', node.debug || false);
                break;
            case 'condition':
                this.addTextField(form, 'condition', 'Условие:', node.condition || '');
                break;
            case 'transform':
                this.addTextField(form, 'expression', 'Выражение:', node.expression || '');
                break;
        }

        // Сохраняем ссылку на текущий узел
        this.currentEditingNode = node;
    }

    addTextField(form, name, label, value) {
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        form.appendChild(labelEl);

        const input = document.createElement('input');
        input.type = 'text';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }

    addCheckboxField(form, name, label, checked) {
        const labelEl = document.createElement('label');
        labelEl.style.display = 'flex';
        labelEl.style.alignItems = 'center';
        labelEl.style.gap = '8px';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = name;
        input.checked = checked;

        const text = document.createTextNode(label);

        labelEl.appendChild(input);
        labelEl.appendChild(text);
        form.appendChild(labelEl);
    }

    saveNodeProperties() {
        if (!this.currentEditingNode) return;

        const form = document.getElementById('node-properties-form');
        const formData = new FormData(form);

        // Обновляем данные узла
        for (const [key, value] of formData.entries()) {
            if (key === 'format' && value === 'on') {
                this.currentEditingNode.format = 'markdown';
            } else if (key === 'debug' && value === 'on') {
                this.currentEditingNode.debug = true;
            } else {
                this.currentEditingNode[key] = value;
            }
        }

        // Перерисовываем узел
        this.render();

        // Закрываем sheet
        const propertiesSheet = document.getElementById('properties-sheet');
        this.closeBottomSheet(propertiesSheet);

        // Сохраняем flow
        this.saveFlow();
    }

    openBottomSheet(sheet) {
        sheet.classList.add('open');
    }

    closeBottomSheet(sheet) {
        sheet.classList.remove('open');
    }

    handleToolClick(tool) {
        switch(tool) {
            case 'message':
                this.addElement();
                break;
            case 'api':
                this.addApiNode();
                break;
            case 'condition':
                this.addConditionNode();
                break;
            case 'transform':
                this.addTransformNode();
                break;
        }
    }

    createRipple(event, button) {
        const circle = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;

        const rect = button.getBoundingClientRect();
        
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - rect.left - radius}px`;
        circle.style.top = `${event.clientY - rect.top - radius}px`;
        circle.classList.add('ripple');

        // Удаляем существующие ripple элементы
        const ripple = button.getElementsByClassName('ripple')[0];
        if (ripple) {
            ripple.remove();
        }

        button.appendChild(circle);
    }

    // ============================================
    // Тактильная обратная связь (Vibration API)
    // ============================================

    /**
     * Базовая функция вибрации
     * @param {number|number[]} pattern - Паттерн вибрации (мс или массив мс)
     */
    vibrate(pattern) {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    }

    /**
     * Лёгкая вибрация (15ms) — при тапе на кнопку
     */
    vibrateLight() {
        this.vibrate(15);
    }

    /**
     * Средняя вибрация (25ms) — при выборе узла
     */
    vibrateMedium() {
        this.vibrate(25);
    }

    /**
     * Сильная вибрация (50ms) — при ошибке
     */
    vibrateHeavy() {
        this.vibrate(50);
    }

    /**
     * Двойная вибрация (15ms + 50ms + 15ms) — при успешном действии
     */
    vibrateDouble() {
        this.vibrate([15, 50, 15]);
    }


    loadBotFromUrl() {
        const botId = window.BOT_ID;
        if (botId) {
            this.currentBotId = parseInt(botId);
            this.loadBotFlow(this.currentBotId);
        } else {
            console.error('BOT_ID не установлен в window.BOT_ID');
        }
    }

    async loadBotFlow(botId) {
        try {
            const response = await fetch(this.apiUrl(`api/bots/${botId}/flow`));
            const flowData = await response.json();

            if (flowData && flowData.nodes) {
                this.nodes = flowData.nodes;
                this.connections = flowData.connections || [];
                this.maxNodeId();
                this.render();
            }
            
            // Сбрасываем режим редактирования команды
            this.currentCommandId = null;
            this.isEditingCommand = false;
            
            // Загружаем команды бота
            this.loadCommands();
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
        this.canvas.addEventListener('dblclick', this.handleCanvasDoubleClick.bind(this));

        // Pointer events for mobile/tablet support (works better than touch events)
        this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
        this.canvas.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this.canvas.addEventListener('pointercancel', this.handlePointerUp.bind(this));

        // Also bind to nodes container
        this.nodesContainer.addEventListener('pointerdown', this.handlePointerDown.bind(this));
        this.nodesContainer.addEventListener('pointermove', this.handlePointerMove.bind(this));
        this.nodesContainer.addEventListener('pointerup', this.handlePointerUp.bind(this));
        this.nodesContainer.addEventListener('pointercancel', this.handlePointerUp.bind(this));

        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // Обработчик клика по связям (делегирование через document для надежности)
        document.addEventListener('click', this.handleConnectionClick.bind(this));
        document.addEventListener('contextmenu', this.handleConnectionRightClick.bind(this));

        // Обработчик контекстного меню для узлов
        this.nodesContainer.addEventListener('contextmenu', this.handleNodeContextMenu.bind(this));

        // Настройка обработчиков для контекстного меню узлов
        this.setupNodeContextMenuHandlers();
    }
    
    createStartNode() {
        const startNode = {
            id: 'start',
            type: 'message',
            x: 100,
            y: 100,
            text: '👋 Добро пожаловать!\n\nВыберите действие:',
            buttons: [],
            format: 'markdown', // По умолчанию Markdown
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
            format: 'markdown', // По умолчанию Markdown
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
            format: 'markdown', // По умолчанию Markdown
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
    
    deleteConnection(connectionId) {
        const connection = this.connections.find(c => c.id === connectionId);
        if (!connection) return;

        // Если связь имеет buttonId, нужно также очистить nextNodeId в кнопке
        if (connection.buttonId) {
            const fromNode = this.nodes.find(n => n.id === connection.from);
            if (fromNode && fromNode.buttons) {
                const button = fromNode.buttons.find(b => b.id === connection.buttonId);
                if (button) {
                    button.nextNodeId = null;
                }
            }
        }

        this.connections = this.connections.filter(c => c.id !== connectionId);

        if (this.selectedConnection === connectionId) {
            console.log('=== DELETE CONNECTION ===', 'clearing selectedConnection:', this.selectedConnection);
            this.selectedConnection = null;
            this.updateDeleteConnectionButton();
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

    addConditionConnection(fromNodeId, toNodeId, connectionType) {
        // Remove any existing condition connections of the same type from this node
        // But keep other types (e.g., keep 'false' when adding 'true')
        this.connections = this.connections.filter(c =>
            !(c.from === fromNodeId && c.type === connectionType)
        );

        if (toNodeId && fromNodeId && toNodeId !== fromNodeId) {
            this.connections.push({
                id: `conn_${this.nodeIdCounter++}`,
                from: fromNodeId,
                to: toNodeId,
                type: connectionType  // 'true' or 'false'
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

        console.log('=== MOUSE DOWN ===', 'target:', e.target.tagName, 'classList:', Array.from(e.target.classList), 'connectionClicked:', this.connectionClicked);

        // Check if clicking on a connection line (highest priority)
        const connectionEl = e.target.closest('.connection-line');
        if (connectionEl) {
            const connectionId = connectionEl.dataset.connectionId;
            console.log('=== MOUSE DOWN ON CONNECTION ===', 'connectionId:', connectionId);
            
            if (connectionId) {
                this.selectConnection(connectionId);
                // Показываем контекстное меню для связи
                this.showContextMenu(e.clientX, e.clientY, 'connection');
            }
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
        }

        // Если connectionClicked установлен, значит pointerdown уже обработал клик на связь
        // Не сбрасываем выделение
        if (this.connectionClicked) {
            console.log('=== SKIPPING MOUSE DOWN - CONNECTION CLICKED ===');
            this.connectionClicked = false; // Сбрасываем флаг
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
        }

        // Handle resize
        if (e.target.classList.contains('resize-handle')) {
            const handleEl = e.target;
            const nodeEl = handleEl.closest('.node');
            const nodeId = nodeEl.dataset.id;
            const node = this.nodes.find(n => n.id === nodeId);
            
            if (node) {
                this.resizingNode = nodeId;
                this.resizeHandle = handleEl.dataset.handle;
                
                // Получаем текущую высоту элемента, если она 'auto'
                let currentHeight = node.height || 'auto';
                if (currentHeight === 'auto' && nodeEl) {
                    currentHeight = nodeEl.offsetHeight;
                }
                
                this.resizeStart = {
                    x: x,
                    y: y,
                    width: node.width || 250,
                    height: currentHeight
                };
                nodeEl.classList.add('resizing');
                e.stopPropagation();
                return;
            }
        }

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
            
            console.log('=== MOUSE DOWN ON NODE ===', 'nodeId:', nodeId, 'dataset.id:', nodeEl.dataset.id);

            if (e.target.classList.contains('delete-btn')) {
                this.deleteNode(nodeId);
                e.stopPropagation();
                return;
            }

            console.log('=== CALLING SELECT NODE ===', 'nodeId:', nodeId);
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
            console.log('=== TOUCH EMPTY SPACE ===', 'clearing selectedConnection:', this.selectedConnection, 'commandClicked:', this.commandClicked, 'currentCommandId:', this.currentCommandId);
            this.selectedNode = null;
            // Не снимаем выделение со связи если был клик на команду
            if (!this.commandClicked) {
                this.selectedConnection = null; // Снимаем выделение со связи
            }
            this.showNodeProperties(null);
            this.updateDeleteConnectionButton();
            console.log('=== BEFORE RENDER ===', 'currentCommandId:', this.currentCommandId);
            this.render();
            console.log('=== AFTER RENDER ===', 'currentCommandId:', this.currentCommandId);
        }
    }
    
    handleCanvasDoubleClick(e) {
        // Проверяем, кликнули ли на узел
        if (e.target.closest('.node')) {
            const nodeEl = e.target.closest('.node');
            const nodeId = nodeEl.dataset.id;
            const node = this.nodes.find(n => n.id === nodeId);
            
            // Открываем Markdown редактор только для узлов типа message, menu, universal или start
            if (node && (node.type === 'message' || node.type === 'menu' || node.type === 'universal' || node.isStart)) {
                e.preventDefault();
                e.stopPropagation();
                openMarkdownEditor(nodeId);
            }
        }
    }
    
    handleCanvasMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offset.x) / this.scale;
        const y = (e.clientY - rect.top - this.offset.y) / this.scale;

        // Обработка перетаскивания опорной точки
        if (this.draggedControlPoint) {
            const dx = (e.clientX - this.draggedPointStart.x) / this.scale;
            const dy = (e.clientY - this.draggedPointStart.y) / this.scale;

            const points = this.controlPoints[this.draggedControlPoint.connectionId];
            const point = points.find(p => p.id === this.draggedControlPoint.pointId);
            if (point) {
                point.x += dx;
                point.y += dy;
                this.draggedPointStart = { x: e.clientX, y: e.clientY };
                this.render();
            }
            return;
        }

        if (this.resizingNode) {
            const node = this.nodes.find(n => n.id === this.resizingNode);
            if (node) {
                const dx = x - this.resizeStart.x;
                const dy = y - this.resizeStart.y;
                const handle = this.resizeHandle;

                let newWidth = this.resizeStart.width;
                let newHeight = this.resizeStart.height;

                // Вычисляем минимальную высоту на основе количества кнопок
                const buttonCount = node.buttons ? node.buttons.length : 0;
                const minHeight = buttonCount > 0 ? (125 + buttonCount * 35) : 150;

                // Только вправо (e)
                if (handle === 'e') {
                    newWidth = Math.max(200, this.resizeStart.width + dx);
                }
                // Только вниз (s)
                else if (handle === 's') {
                    newHeight = Math.max(minHeight, this.resizeStart.height + dy);
                }
                // Диагональ право-низ (se)
                else if (handle === 'se') {
                    newWidth = Math.max(200, this.resizeStart.width + dx);
                    newHeight = Math.max(minHeight, this.resizeStart.height + dy);
                }

                node.width = newWidth;
                node.height = newHeight;

                this.render();
            }
        } else if (this.draggedConnector) {
            this.tempConnection.endX = x;
            this.tempConnection.endY = y;
            this.renderConnections();
        } else if (this.draggedNode) {
            const node = this.nodes.find(n => n.id === this.draggedNode);
            if (node) {
                // Убраны ограничения по перемещению элементов
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
        if (this.draggedControlPoint) {
            this.draggedControlPoint = null;
            this.draggedPointStart = null;
            return;
        }

        if (this.resizingNode) {
            const nodeEl = document.querySelector(`.node[data-id="${this.resizingNode}"]`);
            if (nodeEl) {
                nodeEl.classList.remove('resizing');
            }
            this.resizingNode = null;
            this.resizeHandle = null;
            this.render();
        }

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
        // Ctrl + Wheel — Зум
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.scale = Math.min(Math.max(this.scale + delta, 0.3), 3);
            this.updateZoomLevel();
            this.render();
            return;
        }

        // Обычный Wheel — Панорамирование (только если не в режиме ввода)
        if (!e.target.closest('input, textarea, select')) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.scale *= delta;
            this.scale = Math.min(Math.max(this.scale, 0.3), 3);
            this.updateZoomLevel();
            this.render();
        }
    }

    // Helper method to get distance between two touch points
    getTouchDistance(touches) {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Helper method to get center point between two touch points
    getTouchCenter(touches) {
        if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }

    handleTouchStart(e) {
        if (e.touches.length === 1) {
            // Single touch - handle canvas panning and node selection
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = (touch.clientX - rect.left - this.offset.x) / this.scale;
            const y = (touch.clientY - rect.top - this.offset.y) / this.scale;
            
            // Check if touching a node
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const nodeEl = target?.closest('.node');
            
            if (nodeEl) {
                // Touching a node - select and prepare for dragging
                const nodeId = nodeEl.dataset.id;
                this.selectNode(nodeId);
                this.draggedNode = nodeId;
                this.isDraggingCanvas = false;
                this.dragOffset = {
                    x: x - this.nodes.find(n => n.id === nodeId).x,
                    y: y - this.nodes.find(n => n.id === nodeId).y
                };
            } else {
                // Touching empty space - prepare for canvas panning
                this.isDraggingCanvas = true;
                this.draggedNode = null;
                this.lastMousePos = { x: touch.clientX, y: touch.clientY };
                this.selectedNode = null;
                this.showNodeProperties(null);
                this.render();
            }
        } else if (e.touches.length === 2) {
            // Two fingers - prepare for pinch zoom
            this.lastTouchDistance = this.getTouchDistance(e.touches);
            this.initialTouchDistance = this.lastTouchDistance;
            this.lastTouchCenter = this.getTouchCenter(e.touches);
            this.touchStartScale = this.scale;
            this.touchStartOffset = { ...this.offset };
        }
    }

    handleTouchMove(e) {
        if (e.touches.length === 1) {
            // Single touch - handle dragging
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = (touch.clientX - rect.left - this.offset.x) / this.scale;
            const y = (touch.clientY - rect.top - this.offset.y) / this.scale;
            
            if (this.draggedNode) {
                // Dragging a node
                e.preventDefault();
                const node = this.nodes.find(n => n.id === this.draggedNode);
                if (node) {
                    node.x = x - this.dragOffset.x;
                    node.y = y - this.dragOffset.y;
                    this.render();
                }
            } else if (this.isDraggingCanvas) {
                // Panning the canvas
                e.preventDefault();
                const dx = touch.clientX - this.lastMousePos.x;
                const dy = touch.clientY - this.lastMousePos.y;
                this.offset.x += dx;
                this.offset.y += dy;
                this.lastMousePos = { x: touch.clientX, y: touch.clientY };
                this.render();
            }
        } else if (e.touches.length === 2) {
            // Two fingers - pinch zoom and pan
            e.preventDefault();
            const currentDistance = this.getTouchDistance(e.touches);
            const currentCenter = this.getTouchCenter(e.touches);
            
            // Calculate zoom relative to initial distance
            if (this.initialTouchDistance > 0) {
                const scaleRatio = currentDistance / this.initialTouchDistance;
                const newScale = this.touchStartScale * scaleRatio;
                this.scale = Math.min(Math.max(newScale, 0.3), 3);
                this.updateZoomLevel();
            }
            
            // Calculate pan (movement of center point)
            const dx = currentCenter.x - this.lastTouchCenter.x;
            const dy = currentCenter.y - this.lastTouchCenter.y;
            this.offset.x = this.touchStartOffset.x + dx;
            this.offset.y = this.touchStartOffset.y + dy;
            
            this.render();
            
            // Update for next move
            this.lastTouchDistance = currentDistance;
            this.lastTouchCenter = currentCenter;
        }
    }

    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            // All fingers lifted
            this.draggedNode = null;
            this.isDraggingCanvas = false;
            this.lastTouchDistance = 0;
            this.initialTouchDistance = 0;
        } else if (e.touches.length === 1) {
            // One finger lifted - reset pinch zoom state
            this.lastTouchDistance = 0;
            this.initialTouchDistance = 0;
            this.touchStartScale = this.scale;
            this.touchStartOffset = { ...this.offset };
        }
    }

    // Pointer Events handlers (more reliable than touch events)
    handlePointerDown(e) {
        console.log('=== POINTER DOWN ===', 'type:', e.pointerType, 'id:', e.pointerId);
        
        // Track this pointer for both mouse and touch
        this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        console.log('Active pointers:', this.activePointers.size);
        
        // Check if pinch zoom (2+ pointers) - only for touch
        if (e.pointerType === 'touch' && this.activePointers.size >= 2) {
            // Pinch zoom mode
            const pointers = Array.from(this.activePointers.values());
            this.lastTouchDistance = this.getDistance(pointers[0], pointers[1]);
            this.initialTouchDistance = this.lastTouchDistance;
            this.lastTouchCenter = this.getCenter(pointers[0], pointers[1]);
            this.touchStartScale = this.scale;
            this.touchStartOffset = { ...this.offset };
            console.log('Starting pinch zoom');
            return;
        }
        
        // Handle gestures for single touch pointer
        if (e.pointerType === 'touch' && this.activePointers.size === 1) {
            // Check for edge swipe
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            
            if (e.clientX <= this.edgeSwipeThreshold ||
                e.clientX >= screenWidth - this.edgeSwipeThreshold ||
                e.clientY <= this.edgeSwipeThreshold ||
                e.clientY >= screenHeight - this.edgeSwipeThreshold) {
                this.isEdgeSwipe = true;
                this.swipeStartX = e.clientX;
                this.swipeStartY = e.clientY;
                console.log('Edge swipe detected at:', e.clientX, e.clientY);
            }
            
            // Check for double tap
            const currentTime = Date.now();
            const timeSinceLastTap = currentTime - this.lastTapTime;
            
            if (timeSinceLastTap < this.doubleTapDelay) {
                // Double tap detected
                console.log('Double tap detected');
                this.handleDoubleTap(e);
                this.lastTapTime = 0;
                this.gestureInProgress = true;
                return;
            }
            this.lastTapTime = currentTime;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offset.x) / this.scale;
        const y = (e.clientY - rect.top - this.offset.y) / this.scale;
        
        // Check if touching a connection or node
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const connectionEl = target?.closest('.connection-line');
        const nodeEl = target?.closest('.node');
        
        // Start long press timer for touch on nodes
        if (e.pointerType === 'touch' && nodeEl && !this.gestureInProgress) {
            this.longPressNode = nodeEl.dataset.id;
            this.longPressTimer = setTimeout(() => {
                this.handleLongPress(nodeEl, e);
            }, this.longPressDuration);
        }
        
        // Check if touching a connection first (works for both mouse and touch)
        if (connectionEl) {
            const connectionId = connectionEl.dataset.connectionId;
            console.log('=== POINTER DOWN ON CONNECTION ===', 'connectionId:', connectionId, 'pointerType:', e.pointerType);
            
            if (connectionId && window.flowEditor) {
                window.flowEditor.selectConnection(connectionId);
                // Показываем контекстное меню для связи
                window.flowEditor.showContextMenu(e.clientX, e.clientY, 'connection');
                // Устанавливаем флаг, чтобы предотвратить сброс выделения в handleCanvasMouseDown
                this.connectionClicked = true;
            }
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
        }
        
        if (nodeEl) {
            const nodeId = nodeEl.dataset.id;
            const node = this.nodes.find(n => n.id === nodeId);
            
            // Handle delete button
            if (target?.classList.contains('delete-btn')) {
                this.deleteNode(nodeId);
                e.stopPropagation();
                return;
            }
            
            // Handle resize handles
            if (target?.classList.contains('resize-handle')) {
                const handleEl = target;
                const resizeHandle = handleEl.dataset.handle;
                
                if (node) {
                    this.resizingNode = nodeId;
                    this.resizeHandle = resizeHandle;
                    
                    // Get current height if it's 'auto'
                    let currentHeight = node.height || 'auto';
                    if (currentHeight === 'auto' && nodeEl) {
                        currentHeight = nodeEl.offsetHeight;
                    }
                    
                    this.resizeStart = {
                        x: x,
                        y: y,
                        width: node.width || 250,
                        height: currentHeight
                    };
                    nodeEl.classList.add('resizing');
                    e.stopPropagation();
                    return;
                }
            }
            
            // В режиме connect обрабатываем клики на коннекторы
            if (this.mode === 'connect') {
                // Handle condition connector clicks
                if (target?.closest('.condition-connector')) {
                    const connectorEl = target.closest('.condition-connector');
                    const connectionType = connectorEl.dataset.connectionType;
                    
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
                else if (target?.closest('.api-connector')) {
                    const connectorEl = target.closest('.api-connector');
                    const connectionType = connectorEl.dataset.connectionType;
                    
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
                else if (target?.closest('.node-button') && target?.closest('.node-button').dataset.buttonConnectable === 'true') {
                    const buttonEl = target.closest('.node-button');
                    const buttonId = buttonEl.dataset.buttonId;
                    
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
                else if (nodeEl.dataset.nodeConnectable === 'true') {
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
            
            // Touching a node - select and prepare for dragging (only in edit mode)
            if (this.mode !== 'connect') {
                console.log('=== POINTER DOWN SELECTING NODE ===', 'nodeId:', nodeId, 'mode:', this.mode);
                
                this.selectNode(nodeId);
                
                this.draggedNode = nodeId;
                this.isDraggingCanvas = false;
                this.dragOffset = {
                    x: x - this.nodes.find(n => n.id === nodeId).x,
                    y: y - this.nodes.find(n => n.id === nodeId).y
                };
            }
        } else {
            console.log('=== POINTER DOWN ON EMPTY SPACE ===', 'clearing selectedConnection:', this.selectedConnection, 'commandClicked:', this.commandClicked, 'currentCommandId:', this.currentCommandId);
            // Touching empty space - prepare for canvas panning
            this.isDraggingCanvas = true;
            this.draggedNode = null;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this.selectedNode = null;
            // Не снимаем выделение со связи если был клик на команду
            if (!this.commandClicked) {
                this.selectedConnection = null; // Снимаем выделение со связи
            }
            this.showNodeProperties(null);
            this.updateDeleteConnectionButton();
            console.log('=== BEFORE RENDER ===', 'currentCommandId:', this.currentCommandId);
            this.render();
            console.log('=== AFTER RENDER ===', 'currentCommandId:', this.currentCommandId);
        }
    }

    handlePointerMove(e) {
        // Update pointer position for both mouse and touch
        if (this.activePointers.has(e.pointerId)) {
            this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        
        // Cancel long press if pointer moved significantly
        if (this.longPressTimer) {
            const pointer = this.activePointers.get(e.pointerId);
            if (pointer) {
                const dx = Math.abs(pointer.x - e.clientX);
                const dy = Math.abs(pointer.y - e.clientY);
                if (dx > 10 || dy > 10) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                    this.longPressNode = null;
                }
            }
        }
        
        // Handle edge swipe
        if (this.isEdgeSwipe && e.pointerType === 'touch' && this.activePointers.size === 1) {
            const dx = e.clientX - this.swipeStartX;
            const dy = e.clientY - this.swipeStartY;
            
            // Check if swipe is significant
            if (Math.abs(dx) > this.swipeThreshold || Math.abs(dy) > this.swipeThreshold) {
                this.handleEdgeSwipe(dx, dy);
                this.isEdgeSwipe = false;
                return;
            }
        }
        
        // Check if pinch zoom (2+ pointers) - only for touch
        if (e.pointerType === 'touch' && this.activePointers.size >= 2) {
            e.preventDefault();
            const pointers = Array.from(this.activePointers.values());
            const currentDistance = this.getDistance(pointers[0], pointers[1]);
            const currentCenter = this.getCenter(pointers[0], pointers[1]);
            
            // Calculate zoom
            if (this.initialTouchDistance > 0) {
                const scaleRatio = currentDistance / this.initialTouchDistance;
                const newScale = this.touchStartScale * scaleRatio;
                this.scale = Math.min(Math.max(newScale, 0.3), 3);
                this.updateZoomLevel();
            }
            
            // Calculate pan
            const dx = currentCenter.x - this.lastTouchCenter.x;
            const dy = currentCenter.y - this.lastTouchCenter.y;
            this.offset.x = this.touchStartOffset.x + dx;
            this.offset.y = this.touchStartOffset.y + dy;
            
            this.render();
            
            // Update for next move
            this.lastTouchDistance = currentDistance;
            this.lastTouchCenter = currentCenter;
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offset.x) / this.scale;
        const y = (e.clientY - rect.top - this.offset.y) / this.scale;
        
        if (this.resizingNode) {
            // Resizing a node
            e.preventDefault();
            const node = this.nodes.find(n => n.id === this.resizingNode);
            if (node) {
                const dx = x - this.resizeStart.x;
                const dy = y - this.resizeStart.y;
                const handle = this.resizeHandle;
                
                let newWidth = this.resizeStart.width;
                let newHeight = this.resizeStart.height;
                
                // Вычисляем минимальную высоту на основе количества кнопок
                const buttonCount = node.buttons ? node.buttons.length : 0;
                const minHeight = buttonCount > 0 ? (125 + buttonCount * 35) : 150;
                
                // Only right (e)
                if (handle === 'e') {
                    newWidth = Math.max(200, this.resizeStart.width + dx);
                }
                // Only down (s)
                else if (handle === 's') {
                    newHeight = Math.max(minHeight, this.resizeStart.height + dy);
                }
                // Diagonal right-down (se)
                else if (handle === 'se') {
                    newWidth = Math.max(200, this.resizeStart.width + dx);
                    newHeight = Math.max(minHeight, this.resizeStart.height + dy);
                }
                
                node.width = newWidth;
                node.height = newHeight;
                
                this.render();
            }
        } else if (this.draggedConnector) {
            // Drawing a connection
            this.tempConnection.endX = x;
            this.tempConnection.endY = y;
            this.renderConnections();
        } else if (this.draggedNode) {
            // Dragging a node
            e.preventDefault();
            const node = this.nodes.find(n => n.id === this.draggedNode);
            if (node) {
                node.x = x - this.dragOffset.x;
                node.y = y - this.dragOffset.y;
                this.render();
            }
        } else if (this.isDraggingCanvas) {
            // Panning the canvas
            e.preventDefault();
            const dx = e.clientX - this.lastMousePos.x;
            const dy = e.clientY - this.lastMousePos.y;
            this.offset.x += dx;
            this.offset.y += dy;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this.render();
        }
    }

    handlePointerUp(e) {
        // Remove pointer from active pointers (both mouse and touch)
        this.activePointers.delete(e.pointerId);
        console.log('=== POINTER UP ===', 'pointerType:', e.pointerType, 'active:', this.activePointers.size, 'selectedConnection:', this.selectedConnection);
        
        // Clear long press timer
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
            this.longPressNode = null;
        }
        
        // Reset gesture flags
        if (this.activePointers.size === 0) {
            this.isEdgeSwipe = false;
            this.gestureInProgress = false;
        }
        
        // Reset pinch zoom state if less than 2 pointers (only for touch)
        if (e.pointerType === 'touch' && this.activePointers.size < 2) {
            this.lastTouchDistance = 0;
            this.initialTouchDistance = 0;
        }
        
        // Handle resize end
        if (this.resizingNode) {
            const nodeEl = document.querySelector(`.node[data-id="${this.resizingNode}"]`);
            if (nodeEl) {
                nodeEl.classList.remove('resizing');
            }
            this.resizingNode = null;
            this.resizeHandle = null;
            this.render();
        }
        
        // Handle connector end (finishing a connection)
        if (this.draggedConnector) {
            const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.node');
            if (target) {
                const toNodeId = target.dataset.id;
                
                // Hide connectors on source node
                if (this.draggedConnector.type === 'node') {
                    const sourceNodeEl = document.querySelector(`.node[data-id="${this.draggedConnector.id}"]`);
                    if (sourceNodeEl) {
                        this.hideConnectors(sourceNodeEl);
                    }
                }
                
                if (this.draggedConnector.type === 'button') {
                    this.addConnection(this.draggedConnector.id, toNodeId, this.draggedConnector.fromNode);
                } else if (this.draggedConnector.type === 'node') {
                    this.addNodeConnection(this.draggedConnector.id, toNodeId);
                } else if (this.draggedConnector.type === 'api') {
                    this.addApiConnection(this.draggedConnector.fromNode, toNodeId, this.draggedConnector.connectionType);
                } else if (this.draggedConnector.type === 'condition') {
                    this.addConditionConnection(this.draggedConnector.fromNode, toNodeId, this.draggedConnector.connectionType);
                }
                
                // Vibrate to confirm connection
                this.vibrateMedium();
            } else {
                // Connection cancelled - hide connectors
                if (this.draggedConnector.type === 'node') {
                    const sourceNodeEl = document.querySelector(`.node[data-id="${this.draggedConnector.id}"]`);
                    if (sourceNodeEl) {
                        this.hideConnectors(sourceNodeEl);
                    }
                }
                this.renderConnections();
            }
            this.draggedConnector = null;
            this.tempConnection = null;
        }
        
        this.draggedNode = null;
        this.isDraggingCanvas = false;
    }
    
    // Helper methods for pinch-zoom with pointers
    getDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getCenter(p1, p2) {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };
    }
    
    // Gesture handlers
    
    handleLongPress(nodeEl, event) {
        console.log('=== LONG PRESS ===', 'nodeId:', nodeEl.dataset.id);
        
        const nodeId = nodeEl.dataset.id;
        const node = this.nodes.find(n => n.id === nodeId);
        
        if (!node) return;
        
        // Check if node can be connected from (not API or condition nodes)
        if (node.type === 'api_request' || node.type === 'condition') {
            // For API and condition nodes, just select them
            nodeEl.classList.add('long-press-active');
            
            this.vibrateHeavy();
            
            this.selectNode(nodeId);
            
            setTimeout(() => {
                nodeEl.classList.remove('long-press-active');
            }, 300);
            
            this.longPressTimer = null;
            this.longPressNode = null;
            return;
        }
        
        // For regular nodes, enter connect mode
        console.log('=== ENTERING CONNECT MODE ===', 'nodeId:', nodeId);
        
        // Visual feedback - highlight the node
        nodeEl.classList.add('long-press-active');
        
        // Vibrate for tactile feedback (if supported)
        this.vibrateHeavy();
        
        // Select the node
        this.selectNode(nodeId);
        
        // Show connectors with animation
        this.showConnectors(nodeEl);
        
        // Enter connect mode for this node
        this.draggedConnector = { type: 'node', id: nodeId };
        this.gestureInProgress = true;
        
        // Initialize temp connection
        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left - this.offset.x) / this.scale;
        const y = (event.clientY - rect.top - this.offset.y) / this.scale;
        
        this.tempConnection = {
            startX: x,
            startY: y,
            endX: x,
            endY: y
        };
        
        // Remove highlight after a short delay
        setTimeout(() => {
            nodeEl.classList.remove('long-press-active');
        }, 300);
        
        // Clear timer
        this.longPressTimer = null;
        this.longPressNode = null;
    }
    
    showConnectors(nodeEl) {
        console.log('=== SHOWING CONNECTORS ===', 'nodeId:', nodeEl.dataset.id);
        
        // Show and animate all connectors on this node
        const connectors = nodeEl.querySelectorAll('.connector, .node-connector-target');
        connectors.forEach(connector => {
            connector.style.display = 'block';
            connector.classList.add('pulsing');
        });
        
        // Also show button connectors if in menu node
        const buttonConnectors = nodeEl.querySelectorAll('.node-button .connector');
        buttonConnectors.forEach(connector => {
            connector.style.display = 'block';
            connector.classList.add('pulsing');
        });
    }
    
    hideConnectors(nodeEl) {
        console.log('=== HIDING CONNECTORS ===', 'nodeId:', nodeEl.dataset.id);
        
        // Hide and remove animation from all connectors
        const connectors = nodeEl.querySelectorAll('.connector, .node-connector-target');
        connectors.forEach(connector => {
            connector.classList.remove('pulsing');
        });
        
        const buttonConnectors = nodeEl.querySelectorAll('.node-button .connector');
        buttonConnectors.forEach(connector => {
            connector.classList.remove('pulsing');
        });
    }
    
    handleDoubleTap(event) {
        console.log('=== DOUBLE TAP ===');
        
        // Vibrate for tactile feedback
        this.vibrateDouble();
        
        // Reset zoom to default
        this.zoomReset();
        
        // Visual feedback
        this.showZoomIndicator();
    }
    
    handleEdgeSwipe(dx, dy) {
        console.log('=== EDGE SWIPE ===', 'dx:', dx, 'dy:', dy);
        
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // Determine swipe direction
        const isLeftEdge = this.swipeStartX <= this.edgeSwipeThreshold;
        const isRightEdge = this.swipeStartX >= screenWidth - this.edgeSwipeThreshold;
        const isTopEdge = this.swipeStartY <= this.edgeSwipeThreshold;
        const isBottomEdge = this.swipeStartY >= screenHeight - this.edgeSwipeThreshold;
        
        // Vibrate for tactile feedback
        this.vibrateMedium();
        
        // Left edge swipe → open commands sheet
        if (isLeftEdge && dx > this.swipeThreshold) {
            const commandsSheet = document.getElementById('commands-sheet');
            if (commandsSheet) {
                this.openBottomSheet(commandsSheet);
            }
        }
        // Right edge swipe → open properties sheet (if node selected)
        else if (isRightEdge && dx < -this.swipeThreshold) {
            if (this.selectedNode) {
                const node = this.nodes.find(n => n.id === this.selectedNode);
                if (node) {
                    this.openPropertiesSheet(node);
                }
            }
        }
        // Bottom edge swipe → open properties sheet
        else if (isBottomEdge && dy < -this.swipeThreshold) {
            if (this.selectedNode) {
                const node = this.nodes.find(n => n.id === this.selectedNode);
                if (node) {
                    this.openPropertiesSheet(node);
                }
            }
        }
    }
    
    showZoomIndicator() {
        // Create or update zoom indicator
        let indicator = document.getElementById('zoom-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'zoom-indicator';
            indicator.className = 'zoom-indicator';
            document.body.appendChild(indicator);
        }
        
        indicator.textContent = `${Math.round(this.scale * 100)}%`;
        indicator.classList.add('visible');
        
        // Hide after a short delay
        setTimeout(() => {
            indicator.classList.remove('visible');
        }, 1000);
    }
    
    zoomIn() {
        this.scale = Math.min(this.scale * 1.2, 3);
        this.updateZoomLevel();
        this.render();
    }
    
    zoomOut() {
        this.scale = Math.max(this.scale / 1.2, 0.3);
        this.updateZoomLevel();
        this.render();
    }
    
    zoomReset() {
        this.scale = 1;
        this.updateZoomLevel();
        this.render();
    }
    
    updateZoomLevel() {
        const zoomLevelEl = document.getElementById('zoomLevel');
        if (zoomLevelEl) {
            zoomLevelEl.textContent = Math.round(this.scale * 100) + '%';
        }
    }
    
    handleKeyDown(e) {
        // Игнорируем горячие клавиши если фокус на input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        // Ctrl + S — Сохранить
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.saveFlow();
            this.showNotification('💾 Проект сохранён');
            return;
        }

        // Ctrl + Z — Отмена
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.undo();
            return;
        }

        // Ctrl + Y — Повтор
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
            return;
        }

        // Ctrl + D — Дублировать узел
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            this.duplicateSelectedNode();
            return;
        }

        // Delete — Удалить выбранное
        if (e.key === 'Delete') {
            // Сначала проверяем выделенную связь
            if (this.selectedConnection) {
                this.deleteConnection(this.selectedConnection);
                e.preventDefault();
            }
            // Затем проверяем выделенный узел
            else if (this.selectedNode && this.selectedNode !== 'start') {
                this.deleteNode(this.selectedNode);
                e.preventDefault();
            }
            return;
        }

        // 1, 2, 3 — Переключение режимов
        if (e.key === '1') {
            e.preventDefault();
            this.setMode('edit');
            this.showNotification('✏️ Режим редактирования');
            return;
        }
        if (e.key === '2') {
            e.preventDefault();
            this.setMode('connect');
            this.showNotification('🔗 Режим соединения');
            return;
        }
        if (e.key === '3') {
            e.preventDefault();
            this.setMode('view');
            this.showNotification('👁️ Режим просмотра');
            return;
        }

        // Esc — Снять выделение
        if (e.key === 'Escape') {
            e.preventDefault();
            this.deselectAll();
            return;
        }

        // F — Поиск узла
        if (e.key === 'f' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            this.openSearch();
            return;
        }

        // Space — Панорамирование (начало)
        if (e.key === ' ' && !e.repeat) {
            e.preventDefault();
            this.enterPanMode();
            return;
        }
    }

    handleKeyUp(e) {
        // Space — Панорамирование (конец)
        if (e.key === ' ') {
            this.exitPanMode();
        }
    }

    // ==========================================================================
    // Функции горячих клавиш
    // ==========================================================================

    undo() {
        console.log('=== UNDO ===', 'stack size:', this.undoStack.length);
        if (this.undoStack.length === 0) {
            this.showNotification('ℹ️ Нечего отменять');
            return;
        }

        // Сохраняем текущее состояние в redoStack
        const currentState = this.saveState();
        this.redoStack.push(currentState);

        // Восстанавливаем предыдущее состояние
        const previousState = this.undoStack.pop();
        this.restoreState(previousState);

        this.showNotification('↩️ Отмена');
    }

    redo() {
        console.log('=== REDO ===', 'stack size:', this.redoStack.length);
        if (this.redoStack.length === 0) {
            this.showNotification('ℹ️ Нечего повторять');
            return;
        }

        // Сохраняем текущее состояние в undoStack
        const currentState = this.saveState();
        this.undoStack.push(currentState);

        // Восстанавливаем следующее состояние
        const nextState = this.redoStack.pop();
        this.restoreState(nextState);

        this.showNotification('↪️ Повтор');
    }

    saveState() {
        // Сохраняем текущее состояние для undo/redo
        return {
            nodes: JSON.parse(JSON.stringify(this.nodes)),
            connections: JSON.parse(JSON.stringify(this.connections)),
            selectedNode: this.selectedNode,
            selectedConnection: this.selectedConnection,
            scale: this.scale,
            offset: { ...this.offset }
        };
    }

    restoreState(state) {
        // Восстанавливаем состояние
        this.nodes = JSON.parse(JSON.stringify(state.nodes));
        this.connections = JSON.parse(JSON.stringify(state.connections));
        this.selectedNode = state.selectedNode;
        this.selectedConnection = state.selectedConnection;
        this.scale = state.scale;
        this.offset = { ...state.offset };

        this.render();
        this.updateZoomLevel();
    }

    saveToHistory() {
        // Сохраняем состояние в историю перед изменением
        const state = this.saveState();
        this.undoStack.push(state);

        // Ограничиваем размер истории
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }

        // Очищаем redoStack при новом действии
        this.redoStack = [];
    }

    duplicateSelectedNode() {
        console.log('=== DUPLICATE SELECTED NODE ===');
        if (!this.selectedNode || this.selectedNode === 'start') {
            this.showNotification('ℹ️ Выберите узел для дублирования');
            return;
        }

        const node = this.nodes.find(n => n.id === this.selectedNode);
        if (!node) return;

        // Сохраняем состояние в историю
        this.saveToHistory();

        // Создаём копию узла
        const newNode = JSON.parse(JSON.stringify(node));
        newNode.id = `node_${this.nodeIdCounter++}`;
        newNode.x = node.x + 50;
        newNode.y = node.y + 50;

        // Генерируем новые ID для кнопок
        if (newNode.buttons) {
            newNode.buttons.forEach((btn, index) => {
                btn.id = `btn_${this.nodeIdCounter}_${index}`;
                btn.nextNodeId = null;
            });
        }

        this.nodes.push(newNode);
        this.render();
        this.selectNode(newNode.id);

        this.showNotification('📋 Узел дублирован');

        // Вибрация для тактильной обратной связи
        this.vibrateDouble();
    }

    deselectAll() {
        console.log('=== DESELECT ALL ===');
        this.selectedNode = null;
        this.selectedConnection = null;
        this.showNodeProperties(null);
        this.updateDeleteConnectionButton();
        this.updateNodeSelection();
        this.render();
        this.showNotification('ℹ️ Выделение снято');
    }

    openSearch() {
        console.log('=== OPEN SEARCH ===');
        // TODO: Реализовать поиск узлов
        this.showNotification('🔍 Поиск узлов (в разработке)');
    }

    enterPanMode() {
        console.log('=== ENTER PAN MODE ===');
        this.canvas.style.cursor = 'grab';
        this.isPanning = true;
        this.showNotification('✋ Режим панорамирования');
    }

    exitPanMode() {
        console.log('=== EXIT PAN MODE ===');
        if (this.isPanning) {
            this.canvas.style.cursor = 'grab';
            this.isPanning = false;
        }
    }

    showNotification(message) {
        console.log('=== NOTIFICATION ===', message);

        // Создаём или обновляем уведомление
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.className = 'notification';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.classList.add('visible');

        // Удаляем предыдущий таймер
        if (this.notificationTimer) {
            clearTimeout(this.notificationTimer);
        }

        // Скрываем уведомление через 2 секунды
        this.notificationTimer = setTimeout(() => {
            notification.classList.remove('visible');
        }, 2000);
    }

    handleConnectionClick(e) {
        console.log('=== CONNECTION CLICK ===', 'target:', e.target.tagName, 'classList:', Array.from(e.target.classList), 'pointerType:', e.pointerType);
        
        // Игнорируем клики на интерактивных элементах
        if (e.target.closest('.node') ||
            e.target.closest('.btn') ||
            e.target.closest('.sidebar') ||
            e.target.closest('.zoom-controls') ||
            e.target.closest('.context-menu') ||
            e.target.closest('.modal')) {
            console.log('Click ignored - on interactive element');
            return;
        }
        
        // Проверяем, что клик был именно на связи, а не на других элементах
        const path = e.target.closest('.connection-line');
        console.log('Path found:', path);
        
        if (path) {
            const connectionId = path.dataset.connectionId;
            console.log('Connection ID:', connectionId);
            if (connectionId) {
                e.stopPropagation();
                e.preventDefault();
                // Используем глобальный flowEditor вместо this
                if (window.flowEditor) {
                    window.flowEditor.selectConnection(connectionId);
                    // Сразу показываем контекстное меню
                    console.log('Showing context menu at:', e.clientX, e.clientY);
                    window.flowEditor.showContextMenu(e.clientX, e.clientY);
                } else {
                    console.error('flowEditor not available');
                }
            }
        } else {
            console.log('Click not on connection, checking if menu should be closed...');
            // Если клик не на связи и не на интерактивных элементах, закрываем контекстное меню
            const menu = document.getElementById('connectionContextMenu');
            if (menu && menu.style.display === 'block' && !menu.contains(e.target)) {
                console.log('Closing menu by outside click');
                menu.style.display = 'none';
                menu.style.visibility = 'hidden';
            }
        }
    }
    
    handleConnectionRightClick(e) {
        console.log('=== CONNECTION RIGHT CLICK ===', 'target:', e.target.tagName, 'classList:', Array.from(e.target.classList));
        
        // Игнорируем клики на интерактивных элементах
        if (e.target.closest('.node') ||
            e.target.closest('.btn') ||
            e.target.closest('.sidebar') ||
            e.target.closest('.zoom-controls') ||
            e.target.closest('.context-menu') ||
            e.target.closest('.modal')) {
            console.log('Right click ignored - on interactive element');
            return;
        }
        
        const path = e.target.closest('.connection-line');
        if (path) {
            const connectionId = path.dataset.connectionId;
            if (connectionId) {
                e.preventDefault();
                e.stopPropagation();
                // Используем глобальный flowEditor вместо this
                if (window.flowEditor) {
                    window.flowEditor.selectConnection(connectionId);
                    // Правый клик также показывает контекстное меню
                    console.log('Showing context menu at:', e.clientX, e.clientY);
                    window.flowEditor.showContextMenu(e.clientX, e.clientY);
                } else {
                    console.error('flowEditor not available');
                }
            }
        }
    }

    showContextMenu(x, y) {
        console.log('=== SHOW CONTEXT MENU ===', 'x:', x, 'y:', y);
        const menu = document.getElementById('connectionContextMenu');
        if (menu) {
            // Устанавливаем позицию меню
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            
            // Показываем меню
            menu.style.display = 'block';
            menu.style.visibility = 'visible';
            
            const menuRect = menu.getBoundingClientRect();
            console.log('Menu shown at:', x, y, 'actual position:', menuRect.left, menuRect.top, 'size:', menuRect.width, menuRect.height);
            console.log('Menu display:', menu.style.display, 'visibility:', menu.style.visibility);

            // Сначала удаляем старые обработчики, если есть
            const oldHandler = menu._closeMenuHandler;
            if (oldHandler) {
                document.removeEventListener('click', oldHandler);
            }

            // Закрытие меню при клике вне его
            const closeMenu = (e) => {
                console.log('Close menu clicked, target:', e.target, 'menu contains:', menu.contains(e.target));
                
                if (!menu.contains(e.target)) {
                    menu.style.display = 'none';
                    menu.style.visibility = 'hidden';
                    document.removeEventListener('click', closeMenu);
                    menu._closeMenuHandler = null;
                    console.log('Menu closed');
                }
            };
            
            // Сохраняем ссылку на обработчик для возможности удаления
            menu._closeMenuHandler = closeMenu;
            
            // Добавляем обработчик с задержкой, чтобы текущий клик не закрывал меню
            setTimeout(() => {
                document.addEventListener('click', closeMenu);
                console.log('Close menu handler attached');
            }, 100);
        } else {
            console.error('Context menu element not found!');
        }
    }

    // ==========================================================================
    // Контекстное меню для узлов (ПКМ)
    // ==========================================================================

    handleNodeContextMenu(e) {
        console.log('=== NODE CONTEXT MENU ===', 'target:', e.target.tagName);

        // Проверяем, что клик был на узле
        const nodeEl = e.target.closest('.node');
        if (!nodeEl) {
            // Если клик не на узле, закрываем контекстное меню
            const menu = document.getElementById('nodeContextMenu');
            if (menu) {
                menu.style.display = 'none';
                menu.classList.remove('visible');
            }
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const nodeId = nodeEl.dataset.id;
        console.log('=== NODE CONTEXT MENU ===', 'nodeId:', nodeId);

        // Выбираем узел
        this.selectNode(nodeId);
        this.contextMenuTargetNodeId = nodeId;

        // Показываем контекстное меню
        this.showNodeContextMenu(e.clientX, e.clientY);
    }

    showNodeContextMenu(x, y) {
        console.log('=== SHOW NODE CONTEXT MENU ===', 'x:', x, 'y:', y);
        const menu = document.getElementById('nodeContextMenu');
        if (!menu) {
            console.error('Node context menu element not found!');
            return;
        }

        // Устанавливаем позицию меню
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Показываем меню с анимацией
        menu.style.display = 'block';
        menu.classList.add('visible');

        // Проверяем, не выходит ли меню за пределы экрана
        const menuRect = menu.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        if (menuRect.right > screenWidth) {
            menu.style.left = (x - menuRect.width) + 'px';
        }
        if (menuRect.bottom > screenHeight) {
            menu.style.top = (y - menuRect.height) + 'px';
        }

        // Удаляем старые обработчики, если есть
        const oldHandler = menu._closeMenuHandler;
        if (oldHandler) {
            document.removeEventListener('click', oldHandler);
        }

        // Закрытие меню при клике вне его
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.style.display = 'none';
                menu.classList.remove('visible');
                document.removeEventListener('click', closeMenu);
                menu._closeMenuHandler = null;
            }
        };

        // Сохраняем ссылку на обработчик
        menu._closeMenuHandler = closeMenu;

        // Добавляем обработчик с задержкой
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 100);
    }

    setupNodeContextMenuHandlers() {
        const menu = document.getElementById('nodeContextMenu');
        if (!menu) return;

        // Добавляем обработчики для всех пунктов меню
        const menuItems = menu.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const action = item.getAttribute('data-action');
                this.handleNodeContextMenuAction(action);

                // Закрываем меню после клика
                menu.style.display = 'none';
                menu.classList.remove('visible');
            });
        });
    }

    handleNodeContextMenuAction(action) {
        console.log('=== NODE CONTEXT MENU ACTION ===', 'action:', action, 'nodeId:', this.contextMenuTargetNodeId);

        if (!this.contextMenuTargetNodeId) return;

        const node = this.nodes.find(n => n.id === this.contextMenuTargetNodeId);
        if (!node) return;

        switch (action) {
            case 'edit':
                this.contextMenuActionEdit(node);
                break;
            case 'duplicate':
                this.contextMenuActionDuplicate(node);
                break;
            case 'delete':
                this.contextMenuActionDelete(node);
                break;
            case 'connect':
                this.contextMenuActionConnect(node);
                break;
            case 'center':
                this.contextMenuActionCenter(node);
                break;
            case 'focus':
                this.contextMenuActionFocus(node);
                break;
        }
    }

    contextMenuActionEdit(node) {
        console.log('=== CONTEXT MENU: EDIT ===', 'nodeId:', node.id);
        // Открываем Markdown редактор для узлов типа message, menu, universal или start
        if (node.type === 'message' || node.type === 'menu' || node.type === 'universal' || node.isStart) {
            if (typeof openMarkdownEditor === 'function') {
                openMarkdownEditor(node.id);
            } else {
                console.error('openMarkdownEditor function not available');
            }
        } else {
            // Для других типов узлов просто открываем свойства
            this.selectNode(node.id);
        }
    }

    contextMenuActionDuplicate(node) {
        console.log('=== CONTEXT MENU: DUPLICATE ===', 'nodeId:', node.id);

        // Создаём копию узла со смещением
        const newNode = JSON.parse(JSON.stringify(node));
        newNode.id = `node_${this.nodeIdCounter++}`;
        newNode.x = node.x + 50;
        newNode.y = node.y + 50;

        // Генерируем новые ID для кнопок
        if (newNode.buttons) {
            newNode.buttons.forEach((btn, index) => {
                btn.id = `btn_${this.nodeIdCounter}_${index}`;
                btn.nextNodeId = null;
            });
        }

        this.nodes.push(newNode);
        this.render();
        this.selectNode(newNode.id);

        // Вибрация для тактильной обратной связи
        this.vibrateDouble();
    }

    contextMenuActionDelete(node) {
        console.log('=== CONTEXT MENU: DELETE ===', 'nodeId:', node.id);
        if (node.id !== 'start') {
            this.deleteNode(node.id);

            // Вибрация для тактильной обратной связи
            this.vibrateHeavy();
        }
    }

    contextMenuActionConnect(node) {
        console.log('=== CONTEXT MENU: CONNECT ===', 'nodeId:', node.id);

        // Проверяем, может ли узел быть источником соединения
        if (node.type === 'api_request' || node.type === 'condition') {
            // Для API и condition узлов просто показываем сообщение
            console.log('Use specific connectors for API/Condition nodes');
            return;
        }

        // Переключаемся в режим соединения
        this.setMode('connect');

        // Выбираем узел и показываем коннекторы
        this.selectNode(node.id);
        const nodeEl = document.querySelector(`.node[data-id="${node.id}"]`);
        if (nodeEl) {
            this.showConnectors(nodeEl);
        }

        // Вибрация для тактильной обратной связи
        this.vibrateMedium();
    }

    contextMenuActionCenter(node) {
        console.log('=== CONTEXT MENU: CENTER ===', 'nodeId:', node.id);

        // Центрируем узел на канвасе
        const canvas = this.canvas;
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;

        const nodeWidth = node.width || 250;
        const nodeHeight = node.height || 150;

        // Вычисляем новые координаты для центрирования
        node.x = (canvasWidth / this.scale - nodeWidth) / 2 - this.offset.x / this.scale;
        node.y = (canvasHeight / this.scale - nodeHeight) / 2 - this.offset.y / this.scale;

        this.render();

        // Вибрация для тактильной обратной связи
        this.vibrateMedium();
    }

    contextMenuActionFocus(node) {
        console.log('=== CONTEXT MENU: FOCUS ===', 'nodeId:', node.id);

        // Центрируем вид на узле
        const canvas = this.canvas;
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;

        const nodeWidth = node.width || 250;
        const nodeHeight = node.height || 150;

        // Вычисляем offset для центрирования узла
        this.offset.x = (canvasWidth - nodeWidth * this.scale) / 2 - node.x * this.scale;
        this.offset.y = (canvasHeight - nodeHeight * this.scale) / 2 - node.y * this.scale;

        // Выбираем узел
        this.selectNode(node.id);
        this.render();

        // Вибрация для тактильной обратной связи
        this.vibrateMedium();
    }

    setMode(mode) {
        this.mode = mode;
        
        // Обновляем активный класс для mode-btn
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(btn => {
            const btnMode = btn.getAttribute('data-mode');
            if (btnMode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Обновляем курсор в зависимости от режима
        if (mode === 'connect') {
            this.canvas.style.cursor = 'crosshair';
        } else if (mode === 'view') {
            this.canvas.style.cursor = 'default';
        } else {
            this.canvas.style.cursor = 'grab';
        }

        // Обновляем отображение коннекторов
        this.render();
    }
    selectNode(nodeId) {
        console.log('=== SELECT NODE START ===', 'nodeId:', nodeId, 'selectedConnection was:', this.selectedConnection);
        console.log('=== SELECT NODE ===', 'nodeProperties exists:', !!this.nodeProperties);

        this.selectedNode = nodeId;
        this.selectedConnection = null; // Снимаем выделение со связи при выборе узла
        const node = this.nodes.find(n => n.id === nodeId);

        console.log('Node found:', node ? node.id : 'null', 'type:', node ? node.type : 'null');
        console.log('About to call showNodeProperties...');

        this.showNodeProperties(node);
        this.openPropertiesSheet(node); // Открываем properties sheet на мобильных
        this.updateDeleteConnectionButton();
        this.updateNodeSelection(); // Обновляем только выделение узлов

        console.log('=== NODE SELECTED END ===', 'selectedNode:', this.selectedNode, 'selectedConnection:', this.selectedConnection);
    }
    
    updateNodeSelection() {
        // Обновляет только визуальное выделение узлов без полной перерисовки
        const allNodes = document.querySelectorAll('.node');
        allNodes.forEach(nodeEl => {
            if (nodeEl.dataset.id === this.selectedNode) {
                nodeEl.classList.add('selected');
            } else {
                nodeEl.classList.remove('selected');
            }
        });
    }
    
    selectConnection(connectionId) {
        console.log('=== SELECT CONNECTION ===', 'connectionId:', connectionId);
        this.selectedConnection = connectionId;
        this.selectedNode = null; // Снимаем выделение с узла при выборе связи
        this.showNodeProperties(null);
        this.updateDeleteConnectionButton();
        this.render();
        console.log('=== CONNECTION SELECTED ===', 'selectedConnection:', this.selectedConnection, 'selectedNode:', this.selectedNode);
    }
    
    updateDeleteConnectionButton() {
        const btn = document.getElementById('btnDeleteConnection');
        if (btn) {
            btn.style.display = this.selectedConnection ? 'block' : 'none';
        }
    }

    addControlPointToConnection(connectionId) {
        const connection = this.connections.find(c => c.id === connectionId);
        if (!connection) return;

        // Инициализируем массив опорных точек для этой связи
        if (!this.controlPoints[connectionId]) {
            this.controlPoints[connectionId] = [];
        }

        // Вычисляем середину линии для опорной точки
        const fromNode = this.nodes.find(n => n.id === connection.from);
        const toNode = this.nodes.find(n => n.id === connection.to);
        if (!fromNode || !toNode) return;

        const fromWidth = fromNode.width || 250;
        const fromHeight = fromNode.height || 150;
        const toWidth = toNode.width || 250;
        const toHeight = toNode.height || 150;

        const startX = fromNode.x + fromWidth;
        const startY = fromNode.y + fromHeight / 2;
        const endX = toNode.x;
        const endY = toNode.y + toHeight / 2;

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        // Добавляем опорную точку
        const pointId = `cp_${connectionId}_${this.controlPoints[connectionId].length}`;
        this.controlPoints[connectionId].push({
            id: pointId,
            x: midX,
            y: midY
        });

        this.render();
    }
    
    showNodeProperties(node) {
        console.log('=== SHOW NODE PROPERTIES ===', 'node:', node ? node.id : 'null', 'type:', node ? node.type : 'null');
        console.log('=== SHOW NODE PROPERTIES ===', 'nodeProperties element:', !!this.nodeProperties);
        
        if (!this.nodeProperties) {
            console.error('=== NODE PROPERTIES ELEMENT NOT FOUND ===');
            return;
        }
        
        if (!node) {
            this.nodeProperties.innerHTML = '<p>Выберите узел для редактирования</p>';
            return;
        }

        let html = '';
        console.log('=== SHOW NODE PROPERTIES ===', 'Generating HTML for node type:', node.type);

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
                    <div class="textarea-with-editor">
                        <textarea id="nodeText">${node.text}</textarea>
                        <button class="html-editor-btn" onclick="openMarkdownEditor('${node.id}')">📝 Markdown редактор</button>
                    </div>
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
        console.log('=== SHOW NODE PROPERTIES ===', 'HTML set, length:', html.length, 'setupNodePropertyListeners calling...');
        console.log('=== SHOW NODE PROPERTIES ===', 'innerHTML after set:', this.nodeProperties.innerHTML.substring(0, 100) + '...');
        console.log('=== SHOW NODE PROPERTIES ===', 'element visible:', window.getComputedStyle(this.nodeProperties).display !== 'none');
        
        this.setupNodePropertyListeners(node);
        console.log('=== SHOW NODE PROPERTIES ===', 'Completed');
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

                document.querySelectorAll('.button-webapp-input').forEach(input => {
                    input.addEventListener('input', (e) => {
                        this.updateButtonWebAppUrl(node.id, parseInt(e.target.dataset.index), e.target.value);
                    });
                });

                document.querySelectorAll('.button-contact-input').forEach(input => {
                    input.addEventListener('input', (e) => {
                        this.updateButtonContactId(node.id, parseInt(e.target.dataset.index), e.target.value);
                    });
                });

                document.querySelectorAll('.button-payload-input').forEach(input => {
                    input.addEventListener('input', (e) => {
                        this.updateButtonPayload(node.id, parseInt(e.target.dataset.index), e.target.value);
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
                <input type="text" class="button-text-input" data-index="${index}" value="${btn.text}" onchange="flowEditor.updateButtonText('${node.id}', ${index}, this.value)" placeholder="Текст кнопки">
                <select class="button-type-input" data-index="${index}" onchange="flowEditor.updateButtonType('${node.id}', ${index}, this.value)">
                    <option value="callback" ${btn.type === 'callback' ? 'selected' : ''}>Callback</option>
                    <option value="link" ${btn.type === 'link' ? 'selected' : ''}>Ссылка</option>
                    <option value="open_app" ${btn.type === 'open_app' ? 'selected' : ''}>Мини-приложение</option>
                    <option value="request_contact" ${btn.type === 'request_contact' ? 'selected' : ''}>Запросить контакт</option>
                    <option value="request_location" ${btn.type === 'request_location' ? 'selected' : ''}>Запросить геолокацию</option>
                    <option value="message" ${btn.type === 'message' ? 'selected' : ''}>Отправить сообщение</option>
                </select>
                ${btn.type === 'link' ? `
                    <input type="text" class="button-url-input" data-index="${index}" value="${btn.url || ''}" placeholder="URL ссылки (https://..., макс. 2048 символов)" onchange="flowEditor.updateButtonUrl('${node.id}', ${index}, this.value)">
                ` : ''}
                ${btn.type === 'open_app' ? `
                    <input type="text" class="button-url-input button-webapp-input" data-index="${index}" value="${btn.webAppUrl || ''}" placeholder="Username бота или ссылка (например, @botname или https://max.ru/botname)" onchange="flowEditor.updateButtonWebAppUrl('${node.id}', ${index}, this.value)">
                    <input type="text" class="button-contact-input" data-index="${index}" value="${btn.contactId || ''}" placeholder="ID бота (опционально)" onchange="flowEditor.updateButtonContactId('${node.id}', ${index}, this.value)">
                    <input type="text" class="button-payload-input" data-index="${index}" value="${btn.payload || ''}" placeholder="Параметры запуска (опционально)" onchange="flowEditor.updateButtonPayload('${node.id}', ${index}, this.value)">
                ` : ''}
                <button class="remove-button" onclick="flowEditor.removeButton('${node.id}', ${index})">✕ Удалить</button>
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
                webAppUrl: '',
                contactId: '',
                payload: ''
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

    updateButtonWebAppUrl(nodeId, buttonIndex, webAppUrl) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.buttons && node.buttons[buttonIndex]) {
            node.buttons[buttonIndex].webAppUrl = webAppUrl;
        }
    }

    updateButtonContactId(nodeId, buttonIndex, contactId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.buttons && node.buttons[buttonIndex]) {
            node.buttons[buttonIndex].contactId = contactId;
        }
    }

    updateButtonPayload(nodeId, buttonIndex, payload) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.buttons && node.buttons[buttonIndex]) {
            node.buttons[buttonIndex].payload = payload;
        }
    }

    render() {
        this.syncConnections();
        this.renderNodes();
        this.renderConnections();
        
        // Сбрасываем флаг после перерисовки
        if (this.suppressCommandsRender) {
            setTimeout(() => { this.suppressCommandsRender = false; }, 50);
        }
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
            let isTextOverflow = false;
            
            if (node.type === 'api_request') {
                content = `<div class="node-text">${node.method} ${this.escapeHtml(node.url).substring(0, 40)}...</div>`;
            } else if (node.type === 'condition') {
                content = `<div class="node-text">${this.escapeHtml(node.condition)}</div>`;
            } else if (node.type === 'transform') {
                const transformations = node.transformations || [];
                const count = transformations.length;
                content = `<div class="node-text">${count} трансформаций</div>`;
            } else {
                // Показываем отформатированный текст (Markdown преобразуется в HTML)
                let textContent = node.text || '';
                
                // Если формат markdown, преобразуем в HTML
                if (node.format === 'markdown') {
                    textContent = this.markdownToHtml(textContent);
                }
                
                const nodeWidth = node.width || 250;
                
                // Проверяем, превышает ли текст допустимую длину для текущего размера
                const textLength = textContent.length;
                const estimatedCharsPerLine = Math.floor(nodeWidth / 8); // Приблизительно 8 пикселей на символ
                const estimatedLines = Math.ceil(textLength / estimatedCharsPerLine);
                const maxLines = 5;
                
                isTextOverflow = estimatedLines > maxLines;
                
                content = `<div class="node-text ${isTextOverflow ? 'truncated' : ''}">${textContent}</div>`;
            }

            const nodeStyle = `left: ${node.x}px; top: ${node.y}px;${node.width ? ` width: ${node.width}px;` : ''}${node.height && node.height !== 'auto' ? ` height: ${node.height}px;` : ''}`;

            return `
            <div class="node node-${nodeTypeClass} ${this.selectedNode === node.id ? 'selected' : ''} ${isDisconnected ? 'disconnected' : ''}"
                 data-id="${node.id}"
                 data-node-connectable="true"
                 style="${nodeStyle}">
                <div class="node-header">
                    <span>${icon}</span>
                    ${!node.isStart ? '<button class="delete-btn" data-delete-node="true">🗑️</button>' : ''}
                </div>
                <div class="node-content${node.buttons && node.buttons.length > 0 ? ' has-buttons' : ''}">
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
                <!-- Resize handles только для вправо, вниз и право-низ -->
                <div class="resize-handle resize-handle-s" data-handle="s" title="Изменить размер вниз"></div>
                <div class="resize-handle resize-handle-e" data-handle="e" title="Изменить размер вправо"></div>
                <div class="resize-handle resize-handle-se" data-handle="se" title="Изменить размер по диагонали"></div>
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
                <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse">
                    <polygon points="0 0, 8 4, 0 8" fill="#95a5a6"/>
                </marker>
                <marker id="arrowhead-success" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse">
                    <polygon points="0 0, 8 4, 0 8" fill="#38ef7d"/>
                </marker>
                <marker id="arrowhead-error" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse">
                    <polygon points="0 0, 8 4, 0 8" fill="#e74c3c"/>
                </marker>
                <marker id="arrowhead-selected" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse">
                    <polygon points="0 0, 8 4, 0 8" fill="#3498db"/>
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
                const isSelected = this.selectedConnection === conn.id;
                
                console.log('=== RENDER CONNECTION ===', 'conn.id:', conn.id, 'selectedConnection:', this.selectedConnection, 'isSelected:', isSelected);

                if (isSelected) {
                    stroke = '#3498db';
                    marker = 'url(#arrowhead-selected)';
                } else if (conn.type === 'success') {
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
                if (isSelected) {
                    cssClass += ' selected';
                } else if (conn.type === 'success') {
                    cssClass += ' success';
                } else if (conn.type === 'error') {
                    cssClass += ' error';
                }

                // Add stroke-width variation for better visual distinction
                let strokeWidth = isSelected ? 5 : 3;
                if (conn.type === 'success' && !isSelected) {
                    strokeWidth = 4;
                } else if (conn.type === 'error' && !isSelected) {
                    strokeWidth = 4;
                }

                // НЕ добавляем полупрозрачность для цвета - позволяем CSS управлять этим
                // Убираем inline stroke, чтобы CSS классы работали корректно
                
                svg += `<path class="${cssClass}" data-connection-id="${conn.id}" d="${path}" style="stroke-width: ${strokeWidth}; marker-end: ${marker}; cursor: pointer;" />`;

                // Вычисляем координаты для лейбла, используя ту же логику, что и в calculateConnectionPath
                const fromWidth = fromNode.width || 250;
                const fromHeight = fromNode.height || 150;
                const toWidth = toNode.width || 250;
                const toHeight = toNode.height || 150;

                let label = '';
                let startY = fromNode.y + fromHeight / 2;
                let endY = toNode.y + toHeight / 2;

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
                    if (conn.type === 'success') label = '✅ Success';
                    else if (conn.type === 'error') label = '❌ Error';
                    else if (conn.type === 'true') label = '✓ True';
                    else if (conn.type === 'false') label = '✗ False';
                }

                // Определяем точки начала и конца для лейбла
                let startX, endX;
                const fromRight = fromNode.x + fromWidth;
                const toRight = toNode.x + toWidth;

                if (fromRight < toNode.x) {
                    startX = fromRight;
                    endX = toNode.x;
                } else if (toRight < fromNode.x) {
                    startX = fromNode.x;
                    endX = toRight;
                } else {
                    startX = fromRight;
                    endX = toNode.x;
                }

                if (label) {
                    const midX = (startX + endX) / 2;
                    const midY = (startY + endY) / 2;
                    svg += `<text class="connection-label" x="${midX}" y="${midY}" text-anchor="middle">${this.escapeHtml(label)}</text>`;

                    // Добавляем кнопку удаления на связи (всегда видимая)
                    svg += `<g class="connection-delete-btn" data-connection-id="${conn.id}" style="cursor: pointer;">
                        <circle cx="${midX + 50}" cy="${midY}" r="12" fill="#e74c3c" stroke="white" stroke-width="2"/>
                        <text x="${midX + 50}" y="${midY + 4}" text-anchor="middle" fill="white" font-size="14" font-weight="bold">×</text>
                    </g>`;
                }
            }
        });
        
        if (this.tempConnection) {
            // Рисуем плавную кривую для временной связи
            const midX = (this.tempConnection.startX + this.tempConnection.endX) / 2;
            const path = `M ${this.tempConnection.startX} ${this.tempConnection.startY} C ${midX} ${this.tempConnection.startY}, ${midX} ${this.tempConnection.endY}, ${this.tempConnection.endX} ${this.tempConnection.endY}`;
            svg += `<path class="connection-line temp-connection" d="${path}" style="stroke: #3498db; stroke-width: 4; stroke-dasharray: 8,4; fill: none;" />`;
        }

        // Рисуем опорные точки
        Object.keys(this.controlPoints).forEach(connectionId => {
            const points = this.controlPoints[connectionId];
            points.forEach(cp => {
                svg += `<circle class="control-point" data-connection-id="${connectionId}" data-point-id="${cp.id}" cx="${cp.x}" cy="${cp.y}" r="6" fill="#e67e22" stroke="white" stroke-width="2" style="cursor: move;" />`;
            });
        });

        this.connectionsSvg.innerHTML = svg;
        
        // Добавляем обработчики для кнопок удаления
        this.connectionsSvg.querySelectorAll('.connection-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const connectionId = btn.dataset.connectionId;
                this.deleteConnection(connectionId);
            });
        });

        // Добавляем обработчики для опорных точек
        this.connectionsSvg.querySelectorAll('.control-point').forEach(point => {
            point.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const connectionId = point.dataset.connectionId;
                const pointId = point.dataset.pointId;
                this.draggedControlPoint = { connectionId, pointId };
                this.draggedPointStart = { x: e.clientX, y: e.clientY };
            });
        });
    }
    
    calculateConnectionPath(conn) {
        const fromNode = this.nodes.find(n => n.id === conn.from);
        const toNode = this.nodes.find(n => n.id === conn.to);

        if (!fromNode || !toNode) return null;

        // Получаем размеры узлов
        const fromWidth = fromNode.width || 250;
        const fromHeight = fromNode.height || 150;
        const toWidth = toNode.width || 250;
        const toHeight = toNode.height || 150;

        // Определяем начальную точку на первом узле
        let startY = fromNode.y + fromHeight / 2;
        if (conn.buttonId && fromNode.buttons) {
            const btnIndex = fromNode.buttons.findIndex(b => b.id === conn.buttonId);
            if (btnIndex !== -1) {
                startY = fromNode.y + 70 + (btnIndex * 35);
            }
        }

        // Определяем конечную точку на втором узле
        const endY = toNode.y + toHeight / 2;

        // Определяем, с какой стороны рисовать связь
        let startX, endX;

        // Проверяем относительное положение узлов
        const fromRight = fromNode.x + fromWidth;
        const toRight = toNode.x + toWidth;

        if (fromRight < toNode.x) {
            // Второй узел полностью справа - связь от правого края к левому
            startX = fromRight;
            endX = toNode.x;
        } else if (toRight < fromNode.x) {
            // Второй узел полностью слева - связь от левого края к правому
            startX = fromNode.x;
            endX = toRight;
        } else {
            // Узлы перекрываются по горизонтали - связь от правого края к левому
            startX = fromRight;
            endX = toNode.x;
        }

        // Проверяем, есть ли опорные точки для этой связи
        const controlPoints = this.controlPoints[conn.id] || [];
        if (controlPoints.length > 0) {
            // Рисуем кривую через опорные точки
            let path = `M ${startX} ${startY}`;
            controlPoints.forEach(cp => {
                path += ` L ${cp.x} ${cp.y}`;
            });
            path += ` L ${endX} ${endY}`;
            return path;
        }

        // Простая прямая линия (без опорных точек)
        return `M ${startX} ${startY} L ${endX} ${endY}`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Преобразование Markdown в HTML для отображения в узлах
    markdownToHtml(markdown) {
        if (!markdown) return '';
        
        let html = markdown
            // Экранируем HTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Жирный текст
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.+?)__/g, '<strong>$1</strong>')
            // Курсив
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/_(.+?)_/g, '<em>$1</em>')
            // Зачёркнутый
            .replace(/~~(.+?)~~/g, '<del>$1</del>')
            // Моноширинный код
            .replace(/`(.+?)`/g, '<code>$1</code>')
            // Ссылки
            .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
            // Переносы строк
            .replace(/\n/g, '<br>');
        
        return html;
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
            let response;
            
            if (this.isEditingCommand && this.currentCommandId) {
                // Сохраняем flow команды
                response = await fetch(this.apiUrl(`api/bots/${this.currentBotId}/commands/${this.currentCommandId}/flow`), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(flowData)
                });
                
                if (response.ok) {
                    alert('Flow команды сохранён успешно!');
                } else {
                    alert('Ошибка при сохранении flow команды');
                }
            } else {
                // Сохраняем flow бота
                response = await fetch(this.apiUrl(`api/bots/${this.currentBotId}/flow`), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(flowData)
                });
                
                if (response.ok) {
                    alert('Диалог сохранён успешно!');
                } else {
                    alert('Ошибка при сохранении диалога');
                }
            }
        } catch (error) {
            console.error('Error saving flow:', error);
            alert('Ошибка при сохранении: ' + error.message);
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
    
    // ==========================================================================
    // Методы для работы с пользовательскими командами
    // ==========================================================================
    
    async loadCommands() {
        // Загружает список пользовательских команд для текущего бота
        if (!this.currentBotId) {
            this.renderCommandsList([]);
            return;
        }
        
        try {
            const response = await fetch(this.apiUrl(`api/bots/${this.currentBotId}/commands`));
            const commands = await response.json();
            
            // Добавляем системную команду /start в начало списка
            const startCommand = {
                id: 'start',
                command: '/start',
                description: 'Основной сценарий бота',
                enabled: true,
                isSystem: true // Флаг для системной команды
            };
            
            this.renderCommandsList([startCommand, ...commands]);
        } catch (error) {
            console.error('Error loading commands:', error);
            this.renderCommandsList([]);
        }
    }
    
    renderCommandsList(commands) {
        // Отображает список пользовательских команд.
        const list = document.getElementById('commandsList');
        if (!list) return;
        
        if (commands.length === 0) {
            list.innerHTML = '<p class="text-muted">Нет команд. Создайте первую команду!</p>';
            return;
        }
        
        console.log('=== RENDER COMMANDS LIST ===', 'currentCommandId:', this.currentCommandId, 'suppressCommandsRender:', this.suppressCommandsRender);
        
        list.innerHTML = commands.map(cmd => {
            const isSystem = cmd.isSystem || false;
            // Активная команда: либо текущая выбранная, либо /start если ничего не выбрано
            const isActive = this.currentCommandId === cmd.id || (!this.currentCommandId && cmd.id === 'start');
            
            console.log('=== COMMAND ===', 'cmd.id:', cmd.id, 'isActive:', isActive);
            
            return `
            <div class="command-item ${isActive ? 'active' : ''} ${isSystem ? 'system-command' : ''}" 
                 data-command-id="${cmd.id}" 
                 tabindex="-1"
                 onclick="window.flowEditor.editCommandFlow('${cmd.id}')"
                 onmousedown="window.flowEditor.handleCommandMouseDown(event, '${cmd.id}')">
                <div class="command-header">
                    <strong>${this.escapeHtml(cmd.command)}</strong>
                    ${!isSystem ? `
                        <span class="command-status ${cmd.enabled ? 'enabled' : 'disabled'}">
                            ${cmd.enabled ? '✓' : '✗'}
                        </span>
                    ` : '<span class="system-badge">Система</span>'}
                </div>
                <div class="command-description">${this.escapeHtml(cmd.description || 'Без описания')}</div>
                <div class="command-actions">
                    ${!isSystem ? `
                        <button class="btn btn-small" onclick="event.stopPropagation(); window.flowEditor.editCommand(${cmd.id})" title="Редактировать команду">✏️</button>
                        <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); window.flowEditor.deleteCommand(${cmd.id})" title="Удалить">🗑️</button>
                    ` : ''}
                </div>
            </div>
        `}).join('');
    }
    
    async createCommand(command, description, enabled) {
        // Создаёт новую пользовательскую команду.
        if (!this.currentBotId) {
            alert('Сначала выберите бота');
            return;
        }
        
        try {
            const response = await fetch(this.apiUrl(`api/bots/${this.currentBotId}/commands`), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    command: command,
                    description: description,
                    flow_data: {
                        nodes: [
                            {
                                id: 'start',
                                type: 'menu',
                                x: 100,
                                y: 100,
                                text: `👋 Команда ${command}`,
                                buttons: [
                                    { id: 'start_1', text: 'Начать' }
                                ],
                                isStart: true,
                                format: 'markdown'
                            }
                        ],
                        connections: []
                    },
                    enabled: enabled
                })
            });
            
            if (response.ok) {
                const cmd = await response.json();
                await this.loadCommands();
                return cmd;
            } else {
                const error = await response.json();
                alert('Ошибка при создании команды: ' + (error.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error creating command:', error);
            alert('Ошибка при создании команды: ' + error.message);
        }
    }
    
    async updateCommand(commandId, command, description, enabled) {
        // Обновляет пользовательскую команду.
        try {
            const response = await fetch(this.apiUrl(`api/bots/${this.currentBotId}/commands/${commandId}`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    command: command,
                    description: description,
                    enabled: enabled
                })
            });
            
            if (response.ok) {
                await this.loadCommands();
                return true;
            } else {
                const error = await response.json();
                alert('Ошибка при обновлении команды: ' + (error.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error updating command:', error);
            alert('Ошибка при обновлении команды: ' + error.message);
        }
        return false;
    }
    
    async deleteCommand(commandId) {
        // Удаляет пользовательскую команду.
        if (!confirm('Удалить эту команду?')) {
            return;
        }
        
        try {
            const response = await fetch(this.apiUrl(`api/bots/${this.currentBotId}/commands/${commandId}`), {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Если удаляем текущую команду, выходим из режима редактирования
                if (this.currentCommandId === commandId) {
                    this.currentCommandId = null;
                    this.isEditingCommand = false;
                    this.loadBotFlow(this.currentBotId);
                }
                await this.loadCommands();
            } else {
                alert('Ошибка при удалении команды');
            }
        } catch (error) {
            console.error('Error deleting command:', error);
            alert('Ошибка при удалении команды: ' + error.message);
        }
    }
    
    async editCommand(commandId) {
        // Открывает модальное окно для редактирования команды.
        try {
            const response = await fetch(this.apiUrl(`api/bots/${this.currentBotId}/commands/${commandId}`));
            if (response.ok) {
                const cmd = await response.json();
                this.showCommandModal(cmd);
            } else {
                alert('Ошибка при загрузке команды');
            }
        } catch (error) {
            console.error('Error loading command:', error);
            alert('Ошибка при загрузке команды: ' + error.message);
        }
    }
    
    async editCommandFlow(commandId) {
        // Загружает flow команды для редактирования.
        
        // Устанавливаем флаг, что был клик на команду
        this.commandClicked = true;
        
        // Если это системная команда /start, загружаем основной flow бота
        if (commandId === 'start') {
            this.currentCommandId = null;
            this.isEditingCommand = false;
            this.loadBotFlow(this.currentBotId);
            // Сбрасываем флаг после короткой задержки
            setTimeout(() => { this.commandClicked = false; }, 100);
            return;
        }
        
        try {
            const response = await fetch(this.apiUrl(`api/bots/${this.currentBotId}/commands/${commandId}/flow`));
            if (response.ok) {
                const flowData = await response.json();
                this.currentCommandId = commandId;
                this.isEditingCommand = true;
                this.nodes = flowData.nodes || [];
                this.connections = flowData.connections || [];
                this.maxNodeId();
                this.render();
                this.loadCommands(); // Обновляем список для подсветки активной команды
                // Сбрасываем флаг после короткой задержки
                setTimeout(() => { this.commandClicked = false; }, 100);
            } else {
                alert('Ошибка при загрузке flow команды');
            }
        } catch (error) {
            console.error('Error loading command flow:', error);
            alert('Ошибка при загрузке flow команды: ' + error.message);
        }
    }
    
    handleCommandMouseDown(event, commandId) {
        // Обрабатывает нажатие мыши на команду для предотвращения случайного снятия фокуса
        console.log('=== COMMAND MOUSE DOWN ===', 'commandId:', commandId);
        this.commandClicked = true;
        
        // Предотвращаем всплытие события, чтобы оно не достигло канваса
        if (event) {
            event.stopPropagation();
        }
        
        // Сбрасываем флаг после короткой задержки
        setTimeout(() => { this.commandClicked = false; }, 100);
    }
    
    async saveCommandFlow() {
        // Сохраняет flow текущей команды.
        if (!this.currentCommandId || !this.isEditingCommand) {
            alert('Не выбрана команда для редактирования');
            return;
        }
        
        const flowData = {
            nodes: this.nodes,
            connections: this.connections
        };
        
        try {
            const response = await fetch(this.apiUrl(`api/bots/${this.currentBotId}/commands/${this.currentCommandId}/flow`), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(flowData)
            });
            
            if (response.ok) {
                alert('Flow команды сохранён успешно!');
            } else {
                const error = await response.json();
                alert('Ошибка при сохранении: ' + (error.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error saving command flow:', error);
            alert('Ошибка при сохранении: ' + error.message);
        }
    }
    
    showCommandModal(command = null) {
        // Показывает модальное окно для создания/редактирования команды.
        const modal = document.getElementById('commandModal');
        const title = document.getElementById('commandModalTitle');
        const nameInput = document.getElementById('commandName');
        const descInput = document.getElementById('commandDescription');
        const enabledInput = document.getElementById('commandEnabled');
        
        if (command) {
            title.textContent = '✏️ Редактировать команду';
            nameInput.value = command.command;
            descInput.value = command.description || '';
            enabledInput.checked = command.enabled;
            modal.dataset.commandId = command.id;
        } else {
            title.textContent = '📝 Новая команда';
            nameInput.value = '';
            descInput.value = '';
            enabledInput.checked = true;
            delete modal.dataset.commandId;
        }
        
        modal.style.display = 'block';
    }
    
    escapeHtml(text) {
        // Экранирует HTML символы.
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Глобальные функции для работы с командами
function showCreateCommandModal() {
    if (window.flowEditor) {
        window.flowEditor.showCommandModal();
    }
}

function closeCommandModal() {
    const modal = document.getElementById('commandModal');
    modal.style.display = 'none';
}

function saveCommandModal() {
    const modal = document.getElementById('commandModal');
    const nameInput = document.getElementById('commandName');
    const descInput = document.getElementById('commandDescription');
    const enabledInput = document.getElementById('commandEnabled');
    
    const command = nameInput.value.trim();
    const description = descInput.value.trim();
    const enabled = enabledInput.checked;
    
    if (!command) {
        alert('Введите название команды');
        return;
    }
    
    if (!command.startsWith('/')) {
        alert('Название команды должно начинаться с /');
        return;
    }
    
    if (modal.dataset.commandId) {
        // Редактирование существующей команды
        const commandId = parseInt(modal.dataset.commandId);
        window.flowEditor.updateCommand(commandId, command, description, enabled);
    } else {
        // Создание новой команды
        window.flowEditor.createCommand(command, description, enabled);
    }
    
    closeCommandModal();
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

function zoomIn() {
    if (flowEditor) {
        flowEditor.zoomIn();
    }
}

function zoomOut() {
    if (flowEditor) {
        flowEditor.zoomOut();
    }
}

function zoomReset() {
    if (flowEditor) {
        flowEditor.zoomReset();
    }
}

let flowEditor;
document.addEventListener('DOMContentLoaded', () => {
    console.log('=== DOM CONTENT LOADED ===');
    flowEditor = new FlowEditor();
    console.log('=== FLOW EDITOR CREATED ===');
    
    // Делаем flowEditor доступным глобально для тестов
    window.flowEditor = flowEditor;

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
            background: rgba(44, 62, 80, 0.98);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 13px;
            z-index: 999999;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
            white-space: normal;
            line-height: 1.5;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            pointer-events: none;
        `;
        document.body.appendChild(tooltip);
    }

    let activeTooltipIcon = null;

    // Add click event to all tooltip icons
    document.addEventListener('click', function(e) {
        const tooltipIcon = e.target.closest('.tooltip-icon');
        
        if (tooltipIcon) {
            e.preventDefault();
            e.stopPropagation();
            
            const text = tooltipIcon.getAttribute('data-tooltip');
            if (text) {
                // Если кликнули на ту же иконку — скрываем tooltip
                if (activeTooltipIcon === tooltipIcon) {
                    hideTooltip();
                    return;
                }
                
                // Убираем активный класс с предыдущей иконки
                if (activeTooltipIcon) {
                    activeTooltipIcon.classList.remove('active');
                }
                
                // Показываем tooltip рядом с иконкой
                showTooltip(tooltipIcon, text);
                activeTooltipIcon = tooltipIcon;
                tooltipIcon.classList.add('active');
            }
        } else if (!e.target.closest('.custom-tooltip')) {
            // Скрываем tooltip при клике вне его
            hideTooltip();
        }
    });

    function showTooltip(icon, text) {
        tooltip.textContent = text;
        tooltip.style.opacity = '1';
        tooltip.style.visibility = 'visible';
        
        // Сначала показываем tooltip, чтобы получить его размеры
        tooltip.style.display = 'block';
        
        // Позиционируем tooltip слева от иконки
        const iconRect = icon.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Показываем слева от иконки
        let left = iconRect.left - tooltipRect.width - 10;
        let top = iconRect.top;
        
        // Проверяем, не уходит ли за левый край
        if (left < 10) {
            left = 10;
        }
        
        // Проверяем, не уходит ли за нижний край
        if (top + tooltipRect.height > window.innerHeight - 20) {
            top = window.innerHeight - tooltipRect.height - 20;
        }
        
        // Проверяем, не уходит ли за верхний край
        if (top < 10) {
            top = 10;
        }
        
        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
        tooltip.style.display = 'block';
    }

    function hideTooltip() {
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
        tooltip.style.display = 'none';
        
        // Убираем активный класс с иконки
        if (activeTooltipIcon) {
            activeTooltipIcon.classList.remove('active');
            activeTooltipIcon = null;
        }
    }

    // Скрываем tooltip при ресайзе окна
    window.addEventListener('resize', hideTooltip);
    
    // Скрываем tooltip при скролле
    window.addEventListener('scroll', hideTooltip, true);
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

    // Toggle visibility of the debug div
    if (debugDiv.style.display === 'block') {
        debugDiv.style.display = 'none';
    } else {
        debugDiv.style.display = 'block';
        updateDebugInfo();
    }
}

// Function to update debug information
function updateDebugInfo() {
    const debugDiv = document.getElementById('debug-info');
    if (!debugDiv || debugDiv.style.display === 'none') return;

    if (typeof flowEditor !== 'undefined') {
        const validation = flowEditor.validateConnectivityOriginal();

        let debugContent = `
            <h4 style="margin:0 0 10px 0; color: red;">DEBUG INFO</h4>

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
            <h4 style="margin:0 0 5px 0; color: red;">DEBUG INFO</h4>
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

    // Add debug label
    const debugLabel = document.createElement('span');
    debugLabel.textContent = 'DEBUG';
    debugLabel.style.cssText = `
        margin-right: 8px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        color: #666;
        font-weight: normal;
    `;

    // Assemble the elements
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

// ========== Markdown Editor Functions ==========

// Открыть Markdown редактор
function openMarkdownEditor(nodeId) {
    const modal = document.getElementById('markdownEditorModal');
    const editorContent = document.getElementById('markdownEditorContent');
    const preview = document.getElementById('markdownPreview');
    
    if (!modal || !editorContent) {
        console.error('Markdown editor elements not found');
        return;
    }
    
    // Получить текущий текст узла
    const node = flowEditor.nodes.find(n => n.id === nodeId);
    if (!node) {
        console.error('Node not found:', nodeId);
        return;
    }
    
    flowEditor.currentEditingNodeId = nodeId;
    
    // Установить содержимое редактора
    editorContent.value = node.text || '';
    
    // Обновить предпросмотр
    updateMarkdownPreview();
    
    // Инициализировать счётчик символов
    updateMarkdownCharCounter();
    
    // Показать модальное окно
    modal.classList.add('show');
    
    // Фокус на редакторе
    setTimeout(() => {
        editorContent.focus();
    }, 100);
}

// Закрыть Markdown редактор
function closeMarkdownEditor() {
    const modal = document.getElementById('markdownEditorModal');
    if (modal) {
        modal.classList.remove('show');
    }
    flowEditor.currentEditingNodeId = null;
}

// Сохранить содержимое Markdown редактора
function saveMarkdownEditor() {
    const editorContent = document.getElementById('markdownEditorContent');
    
    if (!editorContent) {
        console.error('Editor element not found');
        return;
    }
    
    // Получить Markdown содержимое
    const markdownContent = editorContent.value;
    
    // Обновить текст узла
    if (flowEditor.currentEditingNodeId) {
        flowEditor.updateNode(flowEditor.currentEditingNodeId, { 
            text: markdownContent,
            format: 'markdown'
        });
        
        // Обновить textarea в свойствах узла
        const nodeText = document.getElementById('nodeText');
        if (nodeText) {
            nodeText.value = markdownContent;
        }
    }
    
    // Закрыть редактор
    closeMarkdownEditor();
}

// Вставить Markdown разметку
function insertMarkdown(type) {
    const editor = document.getElementById('markdownEditorContent');
    if (!editor) return;
    
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    let insertion = '';
    let cursorOffset = 0;
    
    switch(type) {
        case 'bold':
            insertion = `**${selectedText || 'жирный текст'}**`;
            cursorOffset = selectedText ? insertion.length : 2;
            break;
        case 'italic':
            insertion = `*${selectedText || 'курсив'}*`;
            cursorOffset = selectedText ? insertion.length : 1;
            break;
        case 'strikethrough':
            insertion = `~~${selectedText || 'зачёркнутый'}~~`;
            cursorOffset = selectedText ? insertion.length : 2;
            break;
        case 'code':
            insertion = `\`${selectedText || 'код'}\``;
            cursorOffset = selectedText ? insertion.length : 1;
            break;
        case 'link':
            const url = prompt('Введите URL ссылки:');
            if (url) {
                insertion = `[${selectedText || 'текст ссылки'}](${url})`;
                cursorOffset = selectedText ? insertion.length : 1;
            } else {
                return;
            }
            break;
        case 'ul':
            insertion = `\n- ${selectedText || 'элемент списка'}`;
            cursorOffset = insertion.length;
            break;
        case 'ol':
            insertion = `\n1. ${selectedText || 'элемент списка'}`;
            cursorOffset = insertion.length;
            break;
    }
    
    const newValue = editor.value.substring(0, start) + insertion + editor.value.substring(end);
    editor.value = newValue;
    
    // Установить позицию курсора
    const newCursorPos = start + cursorOffset;
    editor.setSelectionRange(newCursorPos, newCursorPos);
    
    editor.focus();
    updateMarkdownPreview();
    updateMarkdownCharCounter();
}

// Простая функция для преобразования Markdown в HTML для предпросмотра
function markdownToHtml(markdown) {
    if (!markdown) return '';
    
    let html = markdown
        // Экранируем HTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Жирный текст
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        // Курсив
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Зачёркнутый
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        // Моноширинный код
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // Ссылки
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
        // Маркированные списки
        .replace(/^\- (.+)$/gm, '<li>$1</li>')
        // Нумерованные списки
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Переносы строк
        .replace(/\n/g, '<br>');
    
    // Обернуть списки в ul/ol
    html = html.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/<\/ul><br><ul>/g, '');
    
    return html;
}

// Обновить предпросмотр Markdown
function updateMarkdownPreview() {
    const editor = document.getElementById('markdownEditorContent');
    const preview = document.getElementById('markdownPreview');
    
    if (!editor || !preview) return;
    
    const markdown = editor.value;
    preview.innerHTML = markdownToHtml(markdown);
}

// Обновить счётчик символов для Markdown
function updateMarkdownCharCounter() {
    const editor = document.getElementById('markdownEditorContent');
    const charCount = document.getElementById('charCount');
    const charLimitWarning = document.getElementById('charLimitWarning');
    const counterContainer = document.querySelector('.editor-char-counter');
    
    if (!charCount || !charLimitWarning || !counterContainer || !editor) {
        return;
    }
    
    const currentLength = editor.value.length;
    charCount.textContent = currentLength;
    
    // Обновить стили в зависимости от количества символов
    counterContainer.classList.remove('warning', 'error');
    
    if (currentLength > MAX_CHAR_LIMIT) {
        counterContainer.classList.add('error');
        charLimitWarning.style.display = 'inline';
    } else if (currentLength > MAX_CHAR_LIMIT * 0.9) {
        counterContainer.classList.add('warning');
        charLimitWarning.style.display = 'none';
    } else {
        charLimitWarning.style.display = 'none';
    }
}

const MAX_CHAR_LIMIT = 4000;

// Обработчик событий для Markdown редактора
document.addEventListener('DOMContentLoaded', () => {
    const editorContent = document.getElementById('markdownEditorContent');
    
    if (editorContent) {
        // Обновлять предпросмотр и счётчик символов при изменении содержимого
        editorContent.addEventListener('input', () => {
            // Проверить лимит символов
            if (editorContent.value.length > MAX_CHAR_LIMIT) {
                editorContent.value = editorContent.value.substring(0, MAX_CHAR_LIMIT);
            }
            updateMarkdownPreview();
            updateMarkdownCharCounter();
        });
        
        // Обработка клавиш в Markdown редакторе
        editorContent.addEventListener('keydown', (e) => {
            // Проверить лимит перед вводом (кроме специальных клавиш)
            if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
                if (editorContent.value.length >= MAX_CHAR_LIMIT) {
                    e.preventDefault();
                    return;
                }
            }
            
            // Tab для вставки табуляции (вместо перехода фокуса)
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editorContent.selectionStart;
                const end = editorContent.selectionEnd;
                const newValue = editorContent.value.substring(0, start) + '    ' + editorContent.value.substring(end);
                
                if (newValue.length <= MAX_CHAR_LIMIT) {
                    editorContent.value = newValue;
                    editorContent.selectionStart = editorContent.selectionEnd = start + 4;
                    updateMarkdownPreview();
                    updateMarkdownCharCounter();
                }
            }
            
            // Ctrl+Enter для сохранения
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                saveMarkdownEditor();
            }
            // Esc для закрытия
            if (e.key === 'Escape') {
                e.preventDefault();
                closeMarkdownEditor();
            }
        });
    }
});

// Глобальная функция для удаления выделенной связи
function deleteSelectedConnection() {
    console.log('=== DELETE SELECTED CONNECTION ===');
    if (window.flowEditor && window.flowEditor.selectedConnection) {
        window.flowEditor.deleteConnection(window.flowEditor.selectedConnection);
        // Скрываем контекстное меню после удаления
        const menu = document.getElementById('connectionContextMenu');
        if (menu) {
            menu.style.display = 'none';
            menu.style.visibility = 'hidden';
        }
    }
}

// Глобальная функция для добавления опорной точки
function addControlPoint() {
    console.log('=== ADD CONTROL POINT ===');
    if (window.flowEditor && window.flowEditor.selectedConnection) {
        window.flowEditor.addControlPointToConnection(window.flowEditor.selectedConnection);
        // Скрываем контекстное меню после добавления
        const menu = document.getElementById('connectionContextMenu');
        if (menu) {
            menu.style.display = 'none';
            menu.style.visibility = 'hidden';
        }
    }
}