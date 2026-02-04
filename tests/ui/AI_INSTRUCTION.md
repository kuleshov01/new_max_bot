# 🤖 Инструкция для ИИ: UI Тестирование с Selenium

Эта инструкция предназначена для ИИ-агента, который выполняет задачи по UI тестированию веб-интерфейса Max Bot Manager с помощью Selenium.

## 📋 Общая информация

**Проект:** Max Bot Manager - Flask веб-приложение для управления Telegram ботами

**Базовый URL:** `http://localhost:5000/manage`

**Язык программирования:** Python 3.8+

**Основной инструмент:** Selenium WebDriver с Chrome/Chromium

## 🎯 Типовые задачи

ИИ-агент может получать следующие типы задач:

1. **Проверка элемента:** "Протестируй кнопку на главной странице, не нажимается"
2. **Проверка формы:** "Проверь форму создания бота, поля не заполняются"
3. **Проверка страницы:** "Протестируй страницу редактора flow"
4. **Проверка функционала:** "Проверь, что бот добавляется в список"
5. **Проверка ошибок:** "Найди все JavaScript ошибки на странице"
6. **Проверка responsive:** "Проверь отображение на мобильных устройствах"

## 🚀 Алгоритм выполнения задачи

### Шаг 1: Анализ задачи

Прочитайте задачу и определите:
- **Что проверяем:** кнопку, форму, страницу, функционал
- **Где проверяем:** URL страницы или элемент
- **Какая проблема:** не нажимается, не отображается, не работает и т.д.
- **Какой ожидаемый результат:** что должно происходить в норме

### Шаг 2: Подготовка окружения

Всегда начинайте с проверки и установки зависимостей:

```bash
# Проверяем Python
python --version

# Проверяем Selenium
pip show selenium

# Если не установлен, устанавливаем
pip install selenium

# Проверяем Chromium
ls -la /data/data/com.termux/files/usr/bin/chromium-browser
ls -la /data/data/com.termux/files/usr/bin/chromedriver

# Если chromedriver нет, переустанавливаем chromium
pkg reinstall chromium
```

### Шаг 3: Создание тестового скрипта

Создайте Python скрипт с именем, отражающим суть задачи:

```bash
# Примеры имён файлов:
test_button_click.py          # Для тестирования кнопки
test_form_validation.py       # Для тестирования формы
test_page_load.py             # Для тестирования загрузки страницы
test_responsive_mobile.py     # Для тестирования мобильной версии
```

### Шаг 4: Базовая структура скрипта

Используйте этот шаблон для любого теста:

