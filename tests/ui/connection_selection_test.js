#!/usr/bin/env node
/**
 * UI тест для проверки выделения стрелок в Flow Editor
 * Проверяет:
 * 1. Выделение стрелки при клике мышью
 * 2. Появление контекстного меню рядом с выделенной стрелкой
 * 3. Изменение цвета на синий и увеличение размера при выделении
 * 4. Работу с пальцем (touch events)
 * 5. Кнопки удаления и добавления опорной точки в меню
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

/**
 * Тест: Проверка выделения стрелки мышью
 */
async function testConnectionClickWithMouse(page) {
  printHeader('ТЕСТ: Выделение стрелки мышью');
  const bugs = [];

  try {
    printInfo('Загрузка редактора flow...');
    await page.goto(`${FULL_BASE_URL}/flow-editor`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Ждем инициализации flowEditor
    printInfo('Ожидание инициализации flowEditor...');
    await page.waitForFunction(() => {
      return window.flowEditor !== undefined;
    }, { timeout: 5000 });
    printSuccess('flowEditor инициализирован');

    // Проверяем наличие связей
    printInfo('Поиск связей (connection-line)...');
    const connections = await page.$$('path.connection-line');
    
    if (connections.length === 0) {
      printWarning('Связи не найдены. Создадим тестовые узлы и связь через JavaScript...');
      
      try {
        // Создаем два узла и связь напрямую через JavaScript
        const result = await page.evaluate(() => {
          if (!window.flowEditor) return { success: false, error: 'No flowEditor' };
          
          try {
            // Создаем два узла
            const node1 = window.flowEditor.addNode('message', 100, 100);
            const node2 = window.flowEditor.addNode('message', 500, 100);
            
            // Создаем связь между ними
            window.flowEditor.addNodeConnection(node1.id, node2.id);
            
            return { success: true, node1Id: node1.id, node2Id: node2.id };
          } catch (e) {
            return { success: false, error: e.message };
          }
        });
        
        if (result.success) {
          printSuccess(`Узлы и связь созданы: ${result.node1Id} -> ${result.node2Id}`);
          await page.waitForTimeout(500);
          
          // Проверяем наличие связей снова
          const newConnections = await page.$$('path.connection-line');
          printInfo(`После создания: найдено связей: ${newConnections.length}`);
          
          if (newConnections.length === 0) {
            bugs.push({
              title: 'Не удалось создать тестовую связь',
              description: 'После попытки создания связи связи не найдены',
              severity: 'HIGH'
            });
            bugs.forEach(bug => {
              printBug(bug.title, bug.description, bug.severity);
              bugsFound.push(bug);
            });
            return bugs.length === 0;
          }
        } else {
          bugs.push({
            title: 'Не удалось создать связь через JavaScript',
            description: `Ошибка: ${result.error}`,
            severity: 'HIGH'
          });
          bugs.forEach(bug => {
            printBug(bug.title, bug.description, bug.severity);
            bugsFound.push(bug);
          });
          return bugs.length === 0;
        }
      } catch (e) {
        bugs.push({
          title: 'Ошибка при создании тестовой связи',
          description: `Ошибка: ${e.message}`,
          severity: 'CRITICAL'
        });
        bugs.forEach(bug => {
          printBug(bug.title, bug.description, bug.severity);
          bugsFound.push(bug);
        });
        return bugs.length === 0;
      }
    } else {
      printSuccess(`Найдено связей: ${connections.length}`);
    }

    // Получаем обновленный список связей
    const finalConnections = await page.$$('path.connection-line');
    
    if (finalConnections.length > 0) {
      // Проверяем начальное состояние первой связи
      const firstConnection = finalConnections[0];
      
      // Получаем начальный стиль
      const initialStroke = await firstConnection.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          stroke: computed.stroke,
          strokeWidth: computed.strokeWidth,
          opacity: computed.opacity
        };
      });
      
      printInfo(`Начальный стиль связи:`);
      printInfo(`  - Цвет (stroke): ${initialStroke.stroke}`);
      printInfo(`  - Толщина (stroke-width): ${initialStroke.strokeWidth}`);
      printInfo(`  - Прозрачность (opacity): ${initialStroke.opacity}`);
      
      // Кликаем на связь через JavaScript, так как SVG элементы могут быть не видны для Playwright
      printInfo('Клик на связь через JavaScript...');
      const clickResult = await firstConnection.evaluate(el => {
        // Создаем и диспатчим событие клика
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true,
          clientX: 100,
          clientY: 100
        });
        el.dispatchEvent(clickEvent);
        return true;
      });
      
      if (clickResult) {
        printSuccess('Событие клика диспатчено');
      } else {
        printError('Не удалось диспатчить событие клика');
      }
      await page.waitForTimeout(500);
      
      // После render() SVG элемент пересоздаётся, поэтому нужно получить новую ссылку
      const updatedConnections = await page.$$('path.connection-line');
      
      if (updatedConnections.length === 0) {
        printError('Связи исчезли после клика!');
        bugs.push({
          title: 'Связи исчезают после клика',
          description: 'После клика на связь все SVG элементы исчезают из DOM',
          severity: 'CRITICAL'
        });
      } else {
        printInfo(`Связей после клика: ${updatedConnections.length}`);
        
        // Проверяем, что связь выделилась
        const isSelected = await updatedConnections[0].evaluate(el => {
          return el.classList.contains('selected');
        });
        
        if (isSelected) {
          printSuccess('Связь получила класс "selected"');
        } else {
          printError('Связь НЕ получила класс "selected"');
          // Проверяем все классы элемента для отладки
          const allClasses = await updatedConnections[0].evaluate(el => {
            return Array.from(el.classList);
          });
          printWarning(`Классы элемента: ${allClasses.join(', ')}`);
          bugs.push({
            title: 'Связь не выделяется при клике',
            description: 'После клика на связь она не получает класс "selected"',
            severity: 'CRITICAL'
          });
        }
        
        // Получаем стиль после выделения
        const selectedStroke = await updatedConnections[0].evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            stroke: computed.stroke,
            strokeWidth: computed.strokeWidth,
            opacity: computed.opacity
          };
        });
        
        printInfo(`Стиль после выделения:`);
        printInfo(`  - Цвет (stroke): ${selectedStroke.stroke}`);
        printInfo(`  - Толщина (stroke-width): ${selectedStroke.strokeWidth}`);
        printInfo(`  - Прозрачность (opacity): ${selectedStroke.opacity}`);
        
        // Проверяем изменение цвета на синий (#3498db или rgb(52, 152, 219))
        const isBlue = selectedStroke.stroke === '#3498db' ||
                       selectedStroke.stroke === 'rgb(52, 152, 219)' ||
                       selectedStroke.stroke.includes('52, 152, 219');
        
        if (isBlue) {
          printSuccess('Цвет связи изменился на синий при выделении');
        } else {
          bugs.push({
            title: 'Цвет связи не меняется на синий при выделении',
            description: `Ожидался синий цвет (#3498db), получен: ${selectedStroke.stroke}`,
            severity: 'HIGH'
          });
        }
        
        // Проверяем увеличение толщины
        const strokeWidthNum = parseFloat(selectedStroke.strokeWidth);
        if (strokeWidthNum > parseFloat(initialStroke.strokeWidth)) {
          printSuccess(`Толщина связи увеличилась: ${initialStroke.strokeWidth} → ${selectedStroke.strokeWidth}`);
        } else {
          bugs.push({
            title: 'Толщина связи не увеличивается при выделении',
            description: `Ожидалось увеличение толщины, получено: ${initialStroke.strokeWidth} → ${selectedStroke.strokeWidth}`,
            severity: 'MEDIUM'
          });
        }
        
        // Проверяем появление контекстного меню
        printInfo('Проверка контекстного меню...');
        const contextMenu = await page.$('#connectionContextMenu');
        
        if (contextMenu) {
          const isVisible = await contextMenu.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          });
          
          if (isVisible) {
            printSuccess('Контекстное меню появилось после клика на связь');
            
            // Проверяем наличие пунктов меню
            const menuItems = await contextMenu.$$('.context-menu-item');
            printInfo(`Найдено пунктов меню: ${menuItems.length}`);
            
            if (menuItems.length >= 2) {
              const itemTexts = await Promise.all(menuItems.map(item => item.textContent()));
              printInfo(`Пункты меню: ${itemTexts.join(', ')}`);
              
              const hasDelete = itemTexts.some(text => text.includes('Удалить') || text.includes('Delete'));
              const hasAddPoint = itemTexts.some(text => text.includes('Добавить') || text.includes('опорн'));
              
              if (hasDelete) {
                printSuccess('Меню содержит пункт "Удалить связь"');
              } else {
                bugs.push({
                  title: 'В контекстном меню нет пункта "Удалить связь"',
                  description: 'Ожидался пункт меню для удаления связи',
                  severity: 'HIGH'
                });
              }
              
              if (hasAddPoint) {
                printSuccess('Меню содержит пункт "Добавить опорную точку"');
              } else {
                bugs.push({
                  title: 'В контекстном меню нет пункта "Добавить опорную точку"',
                  description: 'Ожидался пункт меню для добавления опорной точки',
                  severity: 'MEDIUM'
                });
              }
            } else {
              bugs.push({
                title: 'В контекстном меню недостаточно пунктов',
                description: `Ожидалось минимум 2 пункта, найдено: ${menuItems.length}`,
                severity: 'HIGH'
              });
            }
          } else {
            bugs.push({
              title: 'Контекстное меню не появляется при клике на связь',
              description: 'Меню существует в DOM, но не отображается (display: none или visibility: hidden)',
              severity: 'CRITICAL'
            });
          }
        }
      }
    }

    // Выводим баги
    bugs.forEach(bug => {
      printBug(bug.title, bug.description, bug.severity);
      bugsFound.push(bug);
    });

    return bugs.length === 0;

  } catch (e) {
    printError(`Ошибка при тестировании выделения мышью: ${e.message}`);
    await page.screenshot({ path: `screenshot_connection_click_${Date.now()}.png` });
    return false;
  }
}

