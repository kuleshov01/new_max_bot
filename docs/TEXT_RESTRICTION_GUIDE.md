# Руководство по ограничению текстовых сообщений

## 📋 Описание

Модуль `text_message_restrictions.py` предоставляет функционал для ограничения произвольных текстовых сообщений в чат-ботах, требуя от пользователей использования кнопочного интерфейса.

## 🎯 Возможности

- ✅ Перехват всех текстовых сообщений от пользователей
- ✅ Отправка настраиваемого предупреждения
- ✅ Исключение для команд (например, `/start`, `/help`)
- ✅ Возможность динамического управления настройками
- ✅ Поддержка кастомных валидаторов
- ✅ Полная интеграция с существующей архитектурой бота

## 🚀 Быстрый старт

### 1. Базовое использование

```python
from text_message_restrictions import TextMessageRestriction

# Создаём ограничитель с настройками по умолчанию
restriction = TextMessageRestriction()

# Проверяем, нужно ли ограничить сообщение
if restriction.should_restrict("Привет!"):
    print("Сообщение будет ограничено")

# Отправляем предупреждение
restriction.send_warning(bot_instance, chat_id)
```

### 2. Кастомные настройки

```python
# Создаём ограничитель с кастомными настройками
restriction = TextMessageRestriction(
    warning_message="⚠️ Пожалуйста, используйте кнопки меню!",
    allowed_commands=['/start', '/help', '/settings'],
    enabled=True
)
```

## 🔧 Интеграция в существующий бот

### Вариант 1: Использование в BotInstance

Модуль уже интегрирован в класс `BotInstance` в файле [`bot_manager.py`](../src/bot_manager.py).

**Настройка через конфигурацию бота:**

```python
# При создании бота в базе данных
bot_config = {
    'name': 'My Bot',
    'token': 'your_token',
    'base_url': 'https://platform-api.max.ru',
    'text_restriction_warning': 'Для управления ботом используйте кнопки! 🎛️',
    'allowed_commands': ['/start', '/help', '/settings'],
    'text_restriction_enabled': True
}
```

**Динамическое управление:**

```python
# Получаем экземпляр бота
bot_instance = bot_manager.bots[bot_id]

# Включаем/выключаем ограничение
bot_instance.enable_text_restriction()
bot_instance.disable_text_restriction()

# Обновляем текст предупреждения
bot_instance.update_restriction_warning("Новый текст предупреждения!")

# Добавляем/удаляем разрешённые команды
bot_instance.add_allowed_command('/admin')
bot_instance.remove_allowed_command('/help')

# Проверяем состояние
if bot_instance.is_text_restriction_enabled():
    print("Ограничение включено")

# Получаем список разрешённых команд
commands = bot_instance.get_allowed_commands()
print(f"Разрешённые команды: {commands}")
```

### Вариант 2: Использование декоратора

```python
from text_message_restrictions import restrict_text_messages

@restrict_text_messages(
    warning_message="Используйте кнопки для навигации!",
    allowed_commands=['/start', '/help']
)
def handle_message(bot, message):
    # Обработка сообщения
    # Если текст будет ограничен, функция не выполнится
    pass
```

### Вариант 3: Прямая проверка в обработчике

```python
from text_message_restrictions import get_default_restriction

def handle_message(bot, message):
    text = message.get('text', '')
    chat_id = message.get('chat', {}).get('id')
    
    # Получаем глобальный ограничитель
    restriction = get_default_restriction()
    
    # Проверяем сообщение
    if restriction.should_restrict(text):
        restriction.send_warning(bot, chat_id)
        return  # Прерываем обработку
    
    # Продолжаем обработку сообщения
    process_message(message)
```

## 📝 API Reference

### Класс `TextMessageRestriction`

#### Конструктор

```python
TextMessageRestriction(
    warning_message: str = "Для управления ботом, пожалуйста, используйте кнопки ⬇️",
    allowed_commands: Optional[List[str]] = None,
    enabled: bool = True,
    custom_validator: Optional[Callable[[str], bool]] = None
)
```

**Параметры:**

- `warning_message`: Текст предупреждения (поддерживает HTML)
- `allowed_commands`: Список разрешённых команд
- `enabled`: Флаг включения ограничения
- `custom_validator`: Кастомная функция валидации

#### Методы

##### `should_restrict(text: str) -> bool`

Проверяет, должно ли сообщение быть ограничено.

```python
>>> restriction = TextMessageRestriction()
>>> restriction.should_restrict("/start")
False
>>> restriction.should_restrict("Привет!")
True
```