```python
#!/usr/bin/env python3
"""
Описание теста: [краткое описание того, что тестируем]
Задача: [текст исходной задачи]
"""

import sys
import os
import time
import subprocess
from typing import List, Dict, Any

# Конфигурация
BASE_URL = "http://localhost:5000"
APPLICATION_ROOT = "/manage"
FULL_BASE_URL = f"{BASE_URL}{APPLICATION_ROOT}"

# Импортируем Selenium
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# Цвета для вывода
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.END}")

def print_error(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.END}")

def print_info(message: str):
    print(f"{Colors.BLUE}ℹ {message}{Colors.END}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.END}")

def print_header(message: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{message}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}\n")

def print_bug(title: str, description: str, severity: str = "MEDIUM"):
    """Выводит найденный баг"""
    severity_colors = {
        "LOW": Colors.BLUE,
        "MEDIUM": Colors.YELLOW,
        "HIGH": Colors.RED,
        "CRITICAL": f"{Colors.BOLD}{Colors.RED}"
    }
    color = severity_colors.get(severity, Colors.YELLOW)
    print(f"\n{color}🐛 БАГ ОБНАРУЖЕН [{severity}]{Colors.END}")
    print(f"{Colors.BOLD}Название:{Colors.END} {title}")
    print(f"{Colors.BOLD}Описание:{Colors.END} {description}")
    print()

class UITester:
    """Класс для UI тестирования с Selenium"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.driver = None
        self.bugs_found = []
        self.By = None
        self.WebDriverWait = None
        self.EC = None
    
    def init_driver(self) -> bool:
        """Инициализирует Selenium WebDriver"""
        try:
            print_info("Инициализация Selenium WebDriver...")
            
            options = ChromeOptions()
            options.add_argument('--headless=new')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--disable-dev-tools')
            options.add_argument('--no-zygote')
            options.add_argument('--single-process')
            options.add_argument('--window-size=1920,1080')
            
            # Путь к chromedriver в Termux
            chromedriver_path = '/data/data/com.termux/files/usr/bin/chromedriver'
            
            service = Service(executable_path=chromedriver_path)
            self.driver = webdriver.Chrome(service=service, options=options)
            
            # Сохраняем ссылки для удобства
            self.By = By
            self.WebDriverWait = WebDriverWait
            self.EC = EC
            
            print_success("WebDriver инициализирован успешно")
            return True
        except Exception as e:
            print_error(f"Не удалось инициализировать WebDriver: {e}")
            return False
    
    def wait_for_element(self, by, value, timeout=10):
        """Ожидает появления элемента"""
        return self.WebDriverWait(self.driver, timeout).until(
            self.EC.presence_of_element_located((by, value))
        )
    
    def wait_for_clickable(self, by, value, timeout=10):
        """Ожидает, что элемент можно кликнуть"""
        return self.WebDriverWait(self.driver, timeout).until(
            self.EC.element_to_be_clickable((by, value))
        )
    
    def take_screenshot(self, name: str):
        """Делает скриншот"""
        try:
            filename = f"screenshot_{name}_{int(time.time())}.png"
            self.driver.save_screenshot(filename)
            print_info(f"Скриншот сохранён: {filename}")
        except Exception as e:
            print_warning(f"Не удалось сохранить скриншот: {e}")
    
    def go_to_page(self, url: str):
        """Переходит на страницу"""
        print_info(f"Переход на страницу: {url}")
        self.driver.get(url)
        time.sleep(1)  # Даём странице загрузиться
    
    def find_element_safe(self, by, value, description=""):
        """Безопасно ищет элемент"""
        try:
            element = self.driver.find_element(by, value)
            print_success(f"Элемент найден: {description}")
            return element
        except NoSuchElementException:
            print_error(f"Элемент НЕ найден: {description}")
            return None
        except Exception as e:
            print_error(f"Ошибка при поиске элемента: {e}")
            return None
    
    def find_elements_safe(self, by, value, description=""):
        """Безопасно ищет несколько элементов"""
        try:
            elements = self.driver.find_elements(by, value)
            print_info(f"Найдено элементов: {len(elements)} - {description}")
            return elements
        except Exception as e:
            print_error(f"Ошибка при поиске элементов: {e}")
            return []
    
    def is_element_visible(self, element) -> bool:
        """Проверяет, виден ли элемент"""
        try:
            return element.is_displayed()
        except:
            return False
    
    def is_element_enabled(self, element) -> bool:
        """Проверяет, активен ли элемент"""
        try:
            return element.is_enabled()
        except:
            return False
    
    def click_element_safe(self, element, description=""):
        """Безопасно кликает на элемент"""
        try:
            element.click()
            print_success(f"Клик выполнен: {description}")
            return True
        except Exception as e:
            print_error(f"Не удалось кликнуть: {description} - {e}")
            return False
    
    def get_element_text(self, element) -> str:
        """Получает текст элемента"""
        try:
            return element.text
        except:
            return ""
    
    def get_element_attribute(self, element, attribute: str) -> str:
        """Получает атрибут элемента"""
        try:
            return element.get_attribute(attribute) or ""
        except:
            return ""
    
    # ========================================
    # ТЕСТОВЫЕ МЕТОДЫ - добавляйте сюда свои тесты
    # ========================================
    
    def test_your_functionality(self) -> bool:
        """
        ОПИСАНИЕ: Что тестируем
        ОЖИДАЕМЫЙ РЕЗУЛЬТАТ: Что должно произойти
        """
        print_header("ТЕСТ: [Название теста]")
        bugs = []
        
        try:
            # Ваш код теста здесь
            
            # Пример структуры:
            # 1. Переход на страницу
            self.go_to_page(self.base_url)
            
            # 2. Поиск элемента
            element = self.find_element_safe(self.By.ID, "my-button", "Кнопка")
            
            if element is None:
                bugs.append({
                    "title": "Элемент не найден",
                    "description": "Кнопка с ID 'my-button' не найдена на странице",
                    "severity": "HIGH"
                })
                return False
            
            # 3. Проверка элемента
            if not self.is_element_visible(element):
                bugs.append({
                    "title": "Элемент не виден",
                    "description": "Кнопка существует, но не отображается",
                    "severity": "HIGH"
                })
            
            if not self.is_element_enabled(element):
                bugs.append({
                    "title": "Элемент не активен",
                    "description": "Кнопка отображается, но не кликабельна",
                    "severity": "HIGH"
                })
            
            # 4. Действие с элементом
            if self.click_element_safe(element, "Кнопка"):
                time.sleep(1)
                # Проверяем результат действия
                # ...
            
            # Выводим найденные баги
            for bug in bugs:
                print_bug(bug["title"], bug["description"], bug["severity"])
                self.bugs_found.append(bug)
            
            return len(bugs) == 0
            
        except Exception as e:
            print_error(f"Ошибка при выполнении теста: {e}")
            self.take_screenshot("test_error")
            return False
    
    def close(self):
        """Закрывает драйвер"""
        if self.driver:
            self.driver.quit()
            print_info("WebDriver закрыт")

def start_flask_app():
    """Запускает Flask приложение"""
    print_info("Запуск Flask приложения...")
    
    env = os.environ.copy()
    env['APPLICATION_ROOT'] = '/manage'
    
    try:
        process = subprocess.Popen(
            [sys.executable, 'src/app.py'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=env
        )
        
        time.sleep(5)
        
        if process.poll() is None:
            print_success(f"Flask приложение запущено (PID: {process.pid})")
            return process
        else:
            print_error("Flask приложение не запустилось")
            return None
    except Exception as e:
        print_error(f"Ошибка запуска: {e}")
        return None

def main():
    """Главная функция"""
    print_header("UI ТЕСТИРОВАНИЕ")
    print_info(f"Базовый URL: {FULL_BASE_URL}")
    
    # Запускаем Flask приложение
    flask_process = start_flask_app()
    if not flask_process:
        print_error("Не удалось запустить Flask приложение")
        return 1
    
    try:
        # Инициализируем UI тестер
        tester = UITester(FULL_BASE_URL)
        
        if not tester.init_driver():
            print_error("Не удалось инициализировать WebDriver")
            return 1
        
        try:
            # Запускаем тест
            if tester.test_your_functionality():
                print_success("ТЕСТ ПРОЙДЕН")
                return 0
            else:
                print_error("ТЕСТ НЕ ПРОЙДЕН")
                return 1
            
        finally:
            tester.close()
    
    finally:
        # Останавливаем Flask приложение
        if flask_process:
            print_info("Остановка Flask приложения...")
            flask_process.terminate()
            flask_process.wait(timeout=5)
            print_success("Flask приложение остановлено")

if __name__ == "__main__":
    sys.exit(main())
```

