let bots = [];
let currentLogsBotId = null;

// Helper function to build API URL with base path
function apiUrl(path) {
    const baseUrl = window.API_BASE_URL || '';
    return baseUrl + '/' + path.replace(/^\/+/, '');
}

async function loadBots() {
    try {
        const response = await fetch(apiUrl('api/bots'));
        bots = await response.json();
        renderBots();
    } catch (error) {
        console.error('Error loading bots:', error);
    }
}

function renderBots() {
    const container = document.getElementById('botsList');
    
    if (bots.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-info">
                    <h5>Нет ботов</h5>
                    <p>Создайте своего первого бота, нажав кнопку "Создать бота"</p>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = bots.map(bot => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="card bot-card ${bot.status}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">${escapeHtml(bot.name)}</h5>
                    <span class="status-badge ${bot.status}">${bot.status === 'running' ? 'Запущен' : 'Остановлен'}</span>
                </div>
                <div class="card-body">
                    <div class="mb-2">
                        <small class="text-muted">Токен:</small>
                        <div class="token-field">${escapeHtml(bot.token.substring(0, 20))}...</div>
                    </div>
                    <div class="mb-2">
                        <small class="text-muted">Base URL:</small>
                        <div class="text-break">${escapeHtml(bot.base_url)}</div>
                    </div>
                    <div class="mb-2">
                        <small class="text-muted">Создан:</small>
                        <div>${formatDate(bot.created_at)}</div>
                    </div>
                </div>
                <div class="card-footer">
                    <div class="btn-group btn-group-sm w-100">
                        ${bot.status === 'running'
                            ? `<button class="btn btn-warning" onclick="stopBot(${bot.id})">Остановить</button>`
                            : `<button class="btn btn-success" onclick="startBot(${bot.id})">Запустить</button>`
                        }
                        <button class="btn btn-info" onclick="restartBot(${bot.id})">Перезапуск</button>
                        <a href="${apiUrl('flow-editor')}?botId=${bot.id}" class="btn btn-secondary">🎨 Диалог</a>
                        <button class="btn btn-dark" onclick="openLogsModal(${bot.id})">📋 Логи</button>
                        <button class="btn btn-primary" onclick="openEditModal(${bot.id})">Настройки</button>
                        <button class="btn btn-danger" onclick="deleteBot(${bot.id})">Удалить</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

async function createBot() {
    const name = document.getElementById('botName').value.trim();
    const token = document.getElementById('botToken').value.trim();
    const base_url = document.getElementById('botBaseUrl').value.trim();

    if (!name || !token) {
        alert('Пожалуйста, заполните название и токен');
        return;
    }

    try {
        const response = await fetch(apiUrl('api/bots'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                token,
                base_url,
                start_message: '',
                menu_config: []
            })
        });
        
        if (response.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('createBotModal'));
            modal.hide();
            document.getElementById('createBotForm').reset();
            await loadBots();
        } else {
            alert('Ошибка при создании бота');
        }
    } catch (error) {
        console.error('Error creating bot:', error);
        alert('Ошибка при создании бота');
    }
}

async function startBot(botId) {
    try {
        const response = await fetch(apiUrl(`api/bots/${botId}/start`), { method: 'POST' });
        if (response.ok) {
            await loadBots();
        } else {
            alert('Ошибка при запуске бота');
        }
    } catch (error) {
        console.error('Error starting bot:', error);
        alert('Ошибка при запуске бота');
    }
}

async function stopBot(botId) {
    try {
        const response = await fetch(apiUrl(`api/bots/${botId}/stop`), { method: 'POST' });
        if (response.ok) {
            await loadBots();
        } else {
            alert('Ошибка при остановке бота');
        }
    } catch (error) {
        console.error('Error stopping bot:', error);
        alert('Ошибка при остановке бота');
    }
}

async function restartBot(botId) {
    try {
        const response = await fetch(apiUrl(`api/bots/${botId}/restart`), { method: 'POST' });
        if (response.ok) {
            await loadBots();
        } else {
            alert('Ошибка при перезапуске бота');
        }
    } catch (error) {
        console.error('Error restarting bot:', error);
        alert('Ошибка при перезапуске бота');
    }
}

async function deleteBot(botId) {
    if (!confirm('Вы уверены, что хотите удалить этого бота?')) {
        return;
    }

    try {
        const response = await fetch(apiUrl(`api/bots/${botId}`), { method: 'DELETE' });
        if (response.ok) {
            await loadBots();
        } else {
            alert('Ошибка при удалении бота');
        }
    } catch (error) {
        console.error('Error deleting bot:', error);
        alert('Ошибка при удалении бота');
    }
}

function openEditModal(botId) {
    const bot = bots.find(b => b.id === botId);
    if (!bot) return;
    
    document.getElementById('editBotId').value = bot.id;
    document.getElementById('editBotName').value = bot.name;
    
    // Маскируем токен - показываем только первые 8 символов
    const tokenInput = document.getElementById('editBotToken');
    tokenInput.value = bot.token.substring(0, 8) + '••••••••••••••••';
    tokenInput.dataset.fullToken = bot.token; // Сохраняем полный токен в data-атрибуте
    tokenInput.dataset.isMasked = 'true'; // Флаг, что токен замаскирован
    
    document.getElementById('editBotBaseUrl').value = bot.base_url;
    document.getElementById('editBotStartMessage').value = bot.start_message || '';
    document.getElementById('editBotMenuConfig').value = JSON.stringify(bot.menu_config || [], null, 2);
    
    // Сбрасываем кнопку показа токена
    const toggleBtn = document.getElementById('toggleTokenBtn');
    toggleBtn.textContent = '👁️ Показать';
    
    const modal = new bootstrap.Modal(document.getElementById('editBotModal'));
    modal.show();
}