/**
 * Тест: Проверка выделения стрелки пальцем (touch)
 */
async function testConnectionClickWithTouch(page) {
  printHeader('ТЕСТ: Выделение стрелки пальцем (touch)');
  const bugs = [];

  try {
    printInfo('Загрузка редактора flow...');
    await page.goto(`${FULL_BASE_URL}/flow-editor`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Ждем инициализации flowEditor
    printInfo('Ожидание инициализации flowEditor...');
    await page.waitForFunction(() => {
      return window.flowEditor !== undefined;
    }, { timeout: 5000 });
    printSuccess('flowEditor инициализирован');

    // Проверяем наличие связей
    const connections = await page.$$('path.connection-line');
    
    if (connections.length === 0) {
      printWarning('Связи не найдены. Создадим тестовые узлы и связь через JavaScript...');
      
      try {
        // Создаем два узла и связь напрямую через JavaScript
        const result = await page.evaluate(() => {
          if (!window.flowEditor) return { success: false, error: 'No flowEditor' };
          
          try {
            // Создаем два узла
            const node1 = {
              id: 'node_touch_0',
              type: 'message',
              x: 100,
              y: 100,
              text: 'Тестовый узел 1',
              buttons: []
            };
            
            const node2 = {
              id: 'node_touch_1',
              type: 'message',
              x: 400,
              y: 100,
              text: 'Тестовый узел 2',
              buttons: []
            };
            
            window.flowEditor.nodes.push(node1, node2);
            
            // Создаем связь
            const connection = {
              id: 'conn_touch_2',
              from: 'node_touch_0',
              to: 'node_touch_1',
              type: 'default'
            };
            
            window.flowEditor.connections.push(connection);
            window.flowEditor.render();
            
            return { success: true, connectionId: connection.id };
          } catch (e) {
            return { success: false, error: e.message };
          }
        });
        
        if (result.success) {
          printSuccess(`Узлы и связь созданы: node_touch_0 -> node_touch_1`);
        } else {
          printError(`Не удалось создать связь: ${result.error}`);
          bugs.push({
            title: 'Не удалось создать тестовые узлы и связь',
            description: result.error,
            severity: 'CRITICAL'
          });
          bugs.forEach(bug => {
            printBug(bug.title, bug.description, bug.severity);
            bugsFound.push(bug);
          });
          return bugs.length === 0;
        }
      } catch (e) {
        printError(`Ошибка при создании связи: ${e.message}`);
        bugs.push({
          title: 'Ошибка при создании тестовых данных',
          description: e.message,
          severity: 'CRITICAL'
        });
        bugs.forEach(bug => {
          printBug(bug.title, bug.description, bug.severity);
          bugsFound.push(bug);
        });
        return bugs.length === 0;
      }
    }
    
    // Получаем обновленный список связей
    const finalConnections = await page.$$('path.connection-line');
    
    if (finalConnections.length === 0) {
      printError('Связи не найдены даже после создания!');
      bugs.push({
        title: 'Связи отсутствуют',
        description: 'Не удалось найти ни одной связи после создания',
        severity: 'CRITICAL'
      });
      bugs.forEach(bug => {
        printBug(bug.title, bug.description, bug.severity);
        bugsFound.push(bug);
      });
      return bugs.length === 0;
    }

    printInfo(`Найдено связей: ${finalConnections.length}`);

    // Эмулируем touch событие на первой связи
    const firstConnection = finalConnections[0];
    
    // Получаем bounding box связи для точного тача
    const box = await firstConnection.boundingBox();
    
    if (!box) {
      bugs.push({
        title: 'Не удалось получить координаты связи',
        description: 'Не удалось получить boundingBox элемента связи для touch',
        severity: 'HIGH'
      });
      bugs.forEach(bug => {
        printBug(bug.title, bug.description, bug.severity);
        bugsFound.push(bug);
      });
      return bugs.length === 0;
    }

    // Вычисляем центр связи
    const touchX = box.x + box.width / 2;
    const touchY = box.y + box.height / 2;
    
    printInfo(`Эмуляция touch в точке (${touchX}, ${touchY})...`);
    
    // Эмулируем touch событие через Pointer Events API
    await page.evaluate(({ x, y }) => {
      // Создаем pointerdown событие (touch start)
      const pointerDownEvent = new PointerEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true
      });
      
      // Создаем pointerup событие (touch end)
      const pointerUpEvent = new PointerEvent('pointerup', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true
      });
      
      // Находим элемент по координатам и диспатчим события
      const element = document.elementFromPoint(x, y);
      if (element) {
        element.dispatchEvent(pointerDownEvent);
        setTimeout(() => {
          element.dispatchEvent(pointerUpEvent);
        }, 50);
      }
    }, { x: touchX, y: touchY });
    
    await page.waitForTimeout(500);

    // Проверяем, что связь выделилась
    const updatedConnections = await page.$$('path.connection-line');
    
    if (updatedConnections.length === 0) {
      printError('Связи исчезли после touch!');
      bugs.push({
        title: 'Связи исчезают после touch',
        description: 'После touch события все SVG элементы исчезают из DOM',
        severity: 'CRITICAL'
      });
    } else {
      const isSelected = await updatedConnections[0].evaluate(el => {
        return el.classList.contains('selected');
      });

      if (isSelected) {
        printSuccess('Связь выделилась при touch');
      } else {
        bugs.push({
          title: 'Связь не выделяется при touch',
          description: 'После touch события связь не получает класс "selected"',
          severity: 'HIGH'
        });
      }

      // Проверяем появление контекстного меню
      const contextMenu = await page.$('#connectionContextMenu');
      
      if (contextMenu) {
        const isVisible = await contextMenu.evaluate(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
        
        if (isVisible) {
          printSuccess('Контекстное меню появилось после touch на связь');
        } else {
          bugs.push({
            title: 'Контекстное меню не появляется при touch на связь',
            description: 'После touch события контекстное меню не отображается',
            severity: 'HIGH'
          });
        }
      }
    }

    // Выводим баги
    bugs.forEach(bug => {
      printBug(bug.title, bug.description, bug.severity);
      bugsFound.push(bug);
    });

    return bugs.length === 0;

  } catch (e) {
    printError(`Ошибка при тестировании выделения пальцем: ${e.message}`);
    await page.screenshot({ path: `screenshot_connection_touch_${Date.now()}.png` });
    return false;
  }
}