## 🔍 Поиск элементов

### Поиск по ID

```python
# Ожидание появления элемента по ID
element = tester.wait_for_element(tester.By.ID, "my-button")

# Прямой поиск
element = tester.find_element_safe(tester.By.ID, "submit-btn", "Кнопка отправки")
```

### Поиск по классу

```python
# Поиск одного элемента по классу
element = tester.find_element_safe(tester.By.CLASS_NAME, "btn-primary", "Главная кнопка")

# Поиск нескольких элементов по классу
elements = tester.find_elements_safe(tester.By.CLASS_NAME, "bot-item", "Список ботов")
```

### Поиск по тегу

```python
# Поиск всех кнопок
buttons = tester.find_elements_safe(tester.By.TAG_NAME, "button", "Кнопки")

# Поиск всех полей ввода
inputs = tester.find_elements_safe(tester.By.TAG_NAME, "input", "Поля ввода")

# Поиск заголовка H1
h1 = tester.find_element_safe(tester.By.TAG_NAME, "h1", "Заголовок")
```

### Поиск по имени

```python
# Поиск по атрибуту name
element = tester.find_element_safe(tester.By.NAME, "username", "Поле username")
```

### Поиск по XPath

```python
# Поиск кнопки по тексту
element = tester.find_element_safe(
    tester.By.XPATH, 
    "//button[contains(text(), 'Создать')]",
    "Кнопка создания"
)

# Поиск по атрибуту
element = tester.find_element_safe(
    tester.By.XPATH,
    "//input[@type='submit']",
    "Кнопка отправки формы"
)

# Поиск по классу и тексту
element = tester.find_element_safe(
    tester.By.XPATH,
    "//div[@class='bot-item']//span[text()='Мой бот']",
    "Элемент бота"
)

# Сложный XPath с несколькими условиями
element = tester.find_element_safe(
    tester.By.XPATH,
    "//button[contains(@class, 'btn') and contains(text(), 'Сохранить')]",
    "Кнопка сохранения"
)
```

### Поиск по CSS селектору

```python
# Поиск по ID
element = tester.find_element_safe(tester.By.CSS_SELECTOR, "#submit-btn", "Кнопка")

# Поиск по классу
element = tester.find_element_safe(tester.By.CSS_SELECTOR, ".btn-primary", "Кнопка")

# Поиск по атрибуту
element = tester.find_element_safe(tester.By.CSS_SELECTOR, "input[type='text']", "Поле ввода")

# Сложный селектор
element = tester.find_element_safe(
    tester.By.CSS_SELECTOR,
    "div.bot-item > button.btn-delete",
    "Кнопка удаления"
)

# Поиск по нескольким классам
element = tester.find_element_safe(
    tester.By.CSS_SELECTOR,
    "button.btn.btn-primary.btn-large",
    "Большая кнопка"
)
```

## 🧪 Проверки элементов

### Проверка видимости

```python
if not tester.is_element_visible(element):
    bugs.append({
        "title": "Элемент не виден",
        "description": "Элемент существует в DOM, но не отображается на странице",
        "severity": "HIGH"
    })
```

### Проверка активности

```python
if not tester.is_element_enabled(element):
    bugs.append({
        "title": "Элемент неактивен",
        "description": "Элемент отображается, но отключён (disabled)",
        "severity": "HIGH"
    })
```

### Проверка кликабельности

```python
try:
    # Ожидаем, что элемент можно кликнуть
    clickable_element = tester.wait_for_clickable(tester.By.ID, "my-button", timeout=5)
    print_success("Элемент кликабелен")
except TimeoutException:
    bugs.append({
        "title": "Элемент не кликабелен",
        "description": "Элемент не становится кликабельным даже после ожидания",
        "severity": "HIGH"
    })
```

### Проверка текста

```python
text = tester.get_element_text(element)
expected_text = "Создать бота"

if text != expected_text:
    bugs.append({
        "title": "Неверный текст элемента",
        "description": f"Ожидается: '{expected_text}', получено: '{text}'",
        "severity": "MEDIUM"
    })
```

### Проверка атрибута

```python
href = tester.get_element_attribute(element, "href")
if not href or href == "#":
    bugs.append({
        "title": "Некорректная ссылка",
        "description": f"Ссылка не имеет href или указывает на #",
        "severity": "MEDIUM"
    })

# Проверка класса
class_attr = tester.get_element_attribute(element, "class")
if "active" not in class_attr:
    print_info("Элемент не активен")
```

### Проверка наличия элемента

```python
# Проверка, что элемент существует
element = tester.find_element_safe(tester.By.ID, "my-element")
if element is None:
    bugs.append({
        "title": "Элемент отсутствует",
        "description": "Элемент с ID 'my-element' не найден на странице",
        "severity": "HIGH"
    })

# Проверка, что элементов несколько
elements = tester.find_elements_safe(tester.By.CLASS_NAME, "bot-item")
if len(elements) == 0:
    bugs.append({
        "title": "Список пуст",
        "description": "На странице нет элементов с классом 'bot-item'",
        "severity": "MEDIUM"
    })
```

## 🖱️ Действия с элементами

