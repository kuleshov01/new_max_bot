#!/usr/bin/env python3
"""
Тестовый скрипт для проверки работоспособности бота
"""

import sys
import time
import threading
from bot import validate_token, get_updates, main
from config import TOKEN, BASE_URL

def test_token():
    """Тестирует валидность токена"""
    print("Проверка токена...")
    print(f"Токен в конфиге: {TOKEN[:10]}..." if len(TOKEN) > 10 else f"Токен в конфиге: {TOKEN}")
    print(f"Базовый URL: {BASE_URL}")
    
    is_valid = validate_token()
    if is_valid:
        print("✓ Токен действителен")
    else:
        print("✗ Токен недействителен или произошла ошибка при проверке")
    
    return is_valid

def test_api_connection():
    """Тестирует подключение к API"""
    print("\nПроверка подключения к API...")
    try:
        updates = get_updates()
        print(f"✓ Подключение к API успешно установлено")
        print(f"  Ответ от API: {type(updates)}")
        if "updates" in updates:
            print(f"  Количество обновлений: {len(updates['updates'])}")
        return True
    except Exception as e:
        print(f"✗ Ошибка подключения к API: {e}")
        return False

def run_bot_test():
    """Запускает бота в тестовом режиме"""
    print("\nЗапуск бота в тестовом режиме (5 секунд)...")
    
    # Запускаем бота в отдельном потоке
    bot_thread = threading.Thread(target=main, daemon=True)
    bot_thread.start()
    
    # Ждем 5 секунд
    time.sleep(5)
    
    print("Тест завершен. Проверьте файл bot.log для просмотра логов.")
    
    return True

def main_test():
    print("=== Тестирование Max Bot ===\n")
    
    # Проверяем токен
    token_ok = test_token()
    
    if not token_ok:
        print("\nТокен недействителен. Пожалуйста, проверьте его в config.py")
        print("Возможные причины проблемы:")
        print("- Неверный токен (не тот, который выдал Max)")
        print("- Токен истек")
        print("- Неверный формат токена")
        print("- Бот не активирован в Max")
        return False
    
    # Проверяем подключение к API
    api_ok = test_api_connection()
    
    if not api_ok:
        print("\nНе удалось подключиться к API. Проверьте:")
        print("- Правильность BASE_URL")
        print("- Интернет-соединение")
        print("- Блокирует ли фаервол соединение")
        return False
    
    # Запускаем тест бота
    run_bot_test()
    
    print("\n=== Тестирование завершено ===")
    print("Для полной проверки работы бота запустите его командой: python bot.py")
    print("После запуска отправьте команду /start в чат с ботом и проверьте логи в файле bot.log")
    
    return True

if __name__ == "__main__":
    success = main_test()
    if not success:
        sys.exit(1)
