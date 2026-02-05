#!/bin/bash
# Скрипт для проверки работы MCP Selenium

echo "=== Проверка MCP Selenium ==="
echo "Время: $(date)"
echo ""

# Проверка конфигурации
echo "1. Проверка конфигурации MCP:"
cat ~/.config/kilocode/mcp_config.json
echo ""

# Проверка файлов
echo "2. Проверка файлов:"
ls -la ~/.local/share/mcp-selenium-patched/
echo ""

# Проверка символической ссылки
echo "3. Проверка символической ссылки на node_modules:"
ls -la ~/.local/share/mcp-selenium-patched/node_modules
echo ""

# Проверка работы сервера
echo "4. Проверка работы сервера:"
export CHROME_PATH=/data/data/com.termux/files/usr/bin/chromium-browser
export CHROMEDRIVER_PATH=/data/data/com.termux/files/usr/bin/chromedriver
export SELENIUM_HEADLESS=true

(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'; echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'; echo '{"jsonrpc":"2.0","method":"exit"}') | timeout 3 node ~/.local/share/mcp-selenium-patched/server.js 2>&1 | head -5

echo ""
echo "=== Проверка завершена ==="