### Клик по элементу

```python
# Простой клик
if tester.click_element_safe(element, "Кнопка"):
    print_success("Клик выполнен")
    time.sleep(1)  # Ждём реакции
else:
    bugs.append({
        "title": "Не удалось кликнуть",
        "description": "Элемент найден, но клик не срабатывает",
        "severity": "HIGH"
    })

# Клик с ожиданием кликабельности
try:
    clickable_element = tester.wait_for_clickable(tester.By.ID, "my-button")
    clickable_element.click()
    print_success("Клик выполнен")
except TimeoutException:
    print_error("Элемент не стал кликабельным")
```

### Ввод текста в поле

```python
# Очистка и ввод текста
input_element = tester.find_element_safe(tester.By.ID, "username")
if input_element:
    try:
        input_element.clear()
        input_element.send_keys("test_user")
        print_success("Текст введён")
    except Exception as e:
        print_error(f"Не удалось ввести текст: {e}")
```

### Получение значения

```python
# Получение текста
text = element.text

# Получение значения из input
value = element.get_attribute("value")

# Получение HTML
html = element.get_attribute("innerHTML")
```

### Прокрутка к элементу

```python
# Прокрутка к элементу
try:
    tester.driver.execute_script("arguments[0].scrollIntoView(true);", element)
    time.sleep(0.5)
    print_success("Прокручено к элементу")
except Exception as e:
    print_error(f"Не удалось прокрутить: {e}")
```

## 📄 Работа с формами

### Проверка наличия формы

```python
def test_form_exists(self) -> bool:
    """Проверяет наличие формы на странице"""
    print_header("ТЕСТ: Наличие формы")
    bugs = []
    
    try:
        # Ищем форму
        form = self.find_element_safe(self.By.TAG_NAME, "form", "Форма")
        
        if form is None:
            bugs.append({
                "title": "Форма отсутствует",
                "description": "На странице нет элемента form",
                "severity": "HIGH"
            })
            return False
        
        # Проверяем поля формы
        inputs = self.find_elements_safe(self.By.TAG_NAME, "input", "Поля ввода")
        
        required_fields = ["name", "token"]
        for field in required_fields:
            field_found = False
            for inp in inputs:
                name = self.get_element_attribute(inp, "name")
                if name == field:
                    field_found = True
                    break
            
            if not field_found:
                bugs.append({
                    "title": f"Поле '{field}' отсутствует",
                    "description": f"В форме нет поля с name='{field}'",
                    "severity": "HIGH"
                })
        
        # Выводим баги
        for bug in bugs:
            print_bug(bug["title"], bug["description"], bug["severity"])
            self.bugs_found.append(bug)
        
        return len(bugs) == 0
        
    except Exception as e:
        print_error(f"Ошибка при проверке формы: {e}")
        return False
```

### Заполнение формы

```python
def test_form_submit(self) -> bool:
    """Тестирует отправку формы"""
    print_header("ТЕСТ: Отправка формы")
    bugs = []
    
    try:
        # Находим поля
        name_input = self.find_element_safe(self.By.NAME, "name", "Поле имени")
        token_input = self.find_element_safe(self.By.NAME, "token", "Поле токена")
        submit_button = self.find_element_safe(
            self.By.CSS_SELECTOR, 
            "button[type='submit']", 
            "Кнопка отправки"
        )
        
        if not all([name_input, token_input, submit_button]):
            bugs.append({
                "title": "Форма неполная",
                "description": "Не все элементы формы найдены",
                "severity": "HIGH"
            })
            return False
        
        # Заполняем форму
        try:
            name_input.clear()
            name_input.send_keys("Test Bot")
            
            token_input.clear()
            token_input.send_keys("test_token_123")
            
            print_success("Форма заполнена")
        except Exception as e:
            bugs.append({
                "title": "Не удалось заполнить форму",
                "description": f"Ошибка при заполнении полей: {e}",
                "severity": "HIGH"
            })
            return False
        
        # Отправляем форму
        if self.click_element_safe(submit_button, "Кнопка отправки"):
            time.sleep(2)
            
            # Проверяем результат
            # Например, ищем сообщение об успехе
            success_message = self.find_element_safe(
                self.By.CLASS_NAME, 
                "success-message",
                "Сообщение об успехе"
            )
            
            if success_message:
                print_success("Форма отправлена успешно")
            else:
                bugs.append({
                    "title": "Нет сообщения об успехе",
                    "description": "После отправки формы не появилось сообщение об успехе",
                    "severity": "MEDIUM"
                })
        
        # Выводим баги
        for bug in bugs:
            print_bug(bug["title"], bug["description"], bug["severity"])
            self.bugs_found.append(bug)
        
        return len(bugs) == 0
        
    except Exception as e:
        print_error(f"Ошибка при тестировании формы: {e}")
        return False
```

## 📱 Проверка Responsive Design

