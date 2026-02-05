#!/bin/bash
# Полная проверка MCP Selenium с тестированием всех функций

echo "=== Полная проверка MCP Selenium ==="
echo "Время: $(date)"
echo ""

# Настройка окружения
export CHROME_PATH=/data/data/com.termux/files/usr/bin/chromium-browser
export CHROMEDRIVER_PATH=/data/data/com.termux/files/usr/bin/chromedriver
export SELENIUM_HEADLESS=true

echo "1. Проверка инициализации MCP сервера..."
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | timeout 2 node ~/.local/share/mcp-selenium-patched/server.js 2>&1 | head -1
echo ""

echo "2. Проверка списка инструментов (tools/list)..."
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | timeout 2 node ~/.local/share/mcp-selenium-patched/server.js 2>&1 | head -1
echo ""

echo "3. Проверка запуска браузера (start_browser)..."
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"start_browser","arguments":{"browser":"chrome","options":{"headless":true}}}}' | timeout 10 node ~/.local/share/mcp-selenium-patched/server.js 2>&1 | head -1
echo ""

echo "4. Проверка навигации (navigate)..."
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"navigate","arguments":{"url":"https://example.com"}}}' | timeout 10 node ~/.local/share/mcp-selenium-patched/server.js 2>&1 | head -1
echo ""

echo "5. Проверка поиска элемента (find_element)..."
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"find_element","arguments":{"by":"css","value":"h1"}}}' | timeout 10 node ~/.local/share/mcp-selenium-patched/server.js 2>&1 | head -1
echo ""

echo "6. Проверка получения текста элемента (get_element_text)..."
echo '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"get_element_text","arguments":{"by":"css","value":"h1"}}}' | timeout 10 node ~/.local/share/mcp-selenium-patched/server.js 2>&1 | head -1
echo ""

echo "7. Проверка создания скриншота (take_screenshot)..."
echo '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"take_screenshot","arguments":{"outputPath":"/tmp/test_screenshot.png"}}}' | timeout 10 node ~/.local/share/mcp-selenium-patched/server.js 2>&1 | head -1
echo ""

echo "8. Проверка закрытия сессии (close_session)..."
echo '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"close_session","arguments":{}}}' | timeout 5 node ~/.local/share/mcp-selenium-patched/server.js 2>&1 | head -1
echo ""

echo "9. Проверка ресурсов (resources/list)..."
echo '{"jsonrpc":"2.0","id":9,"method":"resources/list"}' | timeout 2 node ~/.local/share/mcp-selenium-patched/server.js 2>&1 | head -1
echo ""

echo "10. Проверка чтения ресурса (resources/read)..."
echo '{"jsonrpc":"2.0","id":10,"method":"resources/read","params":{"uri":"browser-status://current"}}' | timeout 2 node ~/.local/share/mcp-selenium-patched/server.js 2>&1 | head -1
echo ""

echo "=== Проверка завершена ==="
