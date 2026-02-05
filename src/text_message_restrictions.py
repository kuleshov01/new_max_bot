"""
Модуль text_message_restrictions.py
==================================

Этот модуль предоставляет функционал для ограничения произвольных текстовых сообщений
в чат-ботах, требуя от пользователей использования кнопочного интерфейса.

Основные возможности:
- Перехват всех текстовых сообщений от пользователей
- Отправка настраиваемого предупреждения
- Исключение для команд (например, /start)
- Интеграция с существующей архитектурой бота

Пример использования:
    from text_message_restrictions import TextMessageRestriction

    restriction = TextMessageRestriction(
        warning_message="Для управления ботом, пожалуйста, используйте кнопки ⬇️",
        allowed_commands=["/start", "/help"]
    )
    
    # В обработчике сообщений
    if restriction.should_restrict(text):
        restriction.send_warning(bot_instance, chat_id)
"""

import logging
from typing import Optional, List, Callable


class TextMessageRestriction:
    """
    Класс для управления ограничениями текстовых сообщений.
    
    Этот класс обеспечивает централизованное управление логикой ограничения
    текстовых сообщений и отправки предупреждений пользователям.
    
    Attributes:
        warning_message (str): Текст предупреждения, отправляемого пользователю
        allowed_commands (List[str]): Список разрешённых команд (например, ['/start', '/help'])
        enabled (bool): Флаг включения/выключения ограничения
        custom_validator (Optional[Callable]): Кастомная функция для валидации сообщений
    """
    
    def __init__(
        self,
        warning_message: str = "Для управления ботом, пожалуйста, используйте кнопки ⬇️",
        allowed_commands: Optional[List[str]] = None,
        enabled: bool = True,
        custom_validator: Optional[Callable[[str], bool]] = None
    ):
        """
        Инициализация ограничителя текстовых сообщений.
        
        Args:
            warning_message: Текст предупреждения. Поддерживает HTML-разметку.
                           По умолчанию: "Для управления ботом, пожалуйста, используйте кнопки ⬇️"
            allowed_commands: Список разрешённых команд, которые не будут блокироваться.
                            По умолчанию: ['/start', '/help']
            enabled: Флаг включения ограничения. Если False, ограничение не применяется.
                    По умолчанию: True
            custom_validator: Кастомная функция для проверки сообщения.
                            Принимает текст сообщения, возвращает True если сообщение разрешено.
        """
        self.warning_message = warning_message
        self.allowed_commands = allowed_commands or ['/start', '/help']
        self.enabled = enabled
        self.custom_validator = custom_validator
        self.logger = logging.getLogger(__name__)
    
    def should_restrict(self, text: str) -> bool:
        """
        Проверяет, должно ли текстовое сообщение быть ограничено.
        
        Args:
            text: Текст сообщения от пользователя
            
        Returns:
            bool: True если сообщение должно быть ограничено, False в противном случае
            
        Examples:
            >>> restriction = TextMessageRestriction()
            >>> restriction.should_restrict("/start")
            False
            >>> restriction.should_restrict("Привет!")
            True
            >>> restriction.should_restrict("/help")
            False
        """
        # Если ограничение отключено, не блокируем
        if not self.enabled:
            return False
        
        # Проверяем пустые сообщения
        if not text or not text.strip():
            return False
        
        text = text.strip()
        
        # Проверяем, является ли сообщение разрешённой командой
        for command in self.allowed_commands:
            if text == command or text.startswith(command + ' '):
                self.logger.debug(f"Команда '{text}' разрешена")
                return False
        
        # Проверяем все команды (начинаются с /)
        if text.startswith('/'):
            self.logger.debug(f"Команда '{text}' разрешена (начинается с /)")
            return False
        
        # Используем кастомный валидатор если он предоставлен
        if self.custom_validator:
            try:
                if self.custom_validator(text):
                    self.logger.debug(f"Сообщение '{text}' разрешено кастомным валидатором")
                    return False
            except Exception as e:
                self.logger.error(f"Ошибка в кастомном валидаторе: {e}")
        
        # Во всех остальных случаях блокируем
        return True
    
    def send_warning(self, bot_instance, chat_id, format_type: str = "html"):
        """
        Отправляет предупреждение пользователю.
        
        Args:
            bot_instance: Экземпляр бота с методом send_message
            chat_id: ID чата для отправки сообщения
            format_type: Форматирование сообщения ('html' или 'markdown')
            
        Note:
            Метод использует bot_instance.send_message() для отправки предупреждения.
            Убедитесь, что ваш экземпляр бота имеет этот метод.
        """
        try:
            # Проверяем наличие метода send_message у бота
            if hasattr(bot_instance, 'send_message'):
                bot_instance.send_message(
                    chat_id=chat_id,
                    text=self.warning_message,
                    format_type=format_type
                )
                self.logger.info(f"Отправлено предупреждение в чат {chat_id}")
            else:
                self.logger.error(
                    f"Экземпляр бота не имеет метода send_message. "
                    f"Тип: {type(bot_instance)}"
                )
        except Exception as e:
            self.logger.error(f"Ошибка при отправке предупреждения: {e}")
    
    def update_warning_message(self, new_message: str):
        """
        Обновляет текст предупреждения.
        
        Args:
            new_message: Новый текст предупреждения
            
        Examples:
            >>> restriction = TextMessageRestriction()
            >>> restriction.update_warning_message("Пожалуйста, используйте кнопки меню!")
        """
        self.warning_message = new_message
        self.logger.info(f"Текст предупреждения обновлён: '{new_message[:30]}...'")
    
    def add_allowed_command(self, command: str):
        """
        Добавляет команду в список разрешённых.
        
        Args:
            command: Команда для добавления (например, '/settings')
            
        Examples:
            >>> restriction = TextMessageRestriction()
            >>> restriction.add_allowed_command('/settings')
        """
        if command not in self.allowed_commands:
            self.allowed_commands.append(command)
            self.logger.info(f"Добавлена разрешённая команда: {command}")
    
    def remove_allowed_command(self, command: str):
        """
        Удаляет команду из списка разрешённых.
        
        Args:
            command: Команда для удаления
            
        Examples:
            >>> restriction = TextMessageRestriction()
            >>> restriction.remove_allowed_command('/help')
        """
        if command in self.allowed_commands:
            self.allowed_commands.remove(command)
            self.logger.info(f"Удалена разрешённая команда: {command}")
    
    def enable(self):
        """Включает ограничение текстовых сообщений."""
        self.enabled = True
        self.logger.info("Ограничение текстовых сообщений включено")
    
    def disable(self):
        """Выключает ограничение текстовых сообщений."""
        self.enabled = False
        self.logger.info("Ограничение текстовых сообщений выключено")
    
    def is_enabled(self) -> bool:
        """
        Проверяет, включено ли ограничение.
        
        Returns:
            bool: True если ограничение включено
        """
        return self.enabled