```python
def test_responsive(self) -> bool:
    """Тестирует отображение на разных размерах экрана"""
    print_header("ТЕСТ: Responsive Design")
    bugs = []
    
    try:
        sizes = [
            ("Desktop", 1920, 1080),
            ("Laptop", 1366, 768),
            ("Tablet", 768, 1024),
            ("Mobile", 375, 667)
        ]
        
        for name, width, height in sizes:
            print_info(f"Проверка для {name} ({width}x{height})...")
            
            # Устанавливаем размер
            self.driver.set_window_size(width, height)
            time.sleep(1)
            
            # Проверяем, что страница не сломалась
            body = self.find_element_safe(self.By.TAG_NAME, "body", "Body элемент")
            
            if body and self.is_element_visible(body):
                print_success(f"{name}: отображается корректно")
            else:
                bugs.append({
                    "title": f"Сломан layout для {name}",
                    "description": f"При размере {width}x{height} страница не отображается",
                    "severity": "MEDIUM"
                })
            
            # Дополнительные проверки для мобильных
            if name == "Mobile":
                # Проверяем, что нет горизонтальной прокрутки
                scroll_width = self.driver.execute_script(
                    "return document.body.scrollWidth"
                )
                client_width = self.driver.execute_script(
                    "return document.body.clientWidth"
                )
                
                if scroll_width > client_width:
                    bugs.append({
                        "title": "Горизонтальная прокрутка на мобильном",
                        "description": f"На {name} есть горизонтальная прокрутка",
                        "severity": "MEDIUM"
                    })
        
        # Возвращаем desktop размер
        self.driver.set_window_size(1920, 1080)
        
        # Выводим баги
        for bug in bugs:
            print_bug(bug["title"], bug["description"], bug["severity"])
            self.bugs_found.append(bug)
        
        return len(bugs) == 0
        
    except Exception as e:
        print_error(f"Ошибка при проверке responsive: {e}")
        return False
```

## 🔍 Проверка консоли на ошибки

```python
def test_console_errors(self) -> bool:
    """Проверяет наличие ошибок в консоли браузера"""
    print_header("ТЕСТ: Ошибки в консоли")
    bugs = []
    
    try:
        # Получаем логи браузера
        logs = self.driver.get_log('browser')
        
        if len(logs) == 0:
            print_success("Ошибок в консоли нет")
        else:
            print_warning(f"Найдено записей: {len(logs)}")
            
            for log in logs:
                level = log.get('level', 'INFO')
                message = log.get('message', '')
                
                if level in ['SEVERE', 'ERROR']:
                    print_error(f"[{level}] {message}")
                    
                    # Игнорируем некоторые ошибки
                    if "favicon.ico" in message:
                        continue
                    
                    bugs.append({
                        "title": "Ошибка в консоли браузера",
                        "description": f"Уровень: {level}, Сообщение: {message}",
                        "severity": "MEDIUM"
                    })
        
        # Выводим баги
        for bug in bugs:
            print_bug(bug["title"], bug["description"], bug["severity"])
            self.bugs_found.append(bug)
        
        return len(bugs) == 0
        
    except Exception as e:
        print_warning(f"Не удалось получить логи: {e}")
        return True  # Не считаем это ошибкой
```

## 🎯 Примеры готовых тестов

### Пример 1: Проверка кнопки

```python
def test_button_click(self) -> bool:
    """Проверяет, что кнопка нажимается"""
    print_header("ТЕСТ: Кнопка создания бота")
    bugs = []
    
    try:
        # Переходим на страницу
        self.go_to_page(self.base_url)
        
        # Ищем кнопку разными способами
        button = None
        
        # Способ 1: по тексту
        try:
            button = self.driver.find_element(
                self.By.XPATH, 
                "//button[contains(text(), 'Создать')]"
            )
        except:
            pass
        
        # Способ 2: по классу
        if button is None:
            button = self.find_element_safe(self.By.CLASS_NAME, "btn-create", "Кнопка создания")
        
        # Способ 3: по ID
        if button is None:
            button = self.find_element_safe(self.By.ID, "create-btn", "Кнопка создания")
        
        if button is None:
            bugs.append({
                "title": "Кнопка не найдена",
                "description": "Кнопка создания бота не найдена ни одним способом",
                "severity": "CRITICAL"
            })
            return False
        
        # Проверяем видимость
        if not self.is_element_visible(button):
            bugs.append({
                "title": "Кнопка не видна",
                "description": "Кнопка существует, но не отображается на странице",
                "severity": "HIGH"
            })
        
        # Проверяем активность
        if not self.is_element_enabled(button):
            bugs.append({
                "title": "Кнопка неактивна",
                "description": "Кнопка отображается, но отключена (disabled)",
                "severity": "HIGH"
            })
        
        # Проверяем кликабельность
        try:
            clickable = self.wait_for_clickable(
                self.By.XPATH, 
                "//button[contains(text(), 'Создать')]",
                timeout=5
            )
            print_success("Кнопка кликабельна")
        except:
            bugs.append({
                "title": "Кнопка не кликабельна",
                "description": "Кнопка не становится кликабельной",
                "severity": "HIGH"
            })
        
        # Пытаемся кликнуть
        if self.click_element_safe(button, "Кнопка создания"):
            time.sleep(2)
            print_success("Клик выполнен успешно")
        else:
            bugs.append({
                "title": "Клик не работает",
                "description": "Не удалось кликнуть по кнопке",
                "severity": "CRITICAL"
            })
        
        # Выводим баги
        for bug in bugs:
            print_bug(bug["title"], bug["description"], bug["severity"])
            self.bugs_found.append(bug)
        
        return len(bugs) == 0
        
    except Exception as e:
        print_error(f"Ошибка при тестировании кнопки: {e}")
        self.take_screenshot("button_error")
        return False
```

### Пример 2: Проверка списка элементов

