# MCP Selenium - Patched Version

## Что было исправлено

### Проблема
MCP Selenium постоянно перезапускался из-за необработанных ошибок и исключений, которые вызывали падение процесса.

### Решение
Добавлена обработка необработанных ошибок и исключений в [`server.js`](server.js):

```javascript
// Prevent crashes from unhandled errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit - let MCP client handle the error
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - let MCP client handle the error
});
```

## Установка

### 1. Создать символическую ссылку на node_modules
```bash
ln -s /data/data/com.termux/files/usr/lib/node_modules/@angiejones/mcp-selenium/node_modules ~/.local/share/mcp-selenium-patched/node_modules
```

### 2. Обновить конфигурацию MCP
В [`~/.config/kilocode/mcp_config.json`](../../.config/kilocode/mcp_config.json):

```json
{
  "mcpServers": {
    "selenium": {
      "command": "node",
      "args": [
        "/data/data/com.termux/files/home/.local/share/mcp-selenium-patched/server.js"
      ],
      "env": {
        "CHROME_PATH": "/data/data/com.termux/files/usr/bin/chromium-browser",
        "CHROMEDRIVER_PATH": "/data/data/com.termux/files/usr/bin/chromedriver",
        "SELENIUM_HEADLESS": "true"
      }
    }
  }
}
```

## Проверка работы

```bash
export CHROME_PATH=/data/data/com.termux/files/usr/bin/chromium-browser
export CHROMEDRIVER_PATH=/data/data/com.termux/files/usr/bin/chromedriver
export SELENIUM_HEADLESS=true

(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'; echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'; sleep 1) | timeout 2 node ~/.local/share/mcp-selenium-patched/server.js
```

Ожидаемый результат: JSON-ответ с информацией о сервере и списком инструментов.

## Дополнительные изменения

### Termux-специфичные настройки
В [`server.js`](server.js) уже содержатся обязательные аргументы для Chrome в Termux:
- `--no-sandbox`
- `--disable-gpu`
- `--disable-dev-shm-usage`
- `--headless=new`

Эти настройки игнорируют передаваемые параметры для обеспечения стабильной работы в окружении Termux.