##### `send_warning(bot_instance, chat_id, format_type: str = "html")`

Отправляет предупреждение пользователю.

```python
restriction.send_warning(bot, chat_id=12345)
```

##### `update_warning_message(new_message: str)`

Обновляет текст предупреждения.

```python
restriction.update_warning_message("Используйте кнопки! 🎛️")
```

##### `add_allowed_command(command: str)`

Добавляет команду в список разрешённых.

```python
restriction.add_allowed_command('/settings')
```

##### `remove_allowed_command(command: str)`

Удаляет команду из списка разрешённых.

```python
restriction.remove_allowed_command('/help')
```

##### `enable() / disable()`

Включает/выключает ограничение.

```python
restriction.enable()
restriction.disable()
```

##### `is_enabled() -> bool`

Проверяет, включено ли ограничение.

```python
if restriction.is_enabled():
    print("Ограничение активно")
```

## 🎨 Примеры использования

### Пример 1: Базовое ограничение

```python
from text_message_restrictions import TextMessageRestriction

# Создаём ограничитель
restriction = TextMessageRestriction()

# Тестируем сообщения
messages = [
    "/start",      # Разрешено (команда)
    "Привет!",     # Ограничено
    "/help",       # Разрешено (в списке разрешённых)
    "Как дела?"    # Ограничено
]

for msg in messages:
    if restriction.should_restrict(msg):
        print(f"'{msg}' -> ❌ Ограничено")
    else:
        print(f"'{msg}' -> ✅ Разрешено")
```

### Пример 2: Кастомный валидатор

```python
def admin_validator(text: str) -> bool:
    """Разрешаем сообщения от администраторов"""
    return text.startswith("ADMIN:")

restriction = TextMessageRestriction(
    custom_validator=admin_validator
)

# Тестируем
print(restriction.should_restrict("Привет"))        # True (ограничено)
print(restriction.should_restrict("ADMIN: команда")) # False (разрешено)
```

### Пример 3: Динамическое управление

```python
from text_message_restrictions import configure_default_restriction

# Настраиваем глобальный ограничитель
configure_default_restriction(
    warning_message="⚠️ Используйте кнопки меню!",
    allowed_commands=['/start', '/help', '/settings', '/admin'],
    enabled=True
)

# Используем в обработчике
from text_message_restrictions import get_default_restriction

def message_handler(bot, message):
    restriction = get_default_restriction()
    text = message.get('text', '')
    
    if restriction.should_restrict(text):
        restriction.send_warning(bot, message['chat']['id'])
        return
```

### Пример 4: Интеграция с aiogram 3.x

```python
from aiogram import Router, types
from text_message_restrictions import TextMessageRestriction

# Создаём роутер
router = Router()

# Создаём ограничитель
restriction = TextMessageRestriction(
    warning_message="<b>Для управления ботом используйте кнопки!</b>",
    allowed_commands=['/start', '/help']
)

@router.message()
async def handle_message(message: types.Message):
    # Проверяем сообщение
    if restriction.should_restrict(message.text):
        await message.answer(
            restriction.warning_message,
            parse_mode="HTML"
        )
        return
    
    # Продолжаем обработку
    await process_message(message)
```

## 🔍 Как это работает

### Логика ограничения

1. **Проверка включения**: Если ограничение выключено (`enabled=False`), все сообщения разрешены
2. **Пустые сообщения**: Пустые сообщения не ограничиваются
3. **Команды**: Все команды (начинающиеся с `/`) разрешены по умолчанию
4. **Разрешённые команды**: Команды из списка `allowed_commands` всегда разрешены
5. **Кастомный валидатор**: Если предоставлен, используется для дополнительной проверки
6. **По умолчанию**: Все остальные текстовые сообщения ограничиваются

### Поток обработки

```
Текстовое сообщение
       ↓
Проверка: enabled?
       ↓ Нет
   Разрешить
       ↓ Да
Проверка: текст пустой?
       ↓ Да
   Разрешить
       ↓ Нет
Проверка: это команда?
       ↓ Да
   Разрешить
       ↓ Нет
Проверка: в allowed_commands?
       ↓ Да
   Разрешить
       ↓ Нет
Проверка: custom_validator?
       ↓ Да
   Использовать валидатор
       ↓ Нет
   ОГРАНИЧИТЬ → Отправить предупреждение
```

## 🛠️ Конфигурация через базу данных

### Добавление полей в конфигурацию бота

