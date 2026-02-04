#!/usr/bin/env python3
"""
Удаление связи между элементами в flow editor
"""

import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Настройка
chromedriver_path = '/data/data/com.termux/files/usr/bin/chromedriver'
url = 'http://127.0.0.1:5000/manage/flow-editor?botId=9'

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
    print(f"Переход на {url}...")
    driver.get(url)
    time.sleep(2)
    
    print("Ищем SVG элементы (стрелки)...")
    # Ищем SVG элементы (линии связей)
    svg_elements = driver.find_elements(By.TAG_NAME, "svg")
    print(f"Найдено SVG элементов: {len(svg_elements)}")
    
    # Ищем линии связей в SVG
    lines = driver.find_elements(By.CSS_SELECTOR, "svg line, svg path, svg .connection-line")
    print(f"Найдено линий: {len(lines)}")
    
    if len(lines) > 0:
        # Кликаем по первой линии
        line = lines[0]
        print("Кликаем по линии...")
        # Используем ActionChains для клика по SVG элементу
        from selenium.webdriver.common.action_chains import ActionChains
        actions = ActionChains(driver)
        actions.move_to_element(line).click().perform()
        time.sleep(1)
        
        # Ищем кнопку удаления во всплывающем меню
        print("Ищем кнопку удаления...")
        delete_buttons = driver.find_elements(By.XPATH, 
            "//button[contains(text(), 'Удалить') or contains(text(), 'удалить') or contains(text(), 'Delete') or contains(@class, 'delete')]")
        
        if len(delete_buttons) > 0:
            print(f"Найдена кнопка удаления: '{delete_buttons[0].text}'")
            # Пробуем обычный клик
            try:
                delete_buttons[0].click()
                print("✓ Связь удалена (обычный клик)!")
            except Exception as e:
                print(f"Обычный клик не сработал: {e}")
                # Пробуем JavaScript клик
                try:
                    driver.execute_script("arguments[0].click();", delete_buttons[0])
                    print("✓ Связь удалена (JavaScript клик)!")
                except Exception as js_e:
                    print(f"JavaScript клик не сработал: {js_e}")
                    # Делаем скриншот для отладки
                    driver.save_screenshot("/tmp/delete_button_debug.png")
                    print("Скриншот сохранён: /tmp/delete_button_debug.png")
        else:
            print("Кнопка удаления не найдена")
            # Делаем скриншот для отладки
            driver.save_screenshot("/tmp/delete_connection_debug.png")
            print("Скриншот сохранён: /tmp/delete_connection_debug.png")
    else:
        print("Линии связей не найдены")
        # Делаем скриншот для отладки
        driver.save_screenshot("/tmp/no_connections_debug.png")
        print("Скриншот сохранён: /tmp/no_connections_debug.png")
    
    time.sleep(2)
    
finally:
    driver.quit()
    print("Браузер закрыт")
