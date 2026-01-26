import threading
import time
import logging
import requests
import sys
from database import get_bot, update_bot_status, get_bot_flow, add_bot_log

logger = logging.getLogger()
logger.setLevel(logging.DEBUG)

# Console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s', handlers=[logging.StreamHandler(sys.stdout)])

class BotInstance:
    def __init__(self, bot_id):
        self.bot_id = bot_id
        self.bot_config = get_bot(bot_id)
        self.flow_data = get_bot_flow(bot_id)
        self.user_states = {}
        self.running = False
        self.thread = None
        self.base_url = self.bot_config.get('base_url', 'https://botapi.max.ru')
        self.bot_name = self.bot_config.get('name', f'Bot_{bot_id}')
        self.bot_token = self.bot_config.get('token', '')

        self.log('INFO', f'Инициализация бота ID: {self.bot_id}, имя: "{self.bot_name}"')

    def log(self, level, message):
        import sys
        bot_info = f"[ID:{self.bot_id}]"
        log_message = f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {level} - Bot {bot_info} {message}"
        print(log_message, flush=True)
        try:
            add_bot_log(self.bot_id, level, message)
            logging.info(f"Bot {bot_info}: {level} - {message}")
        except Exception as e:
            logging.error(f"Error logging to database for bot {bot_info}: {e}")
        
    def get_updates(self, marker=None):
        try:
            url = f"{self.base_url}/updates"
            params = {"access_token": self.bot_token}
            if marker:
                params["marker"] = marker
            self.log('DEBUG', f'Запрос обновлений с параметрами: marker={marker}')
            response = requests.get(url, params=params, timeout=60)
            response.raise_for_status()
            result = response.json()
            updates_count = len(result.get('updates', []))
            if updates_count > 0:
                self.log('DEBUG', f'Получено {updates_count} обновлений')
            return result
        except Exception as e:
            self.log('ERROR', f'Ошибка при получении обновлений: {e}')
            return {"updates": [], "marker": None}

    def send_message(self, chat_id, text, attachments=None):
        try:
            url = f"{self.base_url}/messages?access_token={self.bot_token}&chat_id={chat_id}"
            headers = {"Content-Type": "application/json"}
            data = {"text": text, "format": "markdown"}
            if attachments:
                processed_attachments = []
                for attachment in attachments:
                    if isinstance(attachment, dict):
                        processed_attachments.append(attachment)
                if processed_attachments:
                    data["attachments"] = processed_attachments
            self.log('DEBUG', f'Отправка сообщения в чат {chat_id}: "{text[:30]}..."')
            response = requests.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            self.log('INFO', f'Сообщение отправлено в чат {chat_id}')
            return response.json()
        except Exception as e:
            self.log('ERROR', f'Ошибка при отправке сообщения в чат {chat_id}: {e}')
            return {}
    
    def extract_chat_id(self, update):
        if "chat_id" in update:
            return update.get("chat_id")
        
        msg = update.get("message") or {}
        if "recipient" in msg and isinstance(msg["recipient"], dict):
            recipient = msg["recipient"]
            if "chat_id" in recipient:
                return recipient["chat_id"]
        
        if "sender" in msg and isinstance(msg["sender"], dict):
            sender = msg["sender"]
            if "chat_id" in sender:
                return sender["chat_id"]
        
        if "sender" in update and isinstance(update["sender"], dict):
            sender = update["sender"]
            if "chat_id" in sender:
                return sender["chat_id"]
        
        if "chat" in msg and isinstance(msg["chat"], dict):
            chat = msg["chat"]
            if "id" in chat:
                return chat["id"]
        
        return None
    
    def handle_message(self, message):
        try:
            chat_id = message.get("chat", {}).get("id")
            text = message.get("text", "").strip()

            if not chat_id:
                self.log('WARNING', 'Не удалось извлечь chat_id из сообщения')
                return

            # Проверяем наличие контакта в сообщении
            if "body" in message and isinstance(message["body"], dict):
                body = message["body"]
                if "attachments" in body and isinstance(body["attachments"], list):
                    for attachment in body["attachments"]:
                        if attachment.get("type") == "contact":
                            contact = attachment.get("payload", {})
                            phone_number = contact.get("phone_number", "")
                            first_name = contact.get("first_name", "")
                            
                            self.log('INFO', f'Получен контакт от чата {chat_id}: {first_name} ({phone_number})')
                            
                            # Сохраняем контакт в состояние пользователя
                            if chat_id not in self.user_states:
                                self.user_states[chat_id] = {}
                            
                            self.user_states[chat_id]['contact_phone'] = phone_number
                            self.user_states[chat_id]['contact_name'] = first_name
                            
                            # После получения контакта переходим к следующей ноде
                            self.process_node_after_input(chat_id)
                            return
                        
                        elif attachment.get("type") == "geo_location":
                            location = attachment.get("payload", {})
                            latitude = location.get("latitude", 0)
                            longitude = location.get("longitude", 0)
                            
                            self.log('INFO', f'Получена геолокация от чата {chat_id}: {latitude}, {longitude}')
                            
                            # Сохраняем геолокацию в состояние пользователя
                            if chat_id not in self.user_states:
                                self.user_states[chat_id] = {}
                            
                            self.user_states[chat_id]['geo_latitude'] = latitude
                            self.user_states[chat_id]['geo_longitude'] = longitude
                            
                            # После получения геолокации переходим к следующей ноде
                            self.process_node_after_input(chat_id)
                            return

            # Обработка текстовых сообщений
            if text == "/start":
                self.log('INFO', f'Команда /start от чата {chat_id}')
                self.user_states[chat_id] = {'current_node': None, 'history': []}
                self.show_node(chat_id, 'start')
                return

            # Проверяем, ожидается ли текстовый ввод от пользователя
            current_state = self.user_states.get(chat_id, {})
            current_node_id = current_state.get('current_node')
            
            if current_node_id:
                current_node = next((n for n in self.flow_data.get('nodes', []) if n['id'] == current_node_id), None)
                if current_node and current_node.get('collectInput', False):
                    self.log('INFO', f'Текст от пользователя {chat_id}: {text[:30]}...')
                    self.user_states[chat_id]['user_text'] = text
                    self.process_node_after_input(chat_id)
                    return
            
            # Если это просто текстовое сообщение без ожидания, логируем
            if text:
                self.log('DEBUG', f'Текстовое сообщение от чата {chat_id}: {text[:30]}...')
        
        except Exception as e:
            self.log('ERROR', f'Ошибка обработки сообщения: {e}')

    def answer_callback(self, callback_id, text=None):
        try:
            url = f"{self.base_url}/answers?access_token={self.bot_token}"
            headers = {"Content-Type": "application/json"}
            data = {"callback_id": callback_id}
            if text:
                data["text"] = text
            response = requests.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            self.log('DEBUG', f'Ответ на callback {callback_id} отправлен')
            return response.json()
        except Exception as e:
            self.log('ERROR', f'Ошибка ответа на callback {callback_id}: {e}')
            return {}

    def handle_callback(self, callback):
        callback_id = callback["id"]
        payload = callback["payload"]
        chat_id = callback.get("message", {}).get("chat", {}).get("id")

        if not chat_id:
            chat_id = self.extract_chat_id({"message": callback.get("message", {})})

        if not chat_id:
            self.log('WARNING', f'Не удалось извлечь chat_id из callback')
            return

        self.log('INFO', f'Нажатие кнопки от чата {chat_id}: {payload}')
        
        # Отвечаем на callback только для кнопок типа callback
        if payload.startswith('btn:'):
            self.answer_callback(callback_id, "✓")
        
        self.handle_button_press(chat_id, payload)
    
    def show_node(self, chat_id, node_id):
        try:
            if not self.flow_data:
                self.log('WARNING', 'Данные flow не загружены')
                return

            node = next((n for n in self.flow_data.get('nodes', []) if n['id'] == node_id), None)
            if not node:
                self.log('WARNING', f'Нода {node_id} не найдена')
                return

            self.user_states[chat_id]['current_node'] = node_id
            node_text = node.get('text', '')[:50]

            if node['type'] in ['menu', 'universal'] and node.get('buttons'):
                buttons_count = len(node['buttons'])
                self.log('DEBUG', f'Отображение ноды "{node_text}" с {buttons_count} кнопками для чата {chat_id}')

                buttons = []
                for btn in node['buttons']:
                    button_type = btn.get('type', 'callback')
                    button = {"type": button_type, "text": btn['text']}
                    
                    if button_type == 'callback':
                        button["payload"] = f"btn:{btn['id']}"
                    elif button_type == 'link':
                        button["url"] = btn.get('url', '')
                    elif button_type == 'open_app':
                        button["appId"] = btn.get('appId', '')
                    
                    buttons.append([button])

                keyboard = {
                    "type": "inline_keyboard",
                    "payload": {"buttons": buttons}
                }
                self.send_message(chat_id, node['text'], [keyboard])
            else:
                self.log('DEBUG', f'Отображение ноды "{node_text}" (без кнопок) для чата {chat_id}')
                self.send_message(chat_id, node['text'])
        except Exception as e:
            self.log('ERROR', f'Ошибка отображения ноды {node_id}: {e}')
    
    def handle_button_press(self, chat_id, payload):
        # Обработка только для кнопок типа callback (с префиксом btn:)
        if not payload.startswith('btn:'):
            return

        button_id = payload[4:]
        current_state = self.user_states.get(chat_id, {})
        current_node_id = current_state.get('current_node')
        history = current_state.get('history', [])

        if not current_node_id:
            self.log('WARNING', f'Нет текущей ноды для чата {chat_id}')
            return

        if not self.flow_data:
            self.log('WARNING', 'Данные flow не загружены')
            return

        current_node = next((n for n in self.flow_data.get('nodes', []) if n['id'] == current_node_id), None)
        if not current_node:
            self.log('WARNING', f'Текущая нода {current_node_id} не найдена')
            return

        # Проверяем тип кнопки и обрабатываем её
        if current_node.get('buttons'):
            button = next((b for b in current_node['buttons'] if b['id'] == button_id), None)
            
            if button:
                # Для кнопок типа link или open_app просто выполняем действие без перехода
                if button.get('type') in ['link', 'open_app']:
                    self.log('DEBUG', f'Кнопка {button_id} типа {button.get("type")} выполнена без перехода')
                    return
                
                # Кнопка Назад
                if button.get('isBack'):
                    if history:
                        prev_node_id = history.pop()
                        self.user_states[chat_id]['history'] = history
                        self.log('DEBUG', f'Переад на предыдущую ноду {prev_node_id} (кнопка "Назад")')
                        self.show_node(chat_id, prev_node_id)
                    else:
                        self.log('DEBUG', 'Переад на старт (история пуста)')
                        self.show_node(chat_id, 'start')
                    return

        # Переход к следующей ноде по соединению
        connection = next((c for c in self.flow_data.get('connections', []) if c['buttonId'] == button_id), None)
        if connection and connection.get('to'):
            history.append(current_node_id)
            self.user_states[chat_id]['history'] = history
            target_node_id = connection['to']
            self.log('DEBUG', f'Переад по кнопке {button_id}: {current_node_id} -> {target_node_id}')
            self.show_node(chat_id, target_node_id)
        else:
            self.log('WARNING', f'Связь для кнопки {button_id} не найдена')
    
    def handle_text_input(self, chat_id, text):
        pass
    
    def process_node_after_input(self, chat_id):
        """Переход к следующей ноде после получения ввода от пользователя"""
        current_state = self.user_states.get(chat_id, {})
        current_node_id = current_state.get('current_node')
        
        if not current_node_id:
            return
        
        # Ищем соединение от текущей ноды
        connection = next((c for c in self.flow_data.get('connections', []) 
                          if c['from'] == current_node_id and not c.get('buttonId')), None)
        
        if connection and connection.get('to'):
            history = current_state.get('history', [])
            history.append(current_node_id)
            self.user_states[chat_id]['history'] = history
            
            target_node_id = connection['to']
            self.log('DEBUG', f'Переад после ввода: {current_node_id} -> {target_node_id}')
            self.show_node(chat_id, target_node_id)
        else:
            self.log('DEBUG', f'Нет соединения для перехода от ноды {current_node_id}')

    def process_update(self, update, marker):
        update_type = update.get("update_type") or update.get("type")
        new_marker = update.get("marker") or marker
        chat_id = self.extract_chat_id(update)

        if update_type == "bot_started":
            if chat_id:
                self.log('DEBUG', f'Событие: bot_started, чат {chat_id}')
                self.handle_message({"chat": {"id": chat_id}, "text": "/start"})

        elif update_type == "message_created":
            msg = update.get("message") or {}
            body = msg.get("body", {})
            text = body.get("text", "").strip()
            if chat_id:
                # Полная структура сообщения для обработки
                full_message = {
                    "chat": {"id": chat_id},
                    "text": text,
                    "body": body
                }
                
                if text:
                    self.log('DEBUG', f'Событие: message_created, чат {chat_id}, текст: "{text[:20]}"')
                
                self.handle_message(full_message)

        elif update_type == "message_callback":
            cb = update.get("callback") or {}
            payload = cb.get("payload") or ""
            callback_id = cb.get("callback_id") or cb.get("id")
            if callback_id:
                callback_struct = {
                    "id": callback_id,
                    "payload": payload,
                    "message": {"chat": {"id": chat_id}}
                }
                self.log('DEBUG', f'Событие: message_callback, чат {chat_id}, payload: {payload}')
                self.handle_callback(callback_struct)

        return update.get("marker", marker)
    
    def run(self):
        self.running = True
        self.bot_config = get_bot(self.bot_id)
        marker = None

        self.log('INFO', f'Бот \"{self.bot_name}\" [ID:{self.bot_id}] запущен')

        try:
            url = f"{self.base_url}/me?access_token={self.bot_token}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                bot_info = response.json()
                bot_name_api = bot_info.get('name', bot_info.get('first_name', 'Неизвестный'))
                username = bot_info.get('username', 'нет')
                self.log('INFO', f'Подключен к API: @{username} ({bot_name_api})')
            else:
                self.log('WARNING', f'Не удалось получить информацию о боте. Код: {response.status_code}')
        except Exception as e:
            self.log('ERROR', f'Ошибка при проверке информации о боте: {e}')

        self.log('INFO', 'Начало обработки обновлений...')

        while self.running:
            try:
                params = {}
                if marker is not None:
                    params["marker"] = marker

                updates = self.get_updates(marker)
                if "updates" in updates and updates["updates"]:
                    updates_count = len(updates["updates"])
                    if updates_count > 0:
                        self.log('DEBUG', f'Получено {updates_count} обновлений')
                    for update in updates["updates"]:
                        marker = self.process_update(update, marker)
                if "marker" in updates:
                    marker = updates["marker"]
                time.sleep(1)
            except Exception as e:
                self.log('ERROR', f'Ошибка в основном цикле: {e}')
                time.sleep(5)

        self.log('INFO', f'Бот [ID:{self.bot_id}] остановлен')
        update_bot_status(self.bot_id, "stopped")

    def start(self):
        if not self.running:
            self.log('INFO', f'Запуск бота \"{self.bot_name}\" [ID:{self.bot_id}]')
            self.running = True
            self.thread = threading.Thread(target=self.run, daemon=True)
            self.thread.start()
            update_bot_status(self.bot_id, "running")

    def stop(self):
        self.log('INFO', f'Остановка бота "{self.bot_name}" [ID:{self.bot_id}]')
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        try:
            update_bot_status(self.bot_id, "stopped")
        except Exception as e:
            self.log('ERROR', f'Ошибка при обновлении статуса при остановке: {e}')