```python
def test_bot_list(self) -> bool:
    """Проверяет список ботов"""
    print_header("ТЕСТ: Список ботов")
    bugs = []
    
    try:
        self.go_to_page(self.base_url)
        
        # Ищем контейнер списка
        bot_items = self.find_elements_safe(self.By.CLASS_NAME, "bot-item", "Элементы ботов")
        
        if len(bot_items) == 0:
            print_info("Список ботов пуст (это нормально, если ботов нет)")
        else:
            print_success(f"Найдено ботов: {len(bot_items)}")
            
            # Проверяем каждый элемент
            for i, bot in enumerate(bot_items):
                try:
                    # Проверяем наличие имени
                    name_elem = bot.find_element(self.By.CLASS_NAME, "bot-name")
                    name = name_elem.text
                    
                    if not name:
                        bugs.append({
                            "title": f"Бот #{i+1} без имени",
                            "description": f"Элемент бота не содержит имени",
                            "severity": "MEDIUM"
                        })
                    
                    # Проверяем наличие кнопок управления
                    buttons = bot.find_elements(self.By.TAG_NAME, "button")
                    if len(buttons) == 0:
                        bugs.append({
                            "title": f"Нет кнопок у бота #{i+1}",
                            "description": "У элемента бота нет кнопок управления",
                            "severity": "MEDIUM"
                        })
                    
                except Exception as e:
                    print_warning(f"Ошибка при проверке бота #{i+1}: {e}")
        
        # Выводим баги
        for bug in bugs:
            print_bug(bug["title"], bug["description"], bug["severity"])
            self.bugs_found.append(bug)
        
        return len(bugs) == 0
        
    except Exception as e:
        print_error(f"Ошибка при проверке списка: {e}")
        return False
```

### Пример 3: Проверка навигации

```python
def test_navigation(self) -> bool:
    """Проверяет навигацию между страницами"""
    print_header("ТЕСТ: Навигация")
    bugs = []
    
    try:
        # Начинаем с главной страницы
        self.go_to_page(self.base_url)
        current_url = self.driver.current_url
        print_info(f"Текущий URL: {current_url}")
        
        # Ищем ссылку на редактор flow
        flow_link = self.find_element_safe(
            self.By.XPATH, 
            "//a[contains(@href, 'flow-editor')]",
            "Ссылка на редактор"
        )
        
        if flow_link is None:
            bugs.append({
                "title": "Ссылка на редактор не найдена",
                "description": "На главной странице нет ссылки на flow-editor",
                "severity": "MEDIUM"
            })
        else:
            # Кликаем по ссылке
            if self.click_element_safe(flow_link, "Ссылка на редактор"):
                time.sleep(2)
                
                # Проверяем, что URL изменился
                new_url = self.driver.current_url
                if "flow-editor" in new_url:
                    print_success("Переход на страницу редактора выполнен")
                else:
                    bugs.append({
                        "title": "Переход не сработал",
                        "description": f"URL не изменился: {new_url}",
                        "severity": "HIGH"
                    })
                
                # Возвращаемся назад
                self.driver.back()
                time.sleep(1)
                
                back_url = self.driver.current_url
                if "flow-editor" not in back_url:
                    print_success("Возврат назад выполнен")
                else:
                    bugs.append({
                        "title": "Кнопка назад не работает",
                        "description": "Не удалось вернуться на предыдущую страницу",
                        "severity": "MEDIUM"
                    })
        
        # Выводим баги
        for bug in bugs:
            print_bug(bug["title"], bug["description"], bug["severity"])
            self.bugs_found.append(bug)
        
        return len(bugs) == 0
        
    except Exception as e:
        print_error(f"Ошибка при проверке навигации: {e}")
        return False
```

## 🐛 Отчет об ошибках

### Структура отчета о баге

```python
bug = {
    "title": "Краткое название проблемы",
    "description": "Подробное описание того, что не так",
    "severity": "HIGH"  # LOW, MEDIUM, HIGH, CRITICAL
}
```

### Уровни серьёзности

- **LOW** - Минорные проблемы, не влияющие на функционал
  - Пример: Опечатки в тексте, неоптимальный CSS
  
- **MEDIUM** - Средняя серьёзность, частично влияет на функционал
  - Пример: Элементы отображаются некорректно на некоторых размерах экрана
  
- **HIGH** - Серьёзные проблемы, существенно влияющие на функционал
  - Пример: Кнопка не нажимается, форма не отправляется
  
- **CRITICAL** - Критические ошибки, полностью блокирующие функционал
  - Пример: Страница не загружается, приложение падает

### Добавление бага в отчет

```python
bugs.append({
    "title": "Название бага",
    "description": "Подробное описание",
    "severity": "HIGH"
})

# Вывод бага
print_bug(bug["title"], bug["description"], bug["severity"])

# Добавление в общий список
self.bugs_found.append(bug)
```

## 📊 Финальный отчет

В конце теста всегда выводите финальный отчет:

```python
# Выводим финальные результаты
print_header("ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ")
print(f"Всего тестов: {total_tests}")
print(f"{Colors.GREEN}Пройдено:{Colors.END} {passed_tests}")
print(f"{Colors.RED}Не пройдено:{Colors.END} {failed_tests}")
print(f"\n{Colors.BOLD}Найдено багов: {len(self.bugs_found)}{Colors.END}")

if len(self.bugs_found) > 0:
    print_header("СПИСОК НАЙДЕННЫХ БАГОВ")
    for i, bug in enumerate(self.bugs_found, 1):
        print(f"{Colors.RED}{i}.{Colors.END} {Colors.BOLD}{bug['title']}{Colors.END}")
        print(f"   {bug['description']}")
        print(f"   Серьёзность: {bug['severity']}\n")
```

