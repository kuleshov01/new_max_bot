# Примеры использования модуля text_message_restrictions

Эта директория содержит примеры интеграции модуля `text_message_restrictions` с различными фреймворками для создания чат-ботов.

## 📁 Содержание

### [`aiogram3_text_restriction_example.py`](./aiogram3_text_restriction_example.py)

Полный пример бота на **aiogram 3.x** с ограничением текстовых сообщений.

**Возможности:**
- ✅ Перехват произвольных текстовых сообщений
- ✅ Отправка настраиваемого предупреждения
- ✅ Кнопочный интерфейс для навигации
- ✅ Динамическое управление ограничением
- ✅ Примеры callback-обработчиков

**Установка:**
```bash
pip install aiogram==3.4.1
```

**Запуск:**
```bash
# Отредактируйте BOT_TOKEN в файле
python examples/aiogram3_text_restriction_example.py
```

## 🚀 Быстрый старт

### 1. Установите зависимости

```bash
pip install -r requirements.txt
```

### 2. Получите токен бота

1. Напишите [@BotFather](https://t.me/BotFather) в Telegram
2. Создайте нового бота командой `/newbot`
3. Скопируйте полученный токен

### 3. Настройте бота

Отредактируйте файл примера и замените `YOUR_BOT_TOKEN_HERE` на ваш токен:

```python
BOT_TOKEN = "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
```

### 4. Запустите бота

```bash
python examples/aiogram3_text_restriction_example.py
```

## 📝 Основные концепты

### Создание ограничителя

```python
from text_message_restrictions import TextMessageRestriction

restriction = TextMessageRestriction(
    warning_message="Для управления ботом используйте кнопки! ⬇️",
    allowed_commands=['/start', '/help'],
    enabled=True
)
```

### Проверка сообщений

```python
@dp.message()
async def handle_message(message: types.Message):
    if restriction.should_restrict(message.text):
        await message.answer(restriction.warning_message)
        return
    # Обработка сообщения...
```

### Динамическое управление

```python
# Включить/выключить
restriction.enable()
restriction.disable()

# Обновить предупреждение
restriction.update_warning_message("Новый текст!")

# Добавить команду
restriction.add_allowed_command('/settings')
```

## 🎯 Сценарии использования

### Сценарий 1: Строгое ограничение

```python
restriction = TextMessageRestriction(
    warning_message="⚠️ Используйте только кнопки!",
    allowed_commands=['/start'],
    enabled=True
)
```

### Сценарий 2: Мягкое ограничение

```python
restriction = TextMessageRestriction(
    warning_message="💡 Для удобства используйте кнопки меню",
    allowed_commands=['/start', '/help', '/settings', '/admin'],
    enabled=True
)
```

### Сценарий 3: Кастомная логика

```python
def custom_validator(text: str) -> bool:
    """Разрешаем сообщения от VIP-пользователей"""
    return is_vip_user(text)  # Ваша функция проверки

restriction = TextMessageRestriction(
    custom_validator=custom_validator
)
```

## 🔧 Интеграция с другими фреймворками

### Telebot

```python
import telebot
from text_message_restrictions import TextMessageRestriction

bot = telebot.TeleBot("TOKEN")
restriction = TextMessageRestriction()

@bot.message_handler(content_types=['text'])
def handle_text(message):
    if restriction.should_restrict(message.text):
        bot.send_message(
            message.chat.id,
            restriction.warning_message,
            parse_mode="HTML"
        )
        return
    # Обработка...

bot.polling()
```

### PyTelegramBotAPI

```python
from pyTelegramBotAPI import telebot
from text_message_restrictions import TextMessageRestriction

bot = telebot.TeleBot("TOKEN")
restriction = TextMessageRestriction()

@bot.message_handler(func=lambda m: True)
def handle_all_messages(message):
    if restriction.should_restrict(message.text):
        bot.reply_to(message, restriction.warning_message)
        return
    # Обработка...

bot.infinity_polling()
```

## 📚 Дополнительные ресурсы

- [Полная документация](../docs/TEXT_RESTRICTION_GUIDE.md)
- [Исходный код модуля](../src/text_message_restrictions.py)
- [Интеграция с BotInstance](../src/bot_manager.py)

## 🧪 Тестирование

Для тестирования функционала без создания бота:

```python
from text_message_restrictions import TextMessageRestriction

restriction = TextMessageRestriction()

test_cases = [
    ("/start", False),
    ("Привет", True),
    ("/help", False),
    ("Как дела?", True)
]

for text, expected in test_cases:
    result = restriction.should_restrict(text)
    assert result == expected, f"Ошибка для '{text}'"
    print(f"✅ '{text}' -> {'Ограничено' if result else 'Разрешено'}")
```

## ❓ Частые проблемы

### Проблема: Бот не отвечает

**Решение:** Проверьте, что токен указан верно и бот запущен:

```python
# Добавьте отладку
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Проблема: Предупреждение не отправляется

**Решение:** Убедитесь, что ограничение включено:

```python
print(f"Ограничение включено: {restriction.is_enabled()}")
restriction.enable()
```

### Проблема: Команды блокируются

**Решение:** Добавьте команды в список разрешённых:

```python
restriction.add_allowed_command('/mycommand')
```

## 🤝 Поддержка

При возникновении проблем:
1. Проверьте [документацию](../docs/TEXT_RESTRICTION_GUIDE.md)
2. Посмотрите [примеры кода](../src/text_message_restrictions.py)
3. Проверьте логи бота

---

**Версия**: 1.0.0  
**Последнее обновление**: 2026-02-05
