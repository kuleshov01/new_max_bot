# Руководство разработчика Max Bot

## Архитектура проекта

```
new_max_bot/
├── bot.py          # Основной файл с логикой бота
├── config.py       # Конфигурация (токен, URL API)
└── README.md       # Документация проекта
```

## Технологический стек

- **Python 3.7+** - основной язык разработки
- **requests** - библиотека для HTTP-запросов к API
- **Max Platform API** - API для интеграции с платформой MAX

## Настройка окружения

### Установка зависимостей

```bash
pip install requests
```

### Конфигурация

Создайте файл `config.py` со следующими параметрами:

```python
# Токен API от Max Platform
TOKEN = "your_token_here"

# Payload для мини-приложений
APP_PAYLOAD = "app_id_here"

# Базовый URL API
BASE_URL = "https://platform-api.max.ru"
```

## Структура кода

### Основные функции (bot.py)

#### `get_updates(offset=None)`
Получает обновления от API (long polling).

**Параметры:**
- `offset` (опционально) - идентификатор последнего полученного обновления

**Возвращает:** JSON с обновлениями

#### `send_message(chat_id, text, attachments=None)`
Отправляет сообщение пользователю.

**Параметры:**
- `chat_id` - идентификатор чата пользователя
- `text` - текст сообщения
- `attachments` (опционально) - массив вложений (клавиатуры, медиа)

**Возвращает:** JSON ответ от API

#### `answer_callback(callback_id, text=None)`
Обрабатывает нажатие на кнопку колбэка.

**Параметры:**
- `callback_id` - идентификатор колбэка
- `text` (опционально) - текст ответа на колбэк

**Возвращает:** JSON ответ от API

#### `handle_message(message)`
Обрабатывает входящие текстовые сообщения.

**Параметры:**
- `message` - объект сообщения

#### `handle_callback(callback)`
Обрабатывает колбэки от нажатий на кнопки.

**Параметры:**
- `callback` - объект колбэка

#### `get_bot_info()`
Получает информацию о текущем боте.

**Возвращает:** JSON с информацией о боте или None в случае ошибки

#### `validate_token()`
Проверяет валидность токена при запуске бота.

**Возвращает:** Boolean значение (True - токен действителен, False - недействителен)

## Структура inline-клавиатур

```python
keyboard = {
    "type": "inline_keyboard",
    "payload": {
        "buttons": [
            [{"type": "callback", "text": "Текст кнопки", "payload": "payload_value"}],
            [{"type": "open_app", "text": "Открыть приложение", "payload": "app_id"}]
        ]
    }
}
```

### Типы кнопок

- **callback** - обрабатывается на сервере, возвращает колбэк
- **open_app** - открывает мини-приложение

## Добавление новых категорий поддержки

Для добавления новой категории:

1. Добавьте новую кнопку в главное меню в `handle_message()`:

```python
[{"type": "callback", "text": "Новая категория", "payload": "new_category"}]
```

2. Добавьте обработчик в `handle_callback()`:

```python
elif payload == "new_category":
    text = "Описание категории:"
    keyboard = {
        "type": "inline_keyboard",
        "payload": {
            "buttons": [
                [{"type": "callback", "text": "Подкатегория 1", "payload": "new_category_1"}],
                [{"type": "callback", "text": "Подкатегория 2", "payload": "new_category_2"}],
                [{"type": "callback", "text": "Возврат в главное меню", "payload": "main_menu"}]
            ]
        }
    }
    send_message(chat_id, text, [keyboard])
```

3. Добавьте обработчики для подкатегорий аналогичным образом.

## Добавление нового функционала

### Добавление новой команды

```python
def handle_message(message):
    chat_id = message["chat"]["id"]
    text = message.get("text", "")
    if text == "/new_command":
        send_message(chat_id, "Ответ на новую команду")
```

### Добавление медиа-вложений

```python
attachment = {
    "type": "image",
    "payload": {
        "url": "https://example.com/image.jpg"
    }
}
send_message(chat_id, "Текст с изображением", [attachment])
```

## Запуск бота

### Локальный запуск

```bash
python bot.py
```

### Запуск в фоне (Linux/Mac)

```bash
nohup python bot.py > bot.log 2>&1 &
```

### Запуск как службы (systemd)

Создайте файл `/etc/systemd/system/max-bot.service`:

```ini
[Unit]
Description=Max Bot
After=network.target

[Service]
User=your_user
WorkingDirectory=/path/to/bot
ExecStart=/usr/bin/python3 /path/to/bot/bot.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Запустите службу:

```bash
sudo systemctl daemon-reload
sudo systemctl start max-bot
sudo systemctl enable max-bot
```

## Логирование

Для добавления логирования:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    filename='bot.log'
)

logging.info("Bot started")
```

## Обработка ошибок

Добавьте обработку ошибок в API-функциях:

```python
def get_updates(offset=None):
    try:
        url = f"{BASE_URL}/updates"
        headers = {"Authorization": TOKEN}
        params = {}
        if offset:
            params["offset"] = offset
        response = requests.get(url, headers=headers, params=params, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logging.error(f"Error getting updates: {e}")
        return {"updates": []}
```

## Тестирование

### Ручное тестирование

1. Запустите бота
2. Отправьте команду `/start` в чате с ботом
3. Протестируйте все категории и кнопки

### Автоматическое тестирование

Создайте файл `test_bot.py`:

```python
import unittest
from bot import handle_message, handle_callback

class TestBot(unittest.TestCase):
    def test_handle_start(self):
        message = {"chat": {"id": "test_chat"}, "text": "/start"}
        # Добавьте проверки
        
    def test_handle_callback(self):
        callback = {
            "id": "test_callback",
            "payload": "veteran",
            "message": {"chat": {"id": "test_chat"}}
        }
        # Добавьте проверки

if __name__ == "__main__":
    unittest.main()
```

Запустите тесты:

```bash
python test_bot.py
```

## Развертывание

### Подготовка к продакшену

1. Добавьте `.gitignore`:

```
config.py
__pycache__/
*.pyc
bot.log
.env
```

2. Используйте переменные окружения:

```python
import os

TOKEN = os.getenv("MAX_BOT_TOKEN", "")
BASE_URL = os.getenv("MAX_BOT_URL", "https://platform-api.max.ru")
```

3. Настройте мониторинг и алерты

## Поддержка и развитие

Для добавления новой функциональности или исправления ошибок:

1. Создайте ветку: `git checkout -b feature/new-feature`
2. Внесите изменения
3. Протестируйте
4. Создайте pull request

## Ресурсы

- [Max Platform API документация](https://dev.max.ru/docs-api)
- [Python requests библиотека](https://docs.python-requests.org/)