## 🛠️ Устранение неполадок

### Ошибка: "chromedriver not found"

**Причина:** Chromedriver не установлен или не в PATH

**Решение:**
```bash
# Проверить наличие
ls -la /data/data/com.termux/files/usr/bin/chromedriver

# Если нет, переустановить chromium
pkg reinstall chromium
```

### Ошибка: "ECONNREFUSED" при подключении к localhost:5000

**Причина:** Flask приложение не запущено

**Решение:**
```bash
# Запустить Flask приложение
export APPLICATION_ROOT=/manage
python src/app.py &
```

### Ошибка: "ElementNotInteractableException"

**Причина:** Элемент перекрыт другим элементом или не виден

**Решение:**
```python
# Прокрутить к элементу
self.driver.execute_script("arguments[0].scrollIntoView(true);", element)
time.sleep(0.5)

# Или использовать JavaScript клик
self.driver.execute_script("arguments[0].click();", element)
```

### Ошибка: "TimeoutException"

**Причина:** Элемент не появился за отведённое время

**Решение:**
```python
# Увеличить время ожидания
element = self.wait_for_element(self.By.ID, "my-element", timeout=20)

# Или проверить, почему элемент не появляется
self.take_screenshot("timeout_error")
```

### Ошибка: "NoSuchWindowException"

**Причина:** Браузер был закрыт

**Решение:** Проверьте, что не закрываете драйвер слишком рано

## 📝 Чек-лист для выполнения задачи

Перед началом теста:
- [ ] Понял задачу
- [ ] Определил, что проверять
- [ ] Знаю URL страницы
- [ ] Знаю, как искать элементы

При написании теста:
- [ ] Использую шаблон скрипта
- [ ] Добавляю подробные комментарии
- [ ] Обрабатываю все исключения
- [ ] Делаю скриншоты при ошибках
- [ ] Добавляю информативный вывод

При поиске элементов:
- [ ] Пробую разные способы поиска
- [ ] Использую ожидания (wait)
- [ ] Проверяю видимость и активность
- [ ] Добавляю описания для отладки

При проверке:
- [ ] Проверяю все аспекты элемента
- [ ] Добавляю баги с правильным severity
- [ ] Делаю скриншоты проблем
- [ ] Вывожу понятный отчет

После теста:
- [ ] Закрываю драйвер
- [ ] Останавливаю Flask приложение
- [ ] Вывожу финальный отчет
- [ ] Сохраняю скриншоты

## 🎯 Пример полного сценария

**Задача:** "Протестируй кнопку на главной странице, не нажимается"

