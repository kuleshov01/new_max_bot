#!/usr/bin/env python3
"""
Простой тест для проверки обработки сообщений ботом
"""

import sys
from unittest.mock import patch
from bot import handle_message

def test_handle_message():
    """Тестирует обработку сообщений"""
    print("Тестирование обработки сообщений...")
    
    # Подготовим тестовое сообщение
    test_message = {
        "chat": {
            "id": "test_chat_123"
        },
        "text": "/start"
    }
    
    # Мокнем функцию send_message, чтобы проверить, вызывается ли она
    with patch("bot.send_message") as mock_send_message:
        mock_send_message.return_value = {"status": "success"}
        
        # Вызовем обработчик сообщения
        handle_message(test_message)
        
        # Проверим, была ли вызвана функция отправки сообщения
        if not mock_send_message.called:
            print("❌ Функция send_message не была вызвана при обработке /start")
            return False
        
        # Проверим, что отправленное сообщение содержит ожидаемый текст
        args, kwargs = mock_send_message.call_args
        chat_id, text = args[0], args[1]
        
        if "Здравствуйте!" not in text:
            print(f"❌ Ожидаемый текст не найден в ответе: {text}")
            return False
            
        if chat_id != "test_chat_123":
            print(f"❌ Неправильный chat_id: {chat_id}")
            return False
        
        print("✅ Обработка команды /start работает корректно")
        print(f"   Отправлено сообщение в чат {chat_id}")
        print(f"   Текст сообщения (первые 100 символов): {text[:100]}...")
    
    return True

def main():
    print("=== Тестирование обработки сообщений ботом ===\n")
    
    success = test_handle_message()
    
    print(f"\n=== Результат тестирования ===")
    if success:
        print("✅ Тест пройден успешно")
        print("   Логика обработки сообщений работает корректно")
        print("   Проблема может быть связана с получением обновлений от API")
    else:
        print("❌ Тест не пройден")
        
    return success

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)