# =============================================================================
# Глобальный экземпляр для быстрого использования
# =============================================================================

# Создаём глобальный экземпляр с настройками по умолчанию
_default_restriction = TextMessageRestriction()


def get_default_restriction() -> TextMessageRestriction:
    """
    Возвращает глобальный экземпляр ограничителя с настройками по умолчанию.
    
    Returns:
        TextMessageRestriction: Глобальный экземпляр ограничителя
        
    Examples:
        >>> from text_message_restrictions import get_default_restriction
        >>> restriction = get_default_restriction()
        >>> restriction.should_restrict("Привет")
        True
    """
    return _default_restriction


def configure_default_restriction(
    warning_message: Optional[str] = None,
    allowed_commands: Optional[List[str]] = None,
    enabled: Optional[bool] = None
):
    """
    Конфигурирует глобальный экземпляр ограничителя.
    
    Args:
        warning_message: Новый текст предупреждения (опционально)
        allowed_commands: Новый список разрешённых команд (опционально)
        enabled: Новое состояние включения (опционально)
        
    Examples:
        >>> configure_default_restriction(
        ...     warning_message="Используйте кнопки! 🎛️",
        ...     allowed_commands=['/start', '/help', '/settings']
        ... )
    """
    global _default_restriction
    
    if warning_message is not None:
        _default_restriction.update_warning_message(warning_message)
    
    if allowed_commands is not None:
        _default_restriction.allowed_commands = allowed_commands
    
    if enabled is not None:
        if enabled:
            _default_restriction.enable()
        else:
            _default_restriction.disable()


# =============================================================================
# Декоратор для обработчиков сообщений
# =============================================================================