**Анализ:**
- Что: кнопка на главной странице
- Где: главная страница (http://localhost:5000/manage)
- Проблема: не нажимается
- Ожидание: кнопка должна кликаться

**Скрипт:** test_button_not_clicking.py

```python
#!/usr/bin/env python3
"""
Тест кнопки, которая не нажимается
Задача: Протестируй кнопку на главной странице, не нажимается
"""

# [Используем базовый шаблон из начала инструкции]

def test_button_click(self) -> bool:
    """Проверяет, что кнопка нажимается"""
    print_header("ТЕСТ: Кнопка на главной странице")
    bugs = []
    
    try:
        # 1. Переходим на страницу
        self.go_to_page(self.base_url)
        
        # 2. Ищем кнопку (пробуем разные способы)
        button = None
        
        # По тексту
        try:
            button = self.driver.find_element(
                self.By.XPATH, 
                "//button[contains(text(), 'Создать') or contains(text(), 'Добавить')]"
            )
            print_info("Кнопка найдена по тексту")
        except:
            print_info("Кнопка не найдена по тексту, пробуем по классу...")
        
        # По классу
        if button is None:
            button = self.find_element_safe(self.By.CLASS_NAME, "btn-primary", "Кнопка")
        
        # По ID
        if button is None:
            button = self.find_element_safe(self.By.ID, "submit-btn", "Кнопка")
        
        # Любая кнопка
        if button is None:
            buttons = self.find_elements_safe(self.By.TAG_NAME, "button", "Все кнопки")
            if len(buttons) > 0:
                button = buttons[0]
                print_info("Используем первую найденную кнопку")
        
        # 3. Проверяем, что кнопка найдена
        if button is None:
            bugs.append({
                "title": "Кнопка не найдена",
                "description": "На главной странице не найдена ни одна кнопка",
                "severity": "CRITICAL"
            })
            self.take_screenshot("no_button_found")
            return False
        
        # 4. Проверяем видимость
        print_info("Проверка видимости кнопки...")
        if not self.is_element_visible(button):
            bugs.append({
                "title": "Кнопка не видна",
                "description": "Кнопка существует в DOM, но не отображается на странице (display: none или visibility: hidden)",
                "severity": "HIGH"
            })
            self.take_screenshot("button_not_visible")
        else:
            print_success("Кнопка видна")
        
        # 5. Проверяем активность
        print_info("Проверка активности кнопки...")
        if not self.is_element_enabled(button):
            bugs.append({
                "title": "Кнопка отключена",
                "description": "Кнопка имеет атрибut disabled, поэтому не нажимается",
                "severity": "HIGH"
            })
            self.take_screenshot("button_disabled")
        else:
            print_success("Кнопка активна")
        
        # 6. Проверяем кликабельность через ожидание
        print_info("Проверка кликабельности...")
        try:
            # Пробуем найти кнопку снова через ожидание кликабельности
            button_text = self.get_element_text(button)
            if button_text:
                clickable_button = self.wait_for_clickable(
                    self.By.XPATH, 
                    f"//button[contains(text(), '{button_text}')]",
                    timeout=5
                )
            else:
                # Если нет текста, пробуем по другим признакам
                button_class = self.get_element_attribute(button, "class")
                if button_class:
                    clickable_button = self.wait_for_clickable(
                        self.By.CLASS_NAME,
                        button_class.split()[0],
                        timeout=5
                    )
                    print_success("Кнопка кликабельна")
        except:
            bugs.append({
                "title": "Кнопка не становится кликабельной",
                "description": "Даже после ожидания кнопка не кликабельна. Возможно, перекрыта другим элементом",
                "severity": "HIGH"
            })
            self.take_screenshot("button_not_clickable")
        
        # 7. Проверяем, не перекрыта ли кнопка
        print_info("Проверка перекрытия...")
        try:
            # Проверяем z-index и position
            z_index = self.driver.execute_script(
                "return window.getComputedStyle(arguments[0]).getPropertyValue('z-index')", 
                button
            )
            position = self.driver.execute_script(
                "return window.getComputedStyle(arguments[0]).getPropertyValue('position')", 
                button
            )
            print_info(f"z-index: {z_index}, position: {position}")
        except:
            pass
        
        # 8. Пытаемся кликнуть
        print_info("Попытка клика...")
        try:
            # Пробуем обычный клик
            button.click()
            print_success("Обычный клик сработал")
            time.sleep(2)
        except Exception as e:
            print_warning(f"Обычный клик не сработал: {e}")
            
            # Пробуем JavaScript клик
            try:
                self.driver.execute_script("arguments[0].click();", button)
                print_success("JavaScript клик сработал")
                time.sleep(2)
                
                bugs.append({
                    "title": "Кнопка не кликается обычным способом",
                    "description": f"Обычный клик не работает ({e}), но работает JavaScript клик. Возможно, элемент перекрыт или имеет pointer-events: none",
                    "severity": "MEDIUM"
                })
            except Exception as js_e:
                bugs.append({
                    "title": "Кнопка не кликается никаким способом",
                    "description": f"Обычный клик: {e}, JavaScript клик: {js_e}",
                    "severity": "CRITICAL"
                })
                self.take_screenshot("button_click_failed")
        
        # 9. Проверяем CSS свойства
        print_info("Проверка CSS свойств...")
        try:
            pointer_events = self.driver.execute_script(
                "return window.getComputedStyle(arguments[0]).getPropertyValue('pointer-events')", 
                button
            )
            display = self.driver.execute_script(
                "return window.getComputedStyle(arguments[0]).getPropertyValue('display')", 
                button
            )
            visibility = self.driver.execute_script(
                "return window.getComputedStyle(arguments[0]).getPropertyValue('visibility')", 
                button
            )
            
            print_info(f"pointer-events: {pointer_events}")
            print_info(f"display: {display}")
            print_info(f"visibility: {visibility}")
            
            if pointer_events == "none":
                bugs.append({
                    "title": "pointer-events: none",
                    "description": "Кнопка имеет CSS свойство pointer-events: none, поэтому не кликается",
                    "severity": "HIGH"
                })
        except:
            pass
        
        # 10. Получаем информацию о кнопке для отчета
        button_info = []
        button_text = self.get_element_text(button)
        if button_text:
            button_info.append(f"Текст: '{button_text}'")
        
        button_class = self.get_element_attribute(button, "class")
        if button_class:
            button_info.append(f"Класс: '{button_class}'")
        
        button_id = self.get_element_attribute(button, "id")
        if button_id:
            button_info.append(f"ID: '{button_id}'")
        
        button_type = self.get_element_attribute(button, "type")
        if button_type:
            button_info.append(f"Type: '{button_type}'")
        
        print_info(f"Информация о кнопке: {', '.join(button_info)}")
        
        # Выводим баги
        for bug in bugs:
            print_bug(bug["title"], bug["description"], bug["severity"])
            self.bugs_found.append(bug)
        
        if len(bugs) == 0:
            print_success("Кнопка работает корректно")
        
        return len(bugs) == 0
        
    except Exception as e:
        print_error(f"Критическая ошибка при тестировании: {e}")
        self.take_screenshot("critical_error")
        return False

# В main() замените tester.test_your_functionality() на tester.test_button_click()
```

## 📚 Дополнительные ресурсы

- [Selenium Python Documentation](https://www.selenium.dev/documentation/webdriver/)
- [Selenium WebDriver Locators](https://www.selenium.dev/documentation/webdriver/elements/locators/)
- [XPath Tutorial](https://www.w3schools.com/xml/xpath_intro.asp)
- [CSS Selectors Reference](https://www.w3schools.com/cssref/css_selectors.asp)

## 💡 Советы

1. **Всегда используйте ожидания** вместо `time.sleep()` где возможно
2. **Делайте скриншоты** при любых ошибках
3. **Проверяйте элементы разными способами** - по ID, классу, XPath, тексту
4. **Добавляйте подробный вывод** - это помогает при отладке
5. **Обрабатывайте все исключения** - тест не должен падать
6. **Используйте понятные названия** для тестов и переменных
7. **Комментируйте сложные участки** кода
8. **Проверяйте не только позитивные сценарии** - что если элемента нет?
9. **После каждого действия** делайте небольшую паузу для загрузки
10. **Закрывайте драйвер** в блоке finally для гарантии

---

**Конец инструкции**
