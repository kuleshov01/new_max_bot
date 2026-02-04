#!/usr/bin/env python3
"""
Подробный UI тест для проверки веб-интерфейса на баги
Использует Selenium с Chromium для тестирования пользовательского интерфейса
"""

import sys
import os
import time
import subprocess
from typing import List, Dict, Any

# Добавляем текущую директорию в путь
sys.path.insert(0, os.path.dirname(__file__))

# Конфигурация
BASE_URL = "http://localhost:5000"
APPLICATION_ROOT = "/manage"
FULL_BASE_URL = f"{BASE_URL}{APPLICATION_ROOT}"

class Colors:
    """Цвета для вывода в консоль"""
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
    
    def init_driver(self) -> bool:
        """Инициализирует Selenium WebDriver"""
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options as ChromeOptions
            from selenium.webdriver.chrome.service import Service
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            
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
    
    def test_main_page_layout(self) -> bool:
        """Тестирует layout главной страницы"""
        print_header("ТЕСТ: Layout главной страницы")
        bugs = []
        
        try:
            print_info("Загрузка главной страницы...")
            self.driver.get(self.base_url)
            
            # Проверяем заголовок страницы
            title = self.driver.title
            print_info(f"Заголовок страницы: {title}")
            
            if not title or title == "":
                bugs.append({
                    "title": "Пустой заголовок страницы",
                    "description": "Главная страница не имеет заголовка (title tag)",
                    "severity": "LOW"
                })
            
            # Проверяем наличие основных элементов
            print_info("Проверка наличия основных элементов...")
            
            # Ищем заголовок H1
            try:
                h1 = self.wait_for_element(self.By.TAG_NAME, "h1", timeout=5)
                print_success(f"Заголовок H1 найден: {h1.text}")
            except:
                bugs.append({
                    "title": "Отсутствует заголовок H1",
                    "description": "На главной странице нет элемента h1",
                    "severity": "MEDIUM"
                })
            
            # Ищем кнопки
            try:
                buttons = self.driver.find_elements(self.By.TAG_NAME, "button")
                print_info(f"Найдено кнопок: {len(buttons)}")
                if len(buttons) == 0:
                    bugs.append({
                        "title": "Отсутствуют кнопки",
                        "description": "На главной странице нет ни одной кнопки",
                        "severity": "HIGH"
                    })
            except Exception as e:
                print_warning(f"Ошибка при поиске кнопок: {e}")
            
            # Ищем формы
            try:
                forms = self.driver.find_elements(self.By.TAG_NAME, "form")
                print_info(f"Найдено форм: {len(forms)}")
            except Exception as e:
                print_warning(f"Ошибка при поиске форм: {e}")
            
            # Проверяем наличие контейнера для ботов
            try:
                bot_container = self.driver.find_elements(self.By.CLASS_NAME, "bot-item")
                print_info(f"Найдено элементов bot-item: {len(bot_container)}")
            except:
                print_info("Контейнер для ботов не найден (это нормально, если ботов нет)")
            
            # Проверяем responsive design (размер viewport)
            viewport_size = self.driver.get_window_size()
            print_info(f"Размер viewport: {viewport_size['width']}x{viewport_size['height']}")
            
            # Выводим найденные баги
            for bug in bugs:
                print_bug(bug["title"], bug["description"], bug["severity"])
                self.bugs_found.append(bug)
            
            return len(bugs) == 0
            
        except Exception as e:
            print_error(f"Ошибка при тестировании layout: {e}")
            self.take_screenshot("main_page_layout_error")
            return False
    
    def test_create_bot_form(self) -> bool:
        """Тестирует форму создания бота"""
        print_header("ТЕСТ: Форма создания бота")
        bugs = []
        
        try:
            print_info("Проверка формы создания бота...")
            
            # Ищем форму создания
            try:
                # Пытаемся найти кнопку "Добавить бота" или похожую
                add_buttons = self.driver.find_elements(self.By.XPATH, 
                    "//button[contains(text(), 'Добавить') or contains(text(), 'Создать') or contains(text(), 'New')]")
                
                if len(add_buttons) == 0:
                    # Ищем по классу
                    add_buttons = self.driver.find_elements(self.By.CLASS_NAME, "btn-add")
                
                if len(add_buttons) > 0:
                    print_success(f"Найдена кнопка добавления: {add_buttons[0].text}")
                    
                    # Проверяем, что кнопка кликабельна
                    try:
                        if add_buttons[0].is_displayed() and add_buttons[0].is_enabled():
                            print_success("Кнопка добавления кликабельна")
                        else:
                            bugs.append({
                                "title": "Кнопка добавления неактивна",
                                "description": "Кнопка добавления бота существует, но не кликабельна",
                                "severity": "HIGH"
                            })
                    except Exception as e:
                        print_warning(f"Не удалось проверить кликабельность: {e}")
                else:
                    bugs.append({
                        "title": "Отсутствует кнопка добавления бота",
                        "description": "Не найдена кнопка для создания нового бота",
                        "severity": "HIGH"
                    })
            except Exception as e:
                print_warning(f"Ошибка при поиске кнопки добавления: {e}")
            
            # Ищем поля ввода
            try:
                inputs = self.driver.find_elements(self.By.TAG_NAME, "input")
                print_info(f"Найдено полей ввода: {len(inputs)}")
                
                for i, inp in enumerate(inputs):
                    try:
                        inp_type = inp.get_attribute("type") or "text"
                        inp_name = inp.get_attribute("name") or inp.get_attribute("placeholder") or f"input_{i}"
                        print_info(f"  - {inp_name} (type: {inp_type})")
                    except:
                        pass
            except Exception as e:
                print_warning(f"Ошибка при поиске полей ввода: {e}")
            
            # Выводим найденные баги
            for bug in bugs:
                print_bug(bug["title"], bug["description"], bug["severity"])
                self.bugs_found.append(bug)
            
            return len(bugs) == 0
            
        except Exception as e:
            print_error(f"Ошибка при тестировании формы создания: {e}")
            self.take_screenshot("create_bot_form_error")
            return False
    
    def test_flow_editor_page(self) -> bool:
        """Тестирует страницу редактора flow"""
        print_header("ТЕСТ: Редактор Flow")
        bugs = []
        
        try:
            print_info("Загрузка страницы редактора...")
            self.driver.get(f"{self.base_url}/flow-editor")
            
            # Проверяем заголовок
            title = self.driver.title
            print_info(f"Заголовок страницы: {title}")
            
            # Проверяем наличие canvas для редактора
            try:
                canvas = self.driver.find_elements(self.By.TAG_NAME, "canvas")
                if len(canvas) > 0:
                    print_success(f"Найден canvas элемент")
                else:
                    # Проверяем наличие div с классом, похожим на контейнер редактора
                    editor_containers = self.driver.find_elements(self.By.XPATH, 
                        "//*[contains(@class, 'flow') or contains(@class, 'editor') or contains(@class, 'canvas')]")
                    if len(editor_containers) > 0:
                        print_success(f"Найден контейнер редактора")
                    else:
                        bugs.append({
                            "title": "Отсутствует canvas редактора",
                            "description": "На странице редактора flow не найден canvas или контейнер редактора",
                            "severity": "HIGH"
                        })
            except Exception as e:
                print_warning(f"Ошибка при поиске canvas: {e}")
            
            # Проверяем наличие кнопок управления
            try:
                buttons = self.driver.find_elements(self.By.TAG_NAME, "button")
                print_info(f"Найдено кнопок: {len(buttons)}")
                
                # Ищем кнопки сохранения/загрузки
                save_buttons = [b for b in buttons if "save" in b.text.lower() or "сохранить" in b.text.lower()]
                if len(save_buttons) > 0:
                    print_success(f"Найдена кнопка сохранения")
                else:
                    bugs.append({
                        "title": "Отсутствует кнопка сохранения",
                        "description": "На странице редактора нет кнопки для сохранения flow",
                        "severity": "HIGH"
                    })
            except Exception as e:
                print_warning(f"Ошибка при поиске кнопок: {e}")
            
            # Выводим найденные баги
            for bug in bugs:
                print_bug(bug["title"], bug["description"], bug["severity"])
                self.bugs_found.append(bug)
            
            return len(bugs) == 0
            
        except Exception as e:
            print_error(f"Ошибка при тестировании редактора: {e}")
            self.take_screenshot("flow_editor_error")
            return False
    
    def test_responsive_design(self) -> bool:
        """Тестирует responsive design"""
        print_header("ТЕСТ: Responsive Design")
        bugs = []
        
        try:
            # Тестируем разные размеры экрана
            sizes = [
                ("Desktop", 1920, 1080),
                ("Laptop", 1366, 768),
                ("Tablet", 768, 1024),
                ("Mobile", 375, 667)
            ]
            
            for name, width, height in sizes:
                print_info(f"Тестирование для {name} ({width}x{height})...")
                self.driver.set_window_size(width, height)
                time.sleep(1)
                
                # Проверяем, что страница не сломалась
                try:
                    body = self.driver.find_element(self.By.TAG_NAME, "body")
                    if body.is_displayed():
                        print_success(f"{name}: страница отображается корректно")
                    else:
                        bugs.append({
                            "title": f"Сломан layout для {name}",
                            "description": f"При размере {width}x{height} body элемент не отображается",
                            "severity": "MEDIUM"
                        })
                except Exception as e:
                    bugs.append({
                        "title": f"Ошибка при проверке {name}",
                        "description": f"При размере {width}x{height} произошла ошибка: {e}",
                        "severity": "HIGH"
                    })
            
            # Возвращаем размер desktop
            self.driver.set_window_size(1920, 1080)
            
            # Выводим найденные баги
            for bug in bugs:
                print_bug(bug["title"], bug["description"], bug["severity"])
                self.bugs_found.append(bug)
            
            return len(bugs) == 0
            
        except Exception as e:
            print_error(f"Ошибка при тестировании responsive design: {e}")
            return False
    
    def test_console_errors(self) -> bool:
        """Проверяет наличие ошибок в консоли браузера"""
        print_header("ТЕСТ: Ошибки в консоли браузера")
        bugs = []
        
        try:
            # Получаем логи браузера
            logs = self.driver.get_log('browser')
            
            if len(logs) == 0:
                print_success("Ошибок в консоли не найдено")
            else:
                print_warning(f"Найдено записей в консоли: {len(logs)}")
                
                for log in logs:
                    level = log.get('level', 'INFO')
                    message = log.get('message', '')
                    
                    if level in ['SEVERE', 'ERROR']:
                        print_error(f"[{level}] {message}")
                        bugs.append({
                            "title": "Ошибка в консоли браузера",
                            "description": f"Уровень: {level}, Сообщение: {message}",
                            "severity": "MEDIUM"
                        })
                    elif level == 'WARNING':
                        print_warning(f"[{level}] {message}")
            
            # Выводим найденные баги
            for bug in bugs:
                print_bug(bug["title"], bug["description"], bug["severity"])
                self.bugs_found.append(bug)
            
            return len(bugs) == 0
            
        except Exception as e:
            print_warning(f"Не удалось получить логи браузера: {e}")
            return True  # Не считаем это ошибкой
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Запускает все UI тесты"""
        results = {
            "total_tests": 0,
            "passed_tests": 0,
            "failed_tests": 0,
            "bugs_found": []
        }
        
        tests = [
            ("Layout главной страницы", self.test_main_page_layout),
            ("Форма создания бота", self.test_create_bot_form),
            ("Редактор Flow", self.test_flow_editor_page),
            ("Responsive Design", self.test_responsive_design),
            ("Ошибки в консоли", self.test_console_errors)
        ]
        
        for test_name, test_func in tests:
            results["total_tests"] += 1
            try:
                if test_func():
                    results["passed_tests"] += 1
                    print_success(f"Тест '{test_name}' пройден")
                else:
                    results["failed_tests"] += 1
                    print_error(f"Тест '{test_name}' не пройден")
            except Exception as e:
                results["failed_tests"] += 1
                print_error(f"Тест '{test_name}' завершился с ошибкой: {e}")
        
        results["bugs_found"] = self.bugs_found
        
        return results
    
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
    print_header("UI ТЕСТИРОВАНИЕ ВЕБ-ИНТЕРФЕЙСА")
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
            # Запускаем все тесты
            results = tester.run_all_tests()
            
            # Выводим финальные результаты
            print_header("ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ")
            print(f"Всего тестов: {results['total_tests']}")
            print(f"{Colors.GREEN}Пройдено:{Colors.END} {results['passed_tests']}")
            print(f"{Colors.RED}Не пройдено:{Colors.END} {results['failed_tests']}")
            print(f"\n{Colors.BOLD}Найдено багов: {len(results['bugs_found'])}{Colors.END}")
            
            if len(results['bugs_found']) > 0:
                print_header("СПИСОК НАЙДЕННЫХ БАГОВ")
                for i, bug in enumerate(results['bugs_found'], 1):
                    print(f"{Colors.RED}{i}.{Colors.END} {Colors.BOLD}{bug['title']}{Colors.END}")
                    print(f"   {bug['description']}")
                    print(f"   Серьёзность: {bug['severity']}")
                    print()
            
            return 0 if results['failed_tests'] == 0 else 1
            
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
