#!/usr/bin/env python3
"""
Тест проверки сохранения пустого flow
"""
import requests
import json

BASE_URL = "http://localhost:5000"

def test_empty_flow():
    print("=== Тест 1: Создание бота с начальным flow ===")
    
    # Создание бота
    bot_data = {
        "name": "Test Bot",
        "token": "test_token_123"
    }
    response = requests.post(f"{BASE_URL}/api/bots", json=bot_data)
    
    if response.status_code == 201:
        bot = response.json()
        bot_id = bot['id']
        print(f"✓ Бот создан с ID: {bot_id}")
        print(f"  Имя: {bot['name']}")
    else:
        print(f"✗ Не удалось создать бота: {response.text}")
        return
    
    # Загрузка flow
    response = requests.get(f"{BASE_URL}/api/bots/{bot_id}/flow")
    flow = response.json()
    print(f"  Текущий flow содержит {len(flow.get('nodes', []))} узлов")
    if flow.get('nodes'):
        for node in flow['nodes']:
            print(f"    - ID: {node['id']}, Тип: {node['type']}")
    
    print("\n=== Тест 2: Удаление всех узлов и попытка сохранить пустой flow ===")
    
    # Удаляем все узлы
    empty_flow = {"nodes": [], "connections": []}
    response = requests.post(f"{BASE_URL}/api/bots/{bot_id}/flow", json=empty_flow)
    
    if response.status_code == 400:
        print("✓ Сохранение пустого flow отклонено с кодом 400")
        error_data = response.json()
        print(f"  Ошибка: {error_data.get('error', 'Неизвестная ошибка')}")
    else:
        print(f"✗ Сохранение пустого flow должно быть запрещено, но получен статус: {response.status_code}")
        print(f"  Ответ: {response.text}")
    
    print("\n=== Тест 3: Восстановление flow с одним узлом ===")
    
    # Создаем новый flow с одним узлом
    valid_flow = {
        "nodes": [
            {
                "id": "start",
                "type": "message",
                "x": 100,
                "y": 100,
                "text": "Привет!",
                "buttons": [],
                "isStart": True
            }
        ],
        "connections": []
    }
    
    response = requests.post(f"{BASE_URL}/api/bots/{bot_id}/flow", json=valid_flow)
    
    if response.status_code == 200:
        print("✓ Flow с одним узлом сохранен успешно")
        flow = response.json()
        print(f"  Сохранено узлов: {len(flow.get('nodes', []))}")
    else:
        print(f"✗ Не удалось сохранить valid flow: {response.text}")
    
    print("\n=== Тест 4: Попытка удалить start-узел и сохранить ===")
    
    # Удаляем start-узел
    flow_without_start = {
        "nodes": [
            {
                "id": "node_1",
                "type": "message",
                "x": 100,
                "y": 100,
                "text": "Привет!",
                "buttons": [],
                "isStart": False
            }
        ],
        "connections": []
    }
    
    response = requests.post(f"{BASE_URL}/api/bots/{bot_id}/flow", json=flow_without_start)
    
    if response.status_code == 400:
        print("✓ Сохранение flow без start-узла отклонено с кодом 400")
        error_data = response.json()
        print(f"  Ошибка: {error_data.get('error', 'Неизвестная ошибка')}")
    else:
        print(f"✗ Сохранение flow без start-узла должно быть запрещено, но получен статус: {response.status_code}")
        print(f"  Ответ: {response.text}")
    
    print("\n=== Все тесты завершены ===")

if __name__ == "__main__":
    try:
        test_empty_flow()
    except requests.exceptions.ConnectionError:
        print("Не удалось подключиться к серверу. Запустите сервер командой: python src/app.py")
    except Exception as e:
        print(f"Произошла ошибка: {e}")
