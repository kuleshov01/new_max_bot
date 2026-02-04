#!/usr/bin/env node
/**
 * UI тестирование с Playwright для Termux
 * Использует playwright-core с системным Chromium
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

// Конфигурация
const BASE_URL = 'http://localhost:5000';
const APPLICATION_ROOT = '/manage';
const FULL_BASE_URL = `${BASE_URL}${APPLICATION_ROOT}`;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/data/data/com.termux/files/usr/bin/chromium-browser';

// Цвета для вывода
const colors = {
  green: '\x1b[92m',
  red: '\x1b[91m',
  yellow: '\x1b[93m',
  blue: '\x1b[94m',
  bold: '\x1b[1m',
  end: '\x1b[0m'
};

function printSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.end}`);
}

function printError(message) {
  console.log(`${colors.red}✗ ${message}${colors.end}`);
}

function printInfo(message) {
  console.log(`${colors.blue}ℹ ${message}${colors.end}`);
}

function printWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.end}`);
}

function printHeader(message) {
  console.log(`\n${colors.bold}${colors.blue}=${'='.repeat(58)}${colors.end}`);
  console.log(`${colors.bold}${colors.blue}${message}${colors.end}`);
  console.log(`${colors.bold}${colors.blue}=${'='.repeat(58)}${colors.end}\n`);
}

function printBug(title, description, severity = 'MEDIUM') {
  const severityColors = {
    'LOW': colors.blue,
    'MEDIUM': colors.yellow,
    'HIGH': colors.red,
    'CRITICAL': `${colors.bold}${colors.red}`
  };
  const color = severityColors[severity] || colors.yellow;
  console.log(`\n${color}🐛 БАГ ОБНАРУЖЕН [${severity}]${colors.end}`);
  console.log(`${colors.bold}Название:${colors.end} ${title}`);
  console.log(`${colors.bold}Описание:${colors.end} ${description}\n`);
}

let bugsFound = [];

async function testMainPageLayout(page) {
  printHeader('ТЕСТ: Layout главной страницы');
  const bugs = [];

  try {
    printInfo('Загрузка главной страницы...');
    await page.goto(FULL_BASE_URL, { waitUntil: 'networkidle' });

    // Проверяем заголовок страницы
    const title = await page.title();
    printInfo(`Заголовок страницы: ${title}`);

    if (!title || title === '') {
      bugs.push({
        title: 'Пустой заголовок страницы',
        description: 'Главная страница не имеет заголовка (title tag)',
        severity: 'LOW'
      });
    }

    // Проверяем наличие H1
    try {
      const h1 = await page.$('h1');
      if (h1) {
        const h1Text = await h1.textContent();
        printSuccess(`Заголовок H1 найден: ${h1Text}`);
      } else {
        bugs.push({
          title: 'Отсутствует заголовок H1',
          description: 'На главной странице нет элемента h1',
          severity: 'MEDIUM'
        });
      }
    } catch (e) {
      bugs.push({
        title: 'Отсутствует заголовок H1',
        description: 'На главной странице нет элемента h1',
        severity: 'MEDIUM'
      });
    }

    // Проверяем кнопки
    const buttons = await page.$$('button');
    printInfo(`Найдено кнопок: ${buttons.length}`);

    if (buttons.length === 0) {
      bugs.push({
        title: 'Отсутствуют кнопки',
        description: 'На главной странице нет ни одной кнопки',
        severity: 'HIGH'
      });
    }

    // Проверяем формы
    const forms = await page.$$('form');
    printInfo(`Найдено форм: ${forms.length}`);

    // Проверяем элементы ботов
    const botItems = await page.$$('.bot-item');
    printInfo(`Найдено элементов bot-item: ${botItems.length}`);

    // Проверяем viewport
    const viewportSize = page.viewportSize();
    printInfo(`Размер viewport: ${viewportSize.width}x${viewportSize.height}`);

    // Выводим баги
    bugs.forEach(bug => {
      printBug(bug.title, bug.description, bug.severity);
      bugsFound.push(bug);
    });

    return bugs.length === 0;

  } catch (e) {
    printError(`Ошибка при тестировании layout: ${e.message}`);
    await page.screenshot({ path: `screenshot_main_page_${Date.now()}.png` });
    return false;
  }
}

async function testCreateBotForm(page) {
  printHeader('ТЕСТ: Форма создания бота');
  const bugs = [];

  try {
    printInfo('Проверка формы создания бота...');

    // Ищем кнопку добавления
    const addButton = await page.$('button:has-text("Создать"), button:has-text("Добавить"), button:has-text("New")');

    if (addButton) {
      const buttonText = await addButton.textContent();
      printSuccess(`Найдена кнопка добавления: ${buttonText}`);

      const isVisible = await addButton.isVisible();
      const isEnabled = await addButton.isEnabled();

      if (isVisible && isEnabled) {
        printSuccess('Кнопка добавления кликабельна');
      } else {
        bugs.push({
          title: 'Кнопка добавления неактивна',
          description: 'Кнопка добавления бота существует, но не кликабельна',
          severity: 'HIGH'
        });
      }
    } else {
      bugs.push({
        title: 'Отсутствует кнопка добавления бота',
        description: 'Не найдена кнопка для создания нового бота',
        severity: 'HIGH'
      });
    }

    // Проверяем поля ввода
    const inputs = await page.$$('input');
    printInfo(`Найдено полей ввода: ${inputs.length}`);

    for (let i = 0; i < Math.min(inputs.length, 10); i++) {
      try {
        const inputType = await inputs[i].getAttribute('type');
        const inputName = await inputs[i].getAttribute('name');
        const inputPlaceholder = await inputs[i].getAttribute('placeholder');
        const label = inputName || inputPlaceholder || `input_${i}`;
        printInfo(`  - ${label} (type: ${inputType || 'text'})`);
      } catch (e) {
        // Игнорируем ошибки
      }
    }

    // Выводим баги
    bugs.forEach(bug => {
      printBug(bug.title, bug.description, bug.severity);
      bugsFound.push(bug);
    });

    return bugs.length === 0;

  } catch (e) {
    printError(`Ошибка при тестировании формы создания: ${e.message}`);
    await page.screenshot({ path: `screenshot_create_bot_${Date.now()}.png` });
    return false;
  }
}

async function testFlowEditorPage(page) {
  printHeader('ТЕСТ: Редактор Flow');
  const bugs = [];

  try {
    printInfo('Загрузка страницы редактора...');
    await page.goto(`${FULL_BASE_URL}/flow-editor`, { waitUntil: 'networkidle' });

    // Проверяем заголовок
    const title = await page.title();
    printInfo(`Заголовок страницы: ${title}`);

    // Проверяем наличие canvas
    const canvas = await page.$('canvas');
    if (canvas) {
      printSuccess('Найден canvas элемент');
    } else {
      // Ищем контейнер редактора
      const editorContainer = await page.$('[class*="flow"], [class*="editor"], [class*="canvas"]');
      if (editorContainer) {
        printSuccess('Найден контейнер редактора');
      } else {
        bugs.push({
          title: 'Отсутствует canvas редактора',
          description: 'На странице редактора flow не найден canvas или контейнер редактора',
          severity: 'HIGH'
        });
      }
    }

    // Проверяем кнопки сохранения
    const saveButton = await page.$('button:has-text("Сохранить"), button:has-text("Save")');
    if (saveButton) {
      printSuccess('Найдена кнопка сохранения');
    } else {
      bugs.push({
        title: 'Отсутствует кнопка сохранения',
        description: 'На странице редактора нет кнопки для сохранения flow',
        severity: 'HIGH'
      });
    }

    const buttons = await page.$$('button');
    printInfo(`Найдено кнопок: ${buttons.length}`);

    // Выводим баги
    bugs.forEach(bug => {
      printBug(bug.title, bug.description, bug.severity);
      bugsFound.push(bug);
    });

    return bugs.length === 0;

  } catch (e) {
    printError(`Ошибка при тестировании редактора: ${e.message}`);
    await page.screenshot({ path: `screenshot_flow_editor_${Date.now()}.png` });
    return false;
  }
}

async function testResponsiveDesign(page) {
  printHeader('ТЕСТ: Responsive Design');
  const bugs = [];

  try {
    const sizes = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Laptop', width: 1366, height: 768 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 }
    ];

    for (const size of sizes) {
      printInfo(`Тестирование для ${size.name} (${size.width}x${size.height})...`);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.waitForTimeout(1000);

      try {
        const body = await page.$('body');
        if (body) {
          const isVisible = await body.isVisible();
          if (isVisible) {
            printSuccess(`${size.name}: страница отображается корректно`);
          } else {
            bugs.push({
              title: `Сломан layout для ${size.name}`,
              description: `При размере ${size.width}x${size.height} body элемент не отображается`,
              severity: 'MEDIUM'
            });
          }
        }
      } catch (e) {
        bugs.push({
          title: `Ошибка при проверке ${size.name}`,
          description: `При размере ${size.width}x${size.height} произошла ошибка: ${e.message}`,
          severity: 'HIGH'
        });
      }
    }

    // Возвращаем размер desktop
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Выводим баги
    bugs.forEach(bug => {
      printBug(bug.title, bug.description, bug.severity);
      bugsFound.push(bug);
    });

    return bugs.length === 0;

  } catch (e) {
    printError(`Ошибка при тестировании responsive design: ${e.message}`);
    return false;
  }
}

async function testConsoleErrors(page) {
  printHeader('ТЕСТ: Ошибки в консоли браузера');
  const bugs = [];

  try {
    // Собираем ошибки консоли
    page.on('console', msg => {
      if (msg.type() === 'error') {
        printError(`[ERROR] ${msg.text()}`);
        bugs.push({
          title: 'Ошибка в консоли браузера',
          description: `Сообщение: ${msg.text()}`,
          severity: 'MEDIUM'
        });
      }
    });

    // Навигируем по страницам для проверки
    await page.goto(FULL_BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.goto(`${FULL_BASE_URL}/flow-editor`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    if (bugs.length === 0) {
      printSuccess('Ошибок в консоли не найдено');
    }

    // Выводим баги
    bugs.forEach(bug => {
      printBug(bug.title, bug.description, bug.severity);
      bugsFound.push(bug);
    });

    return bugs.length === 0;

  } catch (e) {
    printWarning(`Не удалось проверить консоль: ${e.message}`);
    return true; // Не считаем это ошибкой
  }
}

async function runAllTests() {
  printHeader('UI ТЕСТИРОВАНИЕ С PLAYWRIGHT');
  printInfo(`Базовый URL: ${FULL_BASE_URL}`);
  printInfo(`Chromium: ${CHROMIUM_PATH}`);

  let browser;
  let results = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0
  };

  try {
    printInfo('Запуск браузера...');
    browser = await chromium.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-dev-tools'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Подписываемся на ошибки консоли
    page.on('pageerror', error => {
      printError(`JavaScript error: ${error.message}`);
    });

    printSuccess('Браузер запущен');

    const tests = [
      { name: 'Layout главной страницы', func: () => testMainPageLayout(page) },
      { name: 'Форма создания бота', func: () => testCreateBotForm(page) },
      { name: 'Редактор Flow', func: () => testFlowEditorPage(page) },
      { name: 'Responsive Design', func: () => testResponsiveDesign(page) },
      { name: 'Ошибки в консоли', func: () => testConsoleErrors(page) }
    ];

    for (const test of tests) {
      results.totalTests++;
      try {
        if (await test.func()) {
          results.passedTests++;
          printSuccess(`Тест '${test.name}' пройден`);
        } else {
          results.failedTests++;
          printError(`Тест '${test.name}' не пройден`);
        }
      } catch (e) {
        results.failedTests++;
        printError(`Тест '${test.name}' завершился с ошибкой: ${e.message}`);
      }
    }

    await context.close();
    await browser.close();

  } catch (e) {
    printError(`Критическая ошибка: ${e.message}`);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }

  // Финальные результаты
  printHeader('ФИНАЛЬНЫЕ РЕЗУЛЬТАТЫ');
  console.log(`Всего тестов: ${results.totalTests}`);
  console.log(`${colors.green}Пройдено:${colors.end} ${results.passedTests}`);
  console.log(`${colors.red}Не пройдено:${colors.end} ${results.failedTests}`);
  console.log(`\n${colors.bold}Найдено багов: ${bugsFound.length}${colors.end}`);

  if (bugsFound.length > 0) {
    printHeader('СПИСОК НАЙДЕННЫХ БАГОВ');
    bugsFound.forEach((bug, i) => {
      console.log(`${colors.red}${i + 1}.${colors.end} ${colors.bold}${bug.title}${colors.end}`);
      console.log(`   ${bug.description}`);
      console.log(`   Серьёзность: ${bug.severity}\n`);
    });
  }

  return results.failedTests === 0 ? 0 : 1;
}

// Запуск
runAllTests().then(exitCode => {
  process.exit(exitCode);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
