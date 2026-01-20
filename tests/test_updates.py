#!/usr/bin/env python3
"""
Тест для проверки получения обновлений ботом
"""

import time
from bot import get_updates, main
from threading import Thread

def test_get_updates():
    """Тестирует получение обновлений"""
    print("Тестирование получения обновлений...")
    
    # Получим обновления без смещения
    updates = get_updates()
    
    print(f"Структура ответа: {type(updates)}")
    if isinstance(updates, dict):
        print(f"Ключи в ответе: {list(updates.keys())}")
        
        if "updates" in updates:
            print(f"Количество обновлений: {len(updates['updates'])}")
            if updates["updates"]:
                print(f"Первое обновление: {updates['updates'][0]}")
            else:
                print("Нет новых обновлений (это нормально, если никто не пишет боту)")
        else:
            print(f"Поле 'updates' отсутствует в ответе, весь ответ: {updates}")
    else:
        print(f"Ответ не является словарем: {updates}")
    
    return True

def simulate_long_polling():
    """Симуляция long polling"""
    print("\nСимуляция получения обновлений в течение 10 секунд...")
    
    start_time = time.time()
    offset = None
    
    while time.time() - start_time < 10:
        print(f"[{time.strftime('%H:%M:%S')}] Запрашиваем обновления с offset={offset}")
        updates = get_updates(offset)
        
        if isinstance(updates, dict) and "updates" in updates:
            if updates["updates"]:
                print(f"   ✅ Получено {len(updates["updates"])} обновлений")
                for update in updates["updates"]:
                    print(f"     - Обновление ID: {update.get('update_id', 'N/A')}")
                    if "message" in update:
                        msg = update["message"]
                        print(f"       Сообщение от чата {msg.get('chat', {}).get('id', 'N/A')} с текстом: {msg.get('text', 'N/A')[:50]}")
                        offset = update["update_id"] + 1
                    elif "callback" in update:
                        cb = update["callback"]
                        print(f"       Callback ID: {cb.get('id', 'N/A')}, payload: {cb.get('payload', 'N/A')}")
                        offset = update["update_id"] + 1
            else:
                print("   ❌ Нет новых обновлений")
        else:
            print(f"   ❌ Ошибка в ответе: {updates}")
            
        time.sleep(2)  # Пауза между запросами
    
    print("Завершено")
    return True

def main_test():
    print("=== Тестирование получения обновлений ===\n")
    
    test_get_updates()
    simulate_long_polling()
    
    print("\n=== Вывод ===")
    print("Если бот не получает обновления, возможные причины:")
    print("1. Никто не отправлял сообщения боту")
    print("2. Проблемы с API Max")
    print("3. Проблемы с сетью или брандмауэром")
    print("4. Бот не зарегистрирован должным образом в Max")
    print("5. Используется неправильный URL API")

if __name__ == "__main__":
    main_test()
