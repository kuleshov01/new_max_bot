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
        
        self.log('INFO', f'Инициализация бота {self.bot_id} ({self.bot_config["name"]})')
    
    def log(self, level, message):
        import sys
        log_message = f"{time.strftime('%Y-%m-%d %H:%M:%S')} - {level} - Bot {self.bot_id}: {message}"
        print(log_message, flush=True)
        try:
            add_bot_log(self.bot_id, level, message)
            logging.info(f"Bot {self.bot_id}: {level} - {message}")
        except Exception as e:
            logging.error(f"Error logging to database for bot {self.bot_id}: {e}")
        
    def get_updates(self, marker=None):
        try:
            url = f"{self.base_url}/updates"
            params = {"access_token": self.bot_config['token']}
            if marker:
                params["marker"] = marker
            logging.debug(f"Bot {self.bot_id}: Запрашиваю обновления: {url} с параметрами {params}")
            response = requests.get(url, params=params, timeout=60)
            logging.debug(f"Bot {self.bot_id}: Получен ответ status={response.status_code}")
            response.raise_for_status()
            result = response.json()
            updates_count = len(result.get('updates', []))
            if updates_count > 0:
                self.log('INFO', f'Получено {updates_count} обновлений')
                logging.debug(f"Bot {self.bot_id}: Получены обновления: {result}")
            return result
        except Exception as e:
            self.log('ERROR', f'Ошибка при получении обновлений: {e}')
            return {"updates": [], "marker": None}
    
    def send_message(self, chat_id, text, attachments=None):
        try:
            url = f"{self.base_url}/messages?access_token={self.bot_config['token']}&chat_id={chat_id}"
            headers = {"Content-Type": "application/json"}
            data = {"text": text, "format": "markdown"}
            if attachments:
                processed_attachments = []
                for attachment in attachments:
                    if isinstance(attachment, dict):
                        processed_attachments.append(attachment)
                if processed_attachments:
                    data["attachments"] = processed_attachments
            logging.debug(f"Bot {self.bot_id}: Отправляю POST: {url}, data={data}")
            response = requests.post(url, headers=headers, json=data, timeout=30)
            logging.debug(f"Bot {self.bot_id}: Получен status={response.status_code}")
            response.raise_for_status()
            self.log('INFO', f'Отправлено сообщение в чат {chat_id}: "{text[:50]}..."')
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
            self.log('DEBUG', f'handle_message вызван: {message}')
            chat_id = message.get("chat", {}).get("id")
            if not chat_id:
                chat_id = self.extract_chat_id(message)
            
            if not chat_id:
                self.log('WARNING', f'Не удалось извлечь chat_id из сообщения: {message}')
                return
            
            text = message.get("text", "")
            self.log('DEBUG', f'handle_message: chat_id={chat_id}, text="{text}"')
            
            if text == "/start":
                self.log('INFO', f'Получена команда /start от чата {chat_id}')
                self.user_states[chat_id] = {'current_node': 'start', 'history': []}
                self.show_node(chat_id, 'start')
            else:
                self.log('INFO', f'Получено сообщение от чата {chat_id}: "{text[:50]}..."')
                self.handle_text_input(chat_id, text)
        except Exception as e:
            self.log('ERROR', f'Error in handle_message: {e}')
    
    def answer_callback(self, callback_id, text=None):
        try:
            url = f"{self.base_url}/answers?access_token={self.bot_config['token']}"
            headers = {"Content-Type": "application/json"}
            data = {"callback_id": callback_id}
            if text:
                data["text"] = text
            response = requests.post(url, headers=headers, json=data, timeout=30)
            response.raise_for_status()
            self.log('INFO', f'Ответ на callback {callback_id} отправлен')
            return response.json()
        except Exception as e:
            self.log('ERROR', f'Ошибка при ответе на callback {callback_id}: {e}')
            return {}
    
    def handle_callback(self, callback):
        callback_id = callback["id"]
        payload = callback["payload"]
        chat_id = callback.get("message", {}).get("chat", {}).get("id")
        
        if not chat_id:
            chat_id = self.extract_chat_id({"message": callback.get("message", {})})
        
        if not chat_id:
            self.log('WARNING', f'Не удалось извлечь chat_id из callback: {callback}')
            return
        
        self.log('INFO', f'Получен callback от чата {chat_id}: {payload}')
        self.answer_callback(callback_id, "Ответ получен")
        self.handle_button_press(chat_id, payload)
    
    def show_node(self, chat_id, node_id):
        try:
            if not self.flow_data:
                logging.warning(f"Bot {self.bot_id}: No flow data loaded")
                return
            
            node = next((n for n in self.flow_data.get('nodes', []) if n['id'] == node_id), None)
            if not node:
                logging.warning(f"Bot {self.bot_id}: Node {node_id} not found")
                return
            
            self.user_states[chat_id]['current_node'] = node_id
            
            if node['type'] == 'menu' and node.get('buttons'):
                buttons = []
                for btn in node['buttons']:
                    buttons.append([
                        {"type": "callback", "text": btn['text'], "payload": f"btn:{btn['id']}"}
                    ])
                
                keyboard = {
                    "type": "inline_keyboard",
                    "payload": {"buttons": buttons}
                }
                self.send_message(chat_id, node['text'], [keyboard])
            else:
                self.send_message(chat_id, node['text'])
        except Exception as e:
            self.log('ERROR', f'Error in show_node for node {node_id}: {e}')
    
    def handle_button_press(self, chat_id, payload):
        if not payload.startswith('btn:'):
            return
        
        button_id = payload[4:]
        current_state = self.user_states.get(chat_id, {})
        current_node_id = current_state.get('current_node')
        history = current_state.get('history', [])
        
        if not current_node_id:
            return
        
        if not self.flow_data:
            return
        
        current_node = next((n for n in self.flow_data.get('nodes', []) if n['id'] == current_node_id), None)
        if not current_node:
            return
        
        if current_node.get('buttons'):
            button = next((b for b in current_node['buttons'] if b['id'] == button_id), None)
            if button and button.get('isBack'):
                if history:
                    prev_node_id = history.pop()
                    self.user_states[chat_id]['history'] = history
                    self.show_node(chat_id, prev_node_id)
                else:
                    self.show_node(chat_id, 'start')
                return
        
        connection = next((c for c in self.flow_data.get('connections', []) if c['buttonId'] == button_id), None)
        if connection and connection.get('to'):
            history.append(current_node_id)
            self.user_states[chat_id]['history'] = history
            self.show_node(chat_id, connection['to'])
    
    def handle_text_input(self, chat_id, text):
        pass
    
    def process_update(self, update, marker):
        update_type = update.get("update_type") or update.get("type")
        new_marker = update.get("marker") or marker
        chat_id = self.extract_chat_id(update)
        
        self.log('DEBUG', f'Тип обновления: {update_type}, chat_id: {chat_id}')
        
        if update_type == "bot_started":
            if chat_id:
                self.handle_message({"chat": {"id": chat_id}, "text": "/start"})
        
        elif update_type == "message_created":
            msg = update.get("message") or {}
            body = msg.get("body", {})
            text = body.get("text", "").strip()
            if chat_id:
                self.handle_message({"chat": {"id": chat_id}, "text": text})
        
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
                self.handle_callback(callback_struct)
        
        return update.get("marker", marker)
    
    def run(self):
        self.running = True
        self.bot_config = get_bot(self.bot_id)
        marker = None
        
        self.log('INFO', f'Бот {self.bot_config["name"]} запущен')
        
        try:
            url = f"{self.base_url}/me?access_token={self.bot_config['token']}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                bot_info = response.json()
                bot_name = bot_info.get('name', bot_info.get('first_name', 'Неизвестный'))
                username = bot_info.get('username', 'нет')
                self.log('INFO', f'Подключен к боту: {bot_name} (@{username})')
            else:
                self.log('WARNING', f'Не удалось получить информацию о боте. Код: {response.status_code}')
        except Exception as e:
            self.log('ERROR', f'Ошибка при проверке информации о боте: {e}')
        
        while self.running:
            try:
                params = {}
                if marker is not None:
                    params["marker"] = marker
                
                updates = self.get_updates(marker)
                if "updates" in updates and updates["updates"]:
                    for update in updates["updates"]:
                        marker = self.process_update(update, marker)
                if "marker" in updates:
                    marker = updates["marker"]
                time.sleep(1)
            except Exception as e:
                self.log('ERROR', f'Ошибка в основном цикле: {e}')
                time.sleep(5)
        
        self.log('INFO', f'Бот {self.bot_id} остановлен')
        update_bot_status(self.bot_id, "stopped")
    
    def start(self):
        if not self.running:
            self.log('INFO', f'Запуск бота {self.bot_id}')
            self.running = True
            self.thread = threading.Thread(target=self.run, daemon=True)
            self.thread.start()
            update_bot_status(self.bot_id, "running")
    
    def stop(self):
        self.log('INFO', f'Остановка бота {self.bot_id}')
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
                logging.warning(f"Bot {bot_id} is already running")
                return True
            
            self.bots[bot_id] = BotInstance(bot_id)
            self.bots[bot_id].start()
            return True
        except Exception as e:
            logging.error(f"Error starting bot {bot_id}: {e}")
            return False
    
    def stop_bot(self, bot_id):
        try:
            if bot_id in self.bots:
                self.bots[bot_id].stop()
                del self.bots[bot_id]
                return True
            else:
                logging.warning(f"Bot {bot_id} not found in running bots")
                update_bot_status(bot_id, "stopped")
                return True
        except Exception as e:
            logging.error(f"Error stopping bot {bot_id}: {e}")
            return False
    
    def get_bot_status(self, bot_id):
        # Проверка, если поток существует и живой
        if bot_id in self.bots:
            bot_instance = self.bots[bot_id]
            if bot_instance.thread and bot_instance.thread.is_alive():
                return "running" if bot_instance.running else "stopped"
            # Если поток не живой, остановим и обновим статус
            if bot_instance.running:
                bot_instance.running = False
                update_bot_status(bot_id, "stopped")
            return "stopped"
        bot = get_bot(bot_id)
        return bot['status'] if bot else None
    
    def restart_bot(self, bot_id):
        self.stop_bot(bot_id)
        time.sleep(1)
        return self.start_bot(bot_id)

bot_manager = BotManager()