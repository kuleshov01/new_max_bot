#!/usr/bin/env python3
"""
Тестовый скрипт для проверки метода получения информации о боте
"""

import sys
from bot import get_bot_info, validate_token
from config import TOKEN

def test_get_bot_info():
    """Тестирует метод получения информации о боте"""
    print("Тестирование метода get_bot_info()...")
    print(f"Токен в конфиге: {TOKEN[:10]}..." if len(TOKEN) > 10 else f"Токен в конфиге: {TOKEN}")
    
    # Проверяем, действителен ли токен
    is_valid = validate_token()
    if not is_valid:
        print("❌ Токен недействителен. Невозможно получить информацию о боте.")
        print("Пожалуйста, обновите токен в config.py и повторите попытку.")
        return False
    
    # Получаем информацию о боте
    bot_info = get_bot_info()
    
    if bot_info:
        print("✅ Информация о боте успешно получена:")
        print(f"   Данные: {bot_info}")
        return True
    else:
        print("❌ Не удалось получить информацию о боте.")
        print("   Это может быть связано с тем, что:")
        print("   - Используется неправильный endpoint API")
        print("   - Токен действителен, но у него нет прав на получение информации о боте")
        print("   - Endpoint /me не поддерживается API Max")
        return False

def main():
    print("=== Тестирование метода получения информации о боте ===\n")
    
    success = test_get_bot_info()
    
    print("\n=== Результат тестирования ===")
    if success:
        print("✓ Метод get_bot_info работает корректно")
    else:
        print("✗ Метод get_bot_info не работает или токен недействителен")
        
    return success

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)