function toggleTokenVisibility() {
    const tokenInput = document.getElementById('editBotToken');
    const toggleBtn = document.getElementById('toggleTokenBtn');
    const isMasked = tokenInput.dataset.isMasked === 'true';
    
    if (isMasked) {
        // Показываем полный токен
        tokenInput.value = tokenInput.dataset.fullToken;
        tokenInput.dataset.isMasked = 'false';
        toggleBtn.textContent = '🙈 Скрыть';
    } else {
        // Скрываем токен
        const fullToken = tokenInput.dataset.fullToken || tokenInput.value;
        tokenInput.value = fullToken.substring(0, 8) + '••••••••••••••••';
        tokenInput.dataset.isMasked = 'true';
        toggleBtn.textContent = '👁️ Показать';
    }
}

let logsAutoRefreshInterval = null;
let logsModalListenerAdded = false; // Флаг для отслеживания добавления listener

function openLogsModal(botId) {
    const bot = bots.find(b => b.id === botId);
    if (!bot) return;

    currentLogsBotId = botId;
    document.getElementById('logsBotName').textContent = bot.name;

    // Добавляем event listener только один раз при первом открытии
    if (!logsModalListenerAdded) {
        const logsModal = document.getElementById('logsModal');
        logsModal.addEventListener('hidden.bs.modal', () => {
            console.log('Stopping auto-refresh');
            if (logsAutoRefreshInterval) {
                clearInterval(logsAutoRefreshInterval);
                logsAutoRefreshInterval = null;
            }
            currentLogsBotId = null;
        });
        logsModalListenerAdded = true;
    }

    const modal = new bootstrap.Modal(document.getElementById('logsModal'));
    modal.show();

    loadLogsForBot(botId);

    // Очищаем старый интервал если есть
    if (logsAutoRefreshInterval) {
        clearInterval(logsAutoRefreshInterval);
    }

    console.log('Starting auto-refresh for bot', botId);
    // Автообновление логов каждые 2 секунды
    logsAutoRefreshInterval = setInterval(() => {
        console.log('Auto-refreshing logs...');
        if (currentLogsBotId) {
            loadLogsForBot(currentLogsBotId);
        }
    }, 2000);
}

async function updateBot() {
    const botId = parseInt(document.getElementById('editBotId').value);
    const name = document.getElementById('editBotName').value.trim();
    const tokenInput = document.getElementById('editBotToken');
    let token = tokenInput.value.trim();
    const base_url = document.getElementById('editBotBaseUrl').value.trim();
    const start_message = document.getElementById('editBotStartMessage').value.trim();
    const menu_config_str = document.getElementById('editBotMenuConfig').value.trim();
    
    if (!name || !token) {
        alert('Пожалуйста, заполните название и токен');
        return;
    }
    
    // Если токен замаскирован (содержит маскирующие символы), используем полный токен из data-атрибута
    if (token.includes('•••') && tokenInput.dataset.fullToken) {
        token = tokenInput.dataset.fullToken;
    }
    
    let menu_config = [];
    if (menu_config_str) {
        try {
            menu_config = JSON.parse(menu_config_str);
        } catch (e) {
            alert('Ошибка в формате JSON для меню');
            return;
        }
    }
    
    try {
        const response = await fetch(apiUrl(`api/bots/${botId}`), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                token,
                base_url,
                start_message,
                menu_config
            })
        });
        
        if (response.ok) {
            const modal = bootstrap.Modal.getInstance(document.getElementById('editBotModal'));
            modal.hide();
            await loadBots();
        } else {
            alert('Ошибка при обновлении бота');
        }
    } catch (error) {
        console.error('Error updating bot:', error);
        alert('Ошибка при обновлении бота');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU');
}

async function loadLogsForBot(botId) {
    const container = document.getElementById('logsList');
    
    if (!botId) {
        container.innerHTML = '<div class="alert alert-info">Выберите бота для просмотра логов</div>';
        return;
    }
    
    try {
        const response = await fetch(apiUrl(`api/bots/${botId}/logs?limit=200&_t=${Date.now()}`), {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        const logs = await response.json();
        
        console.log('Logs loaded:', logs.length, 'logs');
        
        if (logs.length === 0) {
            container.innerHTML = '<div class="alert alert-warning">Нет логов для этого бота</div>';
            return;
        }
        
        container.innerHTML = logs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleString('ru-RU', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            return `<div class="log-line">${timestamp} [${log.level}] ${escapeHtml(log.message)}</div>`;
        }).join('');
    } catch (error) {
        console.error('Error loading logs:', error);
        container.innerHTML = '<div class="alert alert-danger">Ошибка при загрузке логов</div>';
    }
}

async function clearCurrentBotLogs() {
    if (!currentLogsBotId) {
        alert('Нет выбранного бота');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите очистить все логи этого бота?')) {
        return;
    }
    
    try {
        const response = await fetch(apiUrl(`api/bots/${currentLogsBotId}/logs`), { method: 'DELETE' });
        if (response.ok) {
            document.getElementById('logsList').innerHTML = '<div class="alert alert-success">Логи очищены</div>';
        } else {
            alert('Ошибка при очистке логов');
        }
    } catch (error) {
        console.error('Error clearing logs:', error);
        alert('Ошибка при очистке логов');
    }
}

document.addEventListener('DOMContentLoaded', loadBots);