class BotManager:
    def __init__(self):
        self.bots = {}

    def start_bot(self, bot_id):
        try:
            if bot_id in self.bots and self.bots[bot_id].running:
                logging.warning(f"[BotManager] Бот [ID:{bot_id}] уже запущен")
                return True

            flow_data = get_bot_flow(bot_id)
            if not flow_data or not flow_data.get('nodes'):
                logging.error(f"[BotManager] Не удалось запустить бот [ID:{bot_id}]: flow не настроен")
                return False
            start_node = next((n for n in flow_data.get('nodes', []) if n.get('isStart')), None)
            if not start_node:
                logging.error(f"[BotManager] Не удалось запустить бот [ID:{bot_id}]: нет стартовой ноды")
                return False

            bot_config = get_bot(bot_id)
            if bot_config:
                bot_name = bot_config.get('name', f'Bot_{bot_id}')
            else:
                bot_name = f'Bot_{bot_id}'

            self.bots[bot_id] = BotInstance(bot_id)
            self.bots[bot_id].start()
            logging.info(f"[BotManager] Бот \"{bot_name}\" [ID:{bot_id}] успешно запущен\"")
            return True
        except Exception as e:
            logging.error(f"[BotManager] Ошибка запуска бота [ID:{bot_id}]: {e}")
            return False

    def stop_bot(self, bot_id):
        try:
            if bot_id in self.bots:
                bot_instance = self.bots[bot_id]
                bot_name = bot_instance.bot_name
                bot_instance.stop()
                del self.bots[bot_id]
                logging.info(f"[BotManager] Бот \"{bot_name}\" [ID:{bot_id}] остановлен\"")
                return True
            else:
                logging.warning(f"[BotManager] Бот [ID:{bot_id}] не найден среди запущенных")
                update_bot_status(bot_id, "stopped")
                return True
        except Exception as e:
            logging.error(f"[BotManager] Ошибка остановки бота [ID:{bot_id}]: {e}")
            return False

    def get_bot_status(self, bot_id):
        if bot_id in self.bots:
            bot_instance = self.bots[bot_id]
            if bot_instance.thread and bot_instance.thread.is_alive():
                return "running" if bot_instance.running else "stopped"
            if bot_instance.running:
                bot_instance.running = False
                update_bot_status(bot_id, "stopped")
            return "stopped"
        bot = get_bot(bot_id)
        return bot['status'] if bot else None

    def restart_bot(self, bot_id):
        bot_config = get_bot(bot_id)
        bot_name = bot_config.get('name', f'Bot_{bot_id}') if bot_config else f'Bot_{bot_id}'
        logging.info(f"[BotManager] Перезагрузка бота \"{bot_name}\" [ID:{bot_id}]\"")
        self.stop_bot(bot_id)
        time.sleep(1)
        return self.start_bot(bot_id)

bot_manager = BotManager()
