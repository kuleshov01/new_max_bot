#!/usr/bin/env python3
"""
Реальный тест MCP Selenium - проверка Flask приложения
"""

import subprocess
import json
import time

def mcp_call(method, params=None):
    """Вызов MCP метода"""
    request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method
    }
    if params:
        request["params"] = params

    env = {
        "CHROME_PATH": "/data/data/com.termux/files/usr/bin/chromium-browser",
        "CHROMEDRIVER_PATH": "/data/data/com.termux/files/usr/bin/chromedriver",
        "SELENIUM_HEADLESS": "true"
    }

    cmd = [
        "node",
        "/data/data/com.termux/files/home/.local/share/mcp-selenium-patched/server.js"
    ]

    proc = subprocess.Popen(
        cmd,
        env={**subprocess.os.environ, **env},
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    request_json = json.dumps(request) + "\n"
    stdout, stderr = proc.communicate(request_json.encode(), timeout=10)

    if stdout:
        try:
            response = json.loads(stdout.decode().strip().split('\n')[0])
            return response
        except:
            print(f"Ошибка парсинга JSON: {stdout.decode()}")
            return None
    return None

print("=== Реальный тест MCP Selenium ===")
print()

# 1. Инициализация
print("1. Инициализация MCP...")
result = mcp_call("initialize", {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "test", "version": "1.0"}
})
if result and "result" in result:
    print("✅ Инициализация успешна")
else:
    print("❌ Ошибка инициализации")
print()

# 2. Запуск браузера
print("2. Запуск браузера...")
result = mcp_call("tools/call", {
    "name": "start_browser",
    "arguments": {
        "browser": "chrome",
        "options": {"headless": True}
    }
})
if result and "result" in result:
    print(f"✅ Браузер запущен: {result['result']}")
else:
    print(f"❌ Ошибка запуска браузера: {result}")
print()

# 3. Навигация на страницу
print("3. Навигация на http://localhost:5000/manage...")
result = mcp_call("tools/call", {
    "name": "navigate",
    "arguments": {
        "url": "http://localhost:5000/manage"
    }
})
if result and "result" in result:
    print(f"✅ Навигация успешна: {result['result']}")
else:
    print(f"❌ Ошибка навигации: {result}")
print()

# 4. Поиск заголовка
print("4. Поиск заголовка H1...")
result = mcp_call("tools/call", {
    "name": "find_element",
    "arguments": {
        "by": "css",
        "value": "h1"
    }
})
if result and "result" in result:
    print(f"✅ Заголовок найден: {result['result']}")
else:
    print(f"❌ Ошибка поиска: {result}")
print()

# 5. Получение текста заголовка
print("5. Получение текста заголовка...")
result = mcp_call("tools/call", {
    "name": "get_element_text",
    "arguments": {
        "by": "css",
        "value": "h1"
    }
})
if result and "result" in result:
    print(f"✅ Текст заголовка: {result['result']}")
else:
    print(f"❌ Ошибка получения текста: {result}")
print()

# 6. Создание скриншота
print("6. Создание скриншота...")
result = mcp_call("tools/call", {
    "name": "take_screenshot",
    "arguments": {
        "outputPath": "/sdcard/Project/new_max_bot/screenshot_test.png"
    }
})
if result and "result" in result:
    print(f"✅ Скриншот создан: {result['result']}")
else:
    print(f"❌ Ошибка создания скриншота: {result}")
print()

# 7. Закрытие сессии
print("7. Закрытие сессии...")
result = mcp_call("tools/call", {
    "name": "close_session",
    "arguments": {}
})
if result and "result" in result:
    print(f"✅ Сессия закрыта: {result['result']}")
else:
    print(f"❌ Ошибка закрытия сессии: {result}")
print()

print("=== Тест завершен ===")
