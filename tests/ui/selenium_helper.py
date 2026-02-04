#!/usr/bin/env python3
"""
Обёртка для Selenium с обязательными параметрами для Termux
Эти параметры ОБЯЗАТЕЛЬНЫ для работы в Termux!
"""

import sys
import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# ОБЯЗАТЕЛЬНЫЕ параметры для Termux
TERMUX_CHROME_ARGS = [
    '--headless=new',        # Headless режим
    '--no-sandbox',          # ОБЯЗАТЕЛЬНО для Termux
    '--disable-gpu',         # ОБЯЗАТЕЛЬНО для Termux
    '--disable-dev-shm-usage', # ОБЯЗАТЕЛЬНО для Termux
    '--disable-dev-tools',    # Отключает DevTools
    '--no-zygote',           # Отключает zygote
    '--single-process',      # Один процесс
    '--window-size=1920,1080' # Размер окна
]

# Путь к ChromeDriver в Termux
CHROMEDRIVER_PATH = '/data/data/com.termux/files/usr/bin/chromedriver'


def create_driver(headless: bool = True) -> webdriver.Chrome:
    """
    Создаёт WebDriver с ОБЯЗАТЕЛЬНЫМИ параметрами для Termux
    
    Args:
        headless: Использовать headless режим (по умолчанию True)
    
    Returns:
        Инициализированный WebDriver
    """
    options = ChromeOptions()
    
    # Добавляем ОБЯЗАТЕЛЬНЫЕ аргументы
    for arg in TERMUX_CHROME_ARGS:
        options.add_argument(arg)
    
    # Если не headless, убираем headless аргумент
    if not headless:
        options.arguments.remove('--headless=new')
    
    # Создаём сервис с путём к ChromeDriver
    service = Service(executable_path=CHROMEDRIVER_PATH)
    
    # Инициализируем драйвер
    driver = webdriver.Chrome(service=service, options=options)
    
    return driver


def get_driver_with_defaults(base_url: str = None):
    """
    Создаёт WebDriver с настройками по умолчанию для Termux
    
    Args:
        base_url: Опциональный URL для перехода
    
    Returns:
        Инициализированный WebDriver
    """
    driver = create_driver(headless=True)
    
    if base_url:
        driver.get(base_url)
    
    return driver


# Пример использования
if __name__ == "__main__":
    print("Создаём WebDriver с обязательными параметрами для Termux...")
    
    # Проверяем, что Flask запущен
    import subprocess
    import time
    
    # Проверяем, запущен ли Flask
    try:
        import urllib.request
        urllib.request.urlopen("http://localhost:5000/manage", timeout=2)
        print("✓ Flask приложение запущено")
    except:
        print("Запускаем Flask приложение...")
        env = os.environ.copy()
        env['APPLICATION_ROOT'] = '/manage'
        subprocess.Popen(
            [sys.executable, 'src/app.py'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=env
        )
        time.sleep(3)
    
    driver = get_driver_with_defaults("http://localhost:5000/manage")
    
    print(f"✓ Заголовок страницы: {driver.title}")
    
    driver.quit()
    print("✓ Тест пройден!")