/**
 * Тест: Проверка снятия выделения при клике на пустое место
 */
async function testConnectionDeselection(page) {
  printHeader('ТЕСТ: Снятие выделения при клике на пустое место');
  const bugs = [];

  try {
    printInfo('Загрузка редактора flow...');
    await page.goto(`${FULL_BASE_URL}/flow-editor`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const connections = await page.$$('path.connection-line');
    
    if (connections.length === 0) {
      printWarning('Нет связей для тестирования снятия выделения');
      return true;
    }

    // Выделяем связь
    const firstConnection = connections[0];
    await firstConnection.click();
    await page.waitForTimeout(500);

    let isSelected = await firstConnection.evaluate(el => {
      return el.classList.contains('selected');
    });

    if (!isSelected) {
      bugs.push({
        title: 'Не удалось выделить связь для теста снятия выделения',
        description: 'Связь не выделяется при клике',
        severity: 'MEDIUM'
      });
    } else {
      printSuccess('Связь выделена');

      // Кликаем на пустое место (canvas)
      printInfo('Клик на пустое место canvas...');
      const canvas = await page.$('#flowCanvas');
      if (canvas) {
        await canvas.click({ position: { x: 50, y: 50 } });
        await page.waitForTimeout(500);

        isSelected = await firstConnection.evaluate(el => {
          return el.classList.contains('selected');
        });

        if (!isSelected) {
          printSuccess('Выделение снялось при клике на пустое место');
        } else {
          bugs.push({
            title: 'Выделение не снимается при клике на пустое место',
            description: 'После клика на пустое место canvas связь остается выделенной',
            severity: 'MEDIUM'
          });
        }

        // Проверяем, что контекстное меню закрылось
        const contextMenu = await page.$('#connectionContextMenu');
        if (contextMenu) {
          const isVisible = await contextMenu.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
          });

          if (!isVisible) {
            printSuccess('Контекстное меню закрылось при клике на пустое место');
          } else {
            bugs.push({
              title: 'Контекстное меню не закрывается при клике на пустое место',
              description: 'Меню остается открытым после клика вне связи',
              severity: 'MEDIUM'
            });
          }
        }
      }
    }

    // Выводим баги
    bugs.forEach(bug => {
      printBug(bug.title, bug.description, bug.severity);
      bugsFound.push(bug);
    });

    return bugs.length === 0;

  } catch (e) {
    printError(`Ошибка при тестировании снятия выделения: ${e.message}`);
    await page.screenshot({ path: `screenshot_deselection_${Date.now()}.png` });
    return false;
  }
}