```sql
-- Пример структуры таблицы bots
ALTER TABLE bots ADD COLUMN text_restriction_warning TEXT DEFAULT 'Для управления ботом, пожалуйста, используйте кнопки ⬇️';
ALTER TABLE bots ADD COLUMN allowed_commands TEXT DEFAULT '["/start", "/help"]';
ALTER TABLE bots ADD COLUMN text_restriction_enabled BOOLEAN DEFAULT TRUE;
```

### Обновление конфигурации через API

```python
import requests

# Обновление настроек ограничения
bot_id = 1
response = requests.put(
    f'http://localhost:5000/api/bots/{bot_id}',
    json={
        'name': 'My Bot',
        'token': 'your_token',
        'base_url': 'https://platform-api.max.ru',
        'text_restriction_warning': 'Используйте кнопки! 🎛️',
        'allowed_commands': ['/start', '/help', '/settings'],
        'text_restriction_enabled': True
    }
)
```

## 📊 Мониторинг и логирование

Модуль автоматически логирует все действия:

```python
# Логи включены автоматически
import logging
logging.basicConfig(level=logging.DEBUG)

# Примеры логов:
# INFO - Ограничение текстовых сообщений включено
# INFO - Текстовое сообщение от чата 12345 ограничено: "Привет..."
# INFO - Отправлено предупреждение в чат 12345
# INFO - Добавлена разрешённая команда: /admin
```

## 🧪 Тестирование

```python
import unittest
from text_message_restrictions import TextMessageRestriction

class TestTextRestriction(unittest.TestCase):
    def setUp(self):
        self.restriction = TextMessageRestriction()
    
    def test_commands_allowed(self):
        self.assertFalse(self.restriction.should_restrict("/start"))
        self.assertFalse(self.restriction.should_restrict("/help"))
    
    def test_text_restricted(self):
        self.assertTrue(self.restriction.should_restrict("Привет"))
        self.assertTrue(self.restriction.should_restrict("Как дела?"))
    
    def test_custom_warning(self):
        custom = TextMessageRestriction(
            warning_message="Custom message"
        )
        self.assertEqual(custom.warning_message, "Custom message")
    
    def test_enable_disable(self):
        self.restriction.disable()
        self.assertFalse(self.restriction.is_enabled())
        self.assertFalse(self.restriction.should_restrict("Привет"))
        
        self.restriction.enable()
        self.assertTrue(self.restriction.is_enabled())
        self.assertTrue(self.restriction.should_restrict("Привет"))

if __name__ == '__main__':
    unittest.main()
```

## ❓ Часто задаваемые вопросы

**Q: Можно ли разрешить определённые текстовые сообщения?**

A: Да, используйте `custom_validator` для сложной логики:

```python
def validator(text: str) -> bool:
    # Разрешаем сообщения с ключевыми словами
    keywords = ['помощь', 'поддержка', 'администратор']
    return any(kw in text.lower() for kw in keywords)

restriction = TextMessageRestriction(custom_validator=validator)
```

**Q: Как временно отключить ограничение?**

A: Используйте метод `disable()`:

```python
bot_instance.disable_text_restriction()
# Или для глобального ограничителя
from text_message_restrictions import get_default_restriction
get_default_restriction().disable()
```

**Q: Можно ли использовать HTML в предупреждении?**

A: Да, предупреждение поддерживает HTML-разметку:

```python
restriction = TextMessageRestriction(
    warning_message="<b>Внимание!</b> Используйте <i>кнопки</i> для навигации"
)
```

**Q: Как добавить несколько команд сразу?**

A: Используйте метод `configure_default_restriction` или обновите список:

```python
# Вариант 1: через конфигурацию
from text_message_restrictions import configure_default_restriction
configure_default_restriction(
    allowed_commands=['/start', '/help', '/settings', '/admin', '/profile']
)

# Вариант 2: напрямую
restriction.allowed_commands = ['/start', '/help', '/settings']
```

## 📚 Дополнительные ресурсы

- [`text_message_restrictions.py`](../src/text_message_restrictions.py) - Исходный код модуля
- [`bot_manager.py`](../src/bot_manager.py) - Интеграция с BotInstance
- [aiogram 3.x документация](https://docs.aiogram.dev/)

## 🤝 Поддержка

При возникновении проблем или вопросов:
1. Проверьте логи бота
2. Убедитесь, что ограничение включено
3. Проверьте список разрешённых команд
4. Используйте `logging.DEBUG` для детальной отладки

---

**Версия**: 1.0.0  
**Последнее обновление**: 2026-02-05
