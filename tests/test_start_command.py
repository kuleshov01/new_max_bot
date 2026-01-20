#!/usr/bin/env python3
"""
Тестирование команды /start для проверки, что бот отправляет приветственное сообщение
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bot import handle_message
import logging

# Настройка логирования для теста
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

def test_start_command():
    """
    Тестируем обработку команды /start
    """
    print("Тестируем команду /start...")
    
    # Создаем тестовое сообщение
    test_message = {
        "chat": {
            "id": 77189217  # используем тот же ID чата из вашего примера
        },
        "text": "/start"
    }
    
    try:
        # Вызываем обработчик сообщения
        handle_message(test_message)
        print("Команда /start успешно обработана")
    except Exception as e:
        print(f"Ошибка при обработке команды /start: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_start_command()