/**
 * Тест: Проверка работы кнопок контекстного меню
 */
async function testContextMenuActions(page) {
  printHeader('ТЕСТ: Работа кнопок контекстного меню');
  const bugs = [];

  try {
    printInfo('Загрузка редактора flow...');
    await page.goto(`${FULL_BASE_URL}/flow-editor`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const connections = await page.$$('path.connection-line');
    
    if (connections.length === 0) {
      printWarning('Нет связей для тестирования контекстного меню');
      return true;
    }

    // Выделяем связь
    const firstConnection = connections[0];
    const connectionId = await firstConnection.evaluate(el => el.getAttribute('data-connection-id'));
    
    await firstConnection.click();
    await page.waitForTimeout(500);

    // Проверяем наличие кнопки удаления
    printInfo('Проверка кнопки "Удалить связь"...');
    const deleteButton = await page.$('#btnDeleteConnection');
    
    if (deleteButton) {
      const isVisible = await deleteButton.isVisible();
      if (isVisible) {
        printSuccess('Кнопка "Удалить выделенную связь" видима');
      } else {
        bugs.push({
          title: 'Кнопка удаления связи не отображается',
          description: 'Кнопка #btnDeleteConnection существует, но не видима при выделенной связи',
          severity: 'HIGH'
        });
      }
    } else {
      bugs.push({
        title: 'Кнопка удаления связи отсутствует',
        description: 'Элемент #btnDeleteConnection не найден в DOM',
        severity: 'HIGH'
      });
    }

    // Проверяем пункты контекстного меню
    const contextMenu = await page.$('#connectionContextMenu');
    if (contextMenu) {
      const deleteMenuItem = await contextMenu.$('.context-menu-item:has-text("Удалить"), .context-menu-item:has-text("Delete")');
      const addPointMenuItem = await contextMenu.$('.context-menu-item:has-text("Добавить"), .context-menu-item:has-text("опорн")');
      
      if (deleteMenuItem) {
        printSuccess('Пункт меню "Удалить связь" найден');
      } else {
        bugs.push({
          title: 'Пункт меню "Удалить связь" не найден',
          description: 'В контекстном меню нет пункта для удаления связи',
          severity: 'HIGH'
        });
      }

      if (addPointMenuItem) {
        printSuccess('Пункт меню "Добавить опорную точку" найден');
      } else {
        bugs.push({
          title: 'Пункт меню "Добавить опорную точку" не найден',
          description: 'В контекстном меню нет пункта для добавления опорной точки',
          severity: 'MEDIUM'
        });
      }
    }

    // Выводим баги
    bugs.forEach(bug => {
      printBug(bug.title, bug.description, bug.severity);
      bugsFound.push(bug);
    });

    return bugs.length === 0;

  } catch (e) {
    printError(`Ошибка при тестировании контекстного меню: ${e.message}`);
    await page.screenshot({ path: `screenshot_context_menu_${Date.now()}.png` });
    return false;
  }
}

async function runAllTests() {
  printHeader('UI ТЕСТЫ ВЫДЕЛЕНИЯ СТРЕЛОК');
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
      headless: true, // Headless режим для Termux
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

    // Подписываемся на консольные сообщения для отладки
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('CONNECTION') || text.includes('SELECT') || text.includes('MENU')) {
        printInfo(`[Console] ${text}`);
      }
    });

    printSuccess('Браузер запущен');

    const tests = [
      { name: 'Выделение стрелки мышью', func: () => testConnectionClickWithMouse(page) },
      { name: 'Выделение стрелки пальцем', func: () => testConnectionClickWithTouch(page) },
      { name: 'Снятие выделения', func: () => testConnectionDeselection(page) },
      { name: 'Контекстное меню', func: () => testContextMenuActions(page) }
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