def restrict_text_messages(
    warning_message: Optional[str] = None,
    allowed_commands: Optional[List[str]] = None,
    enabled: bool = True
):
    """
    Декоратор для автоматического ограничения текстовых сообщений в обработчиках.
    
    Этот декоратор можно применять к функциям-обработчикам сообщений для
    автоматической проверки и ограничения текстовых сообщений.
    
    Args:
        warning_message: Текст предупреждения (опционально)
        allowed_commands: Список разрешённых команд (опционально)
        enabled: Включить ограничение (по умолчанию True)
        
    Examples:
        >>> @restrict_text_messages(
        ...     warning_message="Пожалуйста, используйте кнопки!",
        ...     allowed_commands=['/start', '/help']
        ... )
        ... def handle_message(bot, message):
        ...     # Обработка сообщения
        ...     pass
    """
    restriction = TextMessageRestriction(
        warning_message=warning_message or "Для управления ботом, пожалуйста, используйте кнопки ⬇️",
        allowed_commands=allowed_commands,
        enabled=enabled
    )
    
    def decorator(handler_func):
        def wrapper(bot_instance, message, *args, **kwargs):
            # Извлекаем текст из сообщения
            text = ""
            if isinstance(message, dict):
                text = message.get("text", "")
            elif hasattr(message, 'text'):
                text = message.text
            
            # Проверяем, нужно ли ограничить
            if restriction.should_restrict(text):
                # Извлекаем chat_id
                chat_id = None
                if isinstance(message, dict):
                    chat_id = message.get("chat", {}).get("id")
                elif hasattr(message, 'chat'):
                    chat_id = message.chat.id
                
                if chat_id:
                    restriction.send_warning(bot_instance, chat_id)
                    return  # Прерываем дальнейшую обработку
            
            # Вызываем оригинальный обработчик
            return handler_func(bot_instance, message, *args, **kwargs)
        
        return wrapper
    
    return decorator


# =============================================================================
# Примеры использования
# =============================================================================

if __name__ == "__main__":
    # Пример 1: Базовое использование
    print("=== Пример 1: Базовое использование ===")
    restriction = TextMessageRestriction()
    
    test_messages = [
        "/start",
        "Привет, бот!",
        "/help",
        "Как дела?",
        "/settings"
    ]
    
    for msg in test_messages:
        should_restrict = restriction.should_restrict(msg)
        print(f"Сообщение: '{msg:20}' -> {'ОГРАНИЧЕНО' if should_restrict else 'РАЗРЕШЕНО'}")
    
    print("\n=== Пример 2: Кастомное сообщение ===")
    custom_restriction = TextMessageRestriction(
        warning_message="⚠️ Пожалуйста, используйте кнопки меню для навигации!",
        allowed_commands=["/start", "/help", "/settings"]
    )
    
    print(f"Текст предупреждения: {custom_restriction.warning_message}")
    print(f"Разрешённые команды: {custom_restriction.allowed_commands}")
    
    print("\n=== Пример 3: Кастомный валидатор ===")
    
    def custom_validator(text: str) -> bool:
        """Разрешаем сообщения, содержащие 'администратор'"""
        return "администратор" in text.lower()
    
    validator_restriction = TextMessageRestriction(
        custom_validator=custom_validator
    )
    
    test_validator = [
        "Привет",
        "Вы администратор?",
        "Обратитесь к администратору"
    ]
    
    for msg in test_validator:
        should_restrict = validator_restriction.should_restrict(msg)
        print(f"Сообщение: '{msg:30}' -> {'ОГРАНИЧЕНО' if should_restrict else 'РАЗРЕШЕНО'}")
    
    print("\n=== Пример 4: Управление состоянием ===")
    state_restriction = TextMessageRestriction(enabled=False)
    print(f"Ограничение включено: {state_restriction.is_enabled()}")
    print(f"Сообщение 'Привет': {'ОГРАНИЧЕНО' if state_restriction.should_restrict('Привет') else 'РАЗРЕШЕНО'}")
    
    state_restriction.enable()
    print(f"После включения: {state_restriction.is_enabled()}")
    print(f"Сообщение 'Привет': {'ОГРАНИЧЕНО' if state_restriction.should_restrict('Привет') else 'РАЗРЕШЕНО'}")
