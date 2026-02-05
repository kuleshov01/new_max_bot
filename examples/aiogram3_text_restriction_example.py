"""
Пример интеграции модуля text_message_restrictions с aiogram 3.x
=================================================================

Этот пример демонстрирует, как использовать модуль text_message_restrictions
для ограничения произвольных текстовых сообщений в боте на aiogram 3.x.

Установка aiogram 3.x:
    pip install aiogram==3.x

Запуск бота:
    python aiogram3_text_restriction_example.py
"""

import asyncio
import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from text_message_restrictions import TextMessageRestriction

# =============================================================================
# КОНФИГУРАЦИЯ
# =============================================================================

# Вставьте ваш токен бота
BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"

# Создаём ограничитель текстовых сообщений
text_restriction = TextMessageRestriction(
    warning_message=(
        "<b>⚠️ Внимание!</b>\n\n"
        "Для управления ботом, пожалуйста, используйте кнопки ⬇️\n"
        "<i>Произвольные текстовые сообщения не обрабатываются.</i>"
    ),
    allowed_commands=['/start', '/help', '/settings'],
    enabled=True
)

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# КЛАВИАТУРЫ
# =============================================================================

def get_main_keyboard():
    """Создаёт главную клавиатуру с кнопками."""
    buttons = [
        [
            InlineKeyboardButton(text="📊 Статистика", callback_data="btn:stats"),
            InlineKeyboardButton(text="⚙️ Настройки", callback_data="btn:settings")
        ],
        [
            InlineKeyboardButton(text="📖 Помощь", callback_data="btn:help"),
            InlineKeyboardButton(text="👤 Профиль", callback_data="btn:profile")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def get_settings_keyboard():
    """Создаёт клавиатуру настроек."""
    buttons = [
        [
            InlineKeyboardButton(text="🔔 Уведомления", callback_data="btn:notifications"),
            InlineKeyboardButton(text="🎨 Тема", callback_data="btn:theme")
        ],
        [
            InlineKeyboardButton(text="◀️ Назад", callback_data="btn:back")
        ]
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


# =============================================================================
# ОБРАБОТЧИКИ СООБЩЕНИЙ
# =============================================================================

# Обработчик команды /start
@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    """Обработчик команды /start."""
    user_name = message.from_user.first_name or "пользователь"
    
    welcome_text = (
        f"👋 Привет, {user_name}!\n\n"
        "Добро пожаловать в бота с ограничением текстовых сообщений.\n"
        "📝 Попробуйте отправить произвольный текст — вы получите предупреждение.\n\n"
        "🎛️ Используйте кнопки ниже для навигации:"
    )
    
    await message.answer(
        welcome_text,
        parse_mode="HTML",
        reply_markup=get_main_keyboard()
    )
    
    logger.info(f"Пользователь {message.from_user.id} запустил бота")


# Обработчик команды /help
@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    """Обработчик команды /help."""
    help_text = (
        "<b>📖 Справка</b>\n\n"
        "Этот бот демонстрирует работу ограничения текстовых сообщений.\n\n"
        "<b>Доступные команды:</b>\n"
        "• /start - Запустить бота\n"
        "• /help - Показать справку\n"
        "• /settings - Открыть настройки\n\n"
        "<b>⚠️ Важно:</b> Все произвольные текстовые сообщения будут "
        "отклонены с просьбой использовать кнопки."
    )
    
    await message.answer(help_text, parse_mode="HTML")


# Обработчик команды /settings
@dp.message(Command("settings"))
async def cmd_settings(message: types.Message):
    """Обработчик команды /settings."""
    settings_text = (
        "<b>⚙️ Настройки</b>\n\n"
        "Выберите действие:"
    )
    
    await message.answer(
        settings_text,
        parse_mode="HTML",
        reply_markup=get_settings_keyboard()
    )


# =============================================================================
# ОСНОВНОЙ ОБРАБОТЧИК ТЕКСТОВЫХ СООБЩЕНИЙ
# =============================================================================

@dp.message()
async def handle_text_message(message: types.Message):
    """
    Обработчик всех текстовых сообщений.
    
    Этот обработчик перехватывает все текстовые сообщения и проверяет их
    через модуль text_message_restrictions. Если сообщение должно быть
    ограничено, отправляется предупреждение.
    """
    text = message.text or ""
    chat_id = message.chat.id
    user_id = message.from_user.id
    
    logger.info(f"Получено сообщение от {user_id}: '{text[:30]}...'")
    
    # Проверяем, нужно ли ограничить сообщение
    if text_restriction.should_restrict(text):
        logger.info(f"Сообщение от {user_id} ограничено")
        
        # Отправляем предупреждение
        await message.answer(
            text_restriction.warning_message,
            parse_mode="HTML"
        )
        
        # Отправляем клавиатуру для удобства
        await message.answer(
            "🎛️ Используйте кнопки ниже:",
            reply_markup=get_main_keyboard()
        )
        return
    
    # Если сообщение не ограничено (например, команда), логируем
    logger.info(f"Сообщение от {user_id} разрешено: '{text[:30]}...'")


# =============================================================================
# ОБРАБОТЧИКИ CALLBACK-КНОПОК
# =============================================================================

@dp.callback_query(F.data.startswith("btn:"))
async def handle_button_press(callback: types.CallbackQuery):
    """Обработчик нажатий на кнопки."""
    button_id = callback.data.replace("btn:", "")
    user_id = callback.from_user.id
    
    logger.info(f"Пользователь {user_id} нажал кнопку: {button_id}")
    
    # Отвечаем на callback, чтобы убрать индикатор загрузки
    await callback.answer("✅")
    
    # Обрабатываем нажатие кнопки
    if button_id == "stats":
        stats_text = (
            "<b>📊 Статистика</b>\n\n"
            "• Всего пользователей: 1\n"
            "• Сообщений обработано: 0\n"
            "• Ограничено сообщений: 0"
        )
        await callback.message.edit_text(stats_text, parse_mode="HTML")
        await callback.message.edit_reply_markup(reply_markup=get_main_keyboard())
    
    elif button_id == "settings":
        settings_text = "<b>⚙️ Настройки</b>\n\nВыберите действие:"
        await callback.message.edit_text(settings_text, parse_mode="HTML")
        await callback.message.edit_reply_markup(reply_markup=get_settings_keyboard())
    
    elif button_id == "help":
        help_text = (
            "<b>📖 Помощь</b>\n\n"
            "Используйте кнопки для навигации по боту.\n"
            "Произвольные текстовые сообщения не обрабатываются."
        )
        await callback.message.edit_text(help_text, parse_mode="HTML")
        await callback.message.edit_reply_markup(reply_markup=get_main_keyboard())
    
    elif button_id == "profile":
        user = callback.from_user
        profile_text = (
            f"<b>👤 Профиль</b>\n\n"
            f"<b>Имя:</b> {user.first_name or 'Не указано'}\n"
            f"<b>Username:</b> @{user.username or 'Не указан'}\n"
            f"<b>ID:</b> {user.id}"
        )
        await callback.message.edit_text(profile_text, parse_mode="HTML")
        await callback.message.edit_reply_markup(reply_markup=get_main_keyboard())
    
    elif button_id == "notifications":
        await callback.answer("🔔 Уведомления включены", show_alert=True)
    
    elif button_id == "theme":
        await callback.answer("🎨 Тема изменена", show_alert=True)
    
    elif button_id == "back":
        main_text = "🎛️ Главное меню:"
        await callback.message.edit_text(main_text)
        await callback.message.edit_reply_markup(reply_markup=get_main_keyboard())


# =============================================================================
# ДИНАМИЧЕСКОЕ УПРАВЛЕНИЕ ОГРАНИЧЕНИЕМ
# =============================================================================

# Пример обработчика для включения/выключения ограничения (для администраторов)
@dp.message(Command("toggle_restriction"))
async def cmd_toggle_restriction(message: types.Message):
    """
    Переключает состояние ограничения текстовых сообщений.
    
    В реальном боте эта команда должна быть доступна только администраторам!
    """
    user_id = message.from_user.id
    
    # Проверка на администратора (замените на реальную проверку)
    ADMIN_IDS = [123456789]  # Замените на реальные ID администраторов
    
    if user_id not in ADMIN_IDS:
        await message.answer("❌ У вас нет прав для выполнения этой команды.")
        return
    
    # Переключаем состояние
    if text_restriction.is_enabled():
        text_restriction.disable()
        status_text = "❌ Ограничение текстовых сообщений <b>выключено</b>"
    else:
        text_restriction.enable()
        status_text = "✅ Ограничение текстовых сообщений <b>включено</b>"
    
    await message.answer(status_text, parse_mode="HTML")
    logger.info(f"Пользователь {user_id} изменил состояние ограничения")


# =============================================================================
# ЗАПУСК БОТА
# =============================================================================

async def main():
    """Главная функция для запуска бота."""
    # Проверяем токен
    if BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        logger.error("❌ Пожалуйста, укажите BOT_TOKEN в файле!")
        return
    
    # Инициализируем бота и диспетчер
    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()
    
    # Регистрируем обработчики
    dp.message.register(cmd_start, Command("start"))
    dp.message.register(cmd_help, Command("help"))
    dp.message.register(cmd_settings, Command("settings"))
    dp.message.register(cmd_toggle_restriction, Command("toggle_restriction"))
    dp.message.register(handle_text_message)
    dp.callback_query.register(handle_button_press)
    
    # Логируем запуск
    logger.info("🚀 Бот запускается...")
    logger.info(f"📝 Ограничение текстовых сообщений: {'включено' if text_restriction.is_enabled() else 'выключено'}")
    logger.info(f"✅ Разрешённые команды: {text_restriction.allowed_commands}")
    
    # Запускаем бота
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("👋 Бот остановлен")


# =============================================================================
# ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
# =============================================================================

"""
Примеры сценариев использования:

1. Базовое ограничение:
   >>> restriction = TextMessageRestriction()
   >>> restriction.should_restrict("Привет")
   True

2. Кастомное предупреждение:
   >>> restriction = TextMessageRestriction(
   ...     warning_message="Используйте кнопки!"
   ... )

3. Динамическое управление:
   >>> restriction.enable()
   >>> restriction.disable()
   >>> restriction.update_warning_message("Новый текст!")

4. Кастомный валидатор:
   >>> def validator(text):
   ...     return "админ" in text.lower()
   >>> restriction = TextMessageRestriction(custom_validator=validator)

5. Добавление команд:
   >>> restriction.add_allowed_command('/admin')
   >>> restriction.remove_allowed_command('/help')
"""
