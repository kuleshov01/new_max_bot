#!/usr/bin/env python3
"""
Скрипт для проверки конфигурации бота перед запуском
"""

import sys
import os
from config import TOKEN, BASE_URL, APP_PAYLOAD

def check_config():
    """Проверяет конфигурацию бота"""
    print("Проверка конфигурации бота...\n")
    
    # Проверяем токен
    print(f"1. Проверка токена:")
    print(f"   Токен длиной: {len(TOKEN)} символов")
    
    if len(TOKEN) < 20:
        print("   ⚠️  Токен слишком короткий, возможно, он неправильный")
        token_ok = False
    elif TOKEN.startswith("your_") or TOKEN == "f9LHodD0cOLbrqZQQB8FJPQRbOXS69PJaSxyy7TinCoXhWHGZPqYagJJPHDDHJotUx_zNsyjKSW6V1CvJ_GI":
        print("   ❌ Токен не изменен с примера по умолчанию")
        token_ok = False
    else:
        print("   ✓ Токен имеет правдоподобную длину")
        token_ok = True
        
    print()
    
    # Проверяем BASE_URL
    print(f"2. Проверка BASE_URL:")
    print(f"   URL: {BASE_URL}")
    
    if BASE_URL == "https://platform-api.max.ru":
        print("   ✓ Используется стандартный URL API Max")
        url_ok = True
    else:
        print("   ⚠️  Используется нестандартный URL API Max")
        url_ok = True  # Это не обязательно ошибка
        
    print()
    
    # Проверяем APP_PAYLOAD
    print(f"3. Проверка APP_PAYLOAD:")
    print(f"   Payload: {APP_PAYLOAD}")
    
    if APP_PAYLOAD == "app_id_here":
        print("   ⚠️  APP_PAYLOAD не изменен с примера по умолчанию")
        payload_ok = False
    else:
        print("   ✓ APP_PAYLOAD изменен")
        payload_ok = True
        
    print()
    
    # Сводка
    print("4. Сводка:")
    all_ok = token_ok and url_ok and payload_ok
    
    if all_ok:
        print("   ✓ Все настройки выглядят корректно")
        print("   Вы можете запустить бота командой: python3 bot.py")
    else:
        print("   ❌ Обнаружены проблемы с настройками:")
        if not token_ok:
            print("      - Проблема с токеном")
        if not payload_ok:
            print("      - APP_PAYLOAD не настроен")
        print("\n   Пожалуйста, исправьте проблемы перед запуском бота")
    
    return all_ok

if __name__ == "__main__":
    success = check_config()
    if not success:
        sys.exit(1)
