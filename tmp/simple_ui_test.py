#!/usr/bin/env python3
"""
Простой тест UI для проверки работы Selenium
"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains

# Настройка
chromedriver_path = '/data/data/com.termux/files/usr/bin/chromedriver'
base_url = 'http://localhost:5000/manage'

# Настройка Chrome
options = ChromeOptions()
options.add_argument('--headless=new')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')
options.add_argument('--disable-gpu')
options.add_argument('--window-size=1920,1080')

service = Service(executable_path=chromedriver_path)
driver = webdriver.Chrome(service=service, options=options)

try:
    print("=" * 60)
    print("ТЕСТ UI: Проверка главной страницы")
    print("=" * 60)
    
    # 1. Переход на главную страницу
    print(f"\n1. Переход на {base_url}...")
    driver.get(base_url)
    time.sleep(2)
    print("   ✓ Страница загружена")
    
    # 2. Проверка заголовка
    print("\n2. Проверка заголовка страницы...")
    title = driver.title
    print(f"   Заголовок: {title}")
    if title:
        print("   ✓ Заголовок найден")
    else:
        print("   ✗ Заголовок пустой")
    
    # 3. Проверка H1
    print("\n3. Проверка заголовка H1...")
    try:
        h1 = driver.find_element(By.TAG_NAME, "h1")
        print(f"   Текст H1: {h1.text}")
        print("   ✓ Заголовок H1 найден")
    except:
        print("   ✗ Заголовок H1 не найден")
    
    # 4. Проверка кнопок
    print("\n4. Проверка кнопок...")
    buttons = driver.find_elements(By.TAG_NAME, "button")
    print(f"   Найдено кнопок: {len(buttons)}")
    for i, btn in enumerate(buttons[:5]):
        print(f"   - Кнопка {i+1}: {btn.text}")
    if len(buttons) > 0:
        print("   ✓ Кнопки найдены")
    else:
        print("   ✗ Кнопки не найдены")
    
    # 5. Проверка форм
    print("\n5. Проверка форм...")
    forms = driver.find_elements(By.TAG_NAME, "form")
    print(f"   Найдено форм: {len(forms)}")
    if len(forms) > 0:
        print("   ✓ Формы найдены")
    else:
        print("   ✗ Формы не найдены")
    
    # 6. Проверка полей ввода
    print("\n6. Проверка полей ввода...")
    inputs = driver.find_elements(By.TAG_NAME, "input")
    print(f"   Найдено полей: {len(inputs)}")
    if len(inputs) > 0:
        print("   ✓ Поля ввода найдены")
    else:
        print("   ✗ Поля ввода не найдены")
    
    # 7. Скриншот
    print("\n7. Создание скриншота...")
    screenshot_path = "/tmp/ui_test_screenshot.png"
    driver.save_screenshot(screenshot_path)
    print(f"   ✓ Скриншот сохранён: {screenshot_path}")
    
    print("\n" + "=" * 60)
    print("ТЕСТ ЗАВЕРШЁН УСПЕШНО!")
    print("=" * 60)
    
except Exception as e:
    print(f"\n✗ Ошибка: {e}")
    import traceback
    traceback.print_exc()
    
finally:
    driver.quit()
    print("\nБраузер закрыт")
