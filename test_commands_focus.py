#!/usr/bin/env python3
"""
Тестовый скрипт для проверки поведения фокуса команд /start и /help
"""

import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

def test_commands_focus():
    """Тестирует поведение фокуса команд /start и /help"""
    
    # Настройка Chrome
    chrome_options = Options()
    chrome_options.add_argument('--headless')  # Запуск в фоновом режиме
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.binary_location = '/data/data/com.termux/files/usr/bin/chromium-browser'
    
    from selenium.webdriver.chrome.service import Service
    service = Service(executable_path='/data/data/com.termux/files/usr/bin/chromedriver')
    
    driver = webdriver.Chrome(service=service, options=chrome_options)
    
    try:
        print("🔍 Открываем панель управления ботом...")
        driver.get("http://localhost:5000/manage")
        
        # Ждем загрузки страницы
        wait = WebDriverWait(driver, 10)
        wait.until(EC.presence_of_element_located((By.ID, 'botsList')))
        
        print("✅ Страница загружена")
        
        # Находим первого бота и переходим в редактор
        print("🔍 Ищем бота для тестирования...")
        bot_cards = driver.find_elements(By.CLASS_NAME, 'bot-card')
        
        if not bot_cards:
            print("❌ Нет доступных ботов для тестирования")
            return False
        
        # Кликаем на кнопку редактора диалогов
        flow_button = driver.find_element(By.CSS_SELECTOR, 'a[href*="flow-editor"]')
        flow_button.click()
        
        print("✅ Переход в редактор диалогов")
        
        # Ждем загрузки редактора
        wait.until(EC.presence_of_element_located((By.ID, 'commandsList')))
        time.sleep(2)  # Дополнительная задержка для полной загрузки
        
        print("🔍 Проверяем список команд...")
        
        # Находим команды /start и /help
        commands = driver.find_elements(By.CLASS_NAME, 'command-item')
        command_names = [cmd.find_element(By.CLASS_NAME, 'command-header').find_element(By.TAG_NAME, 'strong').text for cmd in commands]
        
        print(f"📋 Найденные команды: {command_names}")
        
        # Проверяем наличие команд /start и /help
        start_command = None
        help_command = None
        
        for cmd in commands:
            cmd_name = cmd.find_element(By.CLASS_NAME, 'command-header').find_element(By.TAG_NAME, 'strong').text
            if cmd_name == '/start':
                start_command = cmd
            elif cmd_name == '/help':
                help_command = cmd
        
        if not start_command:
            print("❌ Команда /start не найдена")
            return False
        
        if not help_command:
            print("⚠️ Команда /help не найдена (возможно, не создана)")
            print("ℹ️ Тест будет продолжен только с командой /start")
        
        # Тестируем команду /start
        print("\n🧪 Тестируем команду /start...")
        
        # Кликаем на /start
        start_command.click()
        time.sleep(1)
        
        # Проверяем, что /start активен
        start_classes = start_command.get_attribute('class')
        print(f"📋 Классы /start после клика: {start_classes}")
        
        if 'active' in start_classes:
            print("✅ /start активен после клика")
        else:
            print("❌ /start НЕ активен после клика")
            return False
        
        # Проверяем цвет текста
        start_text_color = start_command.find_element(By.CLASS_NAME, 'command-header').find_element(By.TAG_NAME, 'strong').value_of_css_property('color')
        print(f"🎨 Цвет текста /start: {start_text_color}")
        
        # Кликаем в другом месте (на канвас)
        print("\n🖱️ Кликаем на канвас...")
        canvas = driver.find_element(By.ID, 'flowCanvas')
        driver.execute_script("arguments[0].click();", canvas)
        time.sleep(1)
        
        # Проверяем, что /start всё еще активен
        start_classes_after = start_command.get_attribute('class')
        print(f"📋 Классы /start после клика на канвас: {start_classes_after}")
        
        if 'active' in start_classes_after:
            print("✅ /start остается активным после клика на канвас")
        else:
            print("❌ /start потерял активность после клика на канвас")
            return False
        
        # Проверяем цвет текста после клика на канвас
        start_text_color_after = start_command.find_element(By.CLASS_NAME, 'command-header').find_element(By.TAG_NAME, 'strong').value_of_css_property('color')
        print(f"🎨 Цвет текста /start после клика на канвас: {start_text_color_after}")
        
        if help_command:
            # Тестируем команду /help
            print("\n🧪 Тестируем команду /help...")
            
            # Кликаем на /help
            help_command.click()
            time.sleep(1)
            
            # Проверяем, что /help активен
            help_classes = help_command.get_attribute('class')
            print(f"📋 Классы /help после клика: {help_classes}")
            
            if 'active' in help_classes:
                print("✅ /help активен после клика")
            else:
                print("❌ /help НЕ активен после клика")
                return False
            
            # Проверяем цвет текста
            help_text_color = help_command.find_element(By.CLASS_NAME, 'command-header').find_element(By.TAG_NAME, 'strong').value_of_css_property('color')
            print(f"🎨 Цвет текста /help: {help_text_color}")
            
            # Кликаем в другом месте (на канвас)
            print("\n🖱️ Кликаем на канвас...")
            driver.execute_script("arguments[0].click();", canvas)
            time.sleep(1)
            
            # Проверяем, что /help всё еще активен
            help_classes_after = help_command.get_attribute('class')
            print(f"📋 Классы /help после клика на канвас: {help_classes_after}")
            
            if 'active' in help_classes_after:
                print("✅ /help остается активным после клика на канвас")
            else:
                print("❌ /help потерял активность после клика на канвас")
                return False
            
            # Проверяем цвет текста после клика на канвас
            help_text_color_after = help_command.find_element(By.CLASS_NAME, 'command-header').find_element(By.TAG_NAME, 'strong').value_of_css_property('color')
            print(f"🎨 Цвет текста /help после клика на канвас: {help_text_color_after}")
            
            # Проверяем, что цвет фиолетовый (примерно #667eea или rgb(102, 126, 234))
            if 'rgb(102, 126, 234)' in help_text_color_after or 'rgb(102,126,234)' in help_text_color_after:
                print("✅ /help сохраняет фиолетовый цвет текста")
            else:
                print(f"⚠️ /help имеет цвет: {help_text_color_after} (ожидается фиолетовый)")
        
        print("\n✅ Все тесты пройдены успешно!")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка при тестировании: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        driver.quit()

if __name__ == "__main__":
    print("🚀 Запуск тестирования поведения фокуса команд...\n")
    success = test_commands_focus()
    
    if success:
        print("\n🎉 Тестирование завершено успешно!")
        exit(0)
    else:
        print("\n💥 Тестирование завершено с ошибками!")
        exit(1)
