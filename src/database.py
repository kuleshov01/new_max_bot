import sqlite3
import json
import os
from datetime import datetime
from pathlib import Path

# Определяем базовую директорию проекта (директория, содержащая src/)
BASE_DIR = Path(__file__).parent.parent
DB_FILE = str(BASE_DIR / 'data' / 'db' / 'bots_data.db')
LOGS_DIR = str(BASE_DIR / 'data' / 'logs')

# Флаг для отслеживания инициализации БД
_db_initialized = False

def ensure_directories():
    """Создаёт необходимые директории, если они не существуют"""
    db_dir = os.path.dirname(DB_FILE)
    os.makedirs(db_dir, exist_ok=True)
    os.makedirs(LOGS_DIR, exist_ok=True)

def init_db():
    """Инициализирует базу данных, создавая таблицы если они не существуют"""
    global _db_initialized
    if _db_initialized:
        return
    
    # Убеждаемся, что директории существуют
    ensure_directories()
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            token TEXT NOT NULL,
            base_url TEXT NOT NULL DEFAULT 'https://platform-api.max.ru',
            start_message TEXT,
            menu_config TEXT,
            status TEXT DEFAULT 'stopped',
            text_restriction_enabled INTEGER DEFAULT 1,
            text_restriction_warning TEXT DEFAULT 'Для управления ботом, пожалуйста, используйте кнопки ⬇️',
            allowed_commands TEXT DEFAULT '["/start", "/help"]',
            created_at TEXT,
            updated_at TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bot_flows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_id INTEGER NOT NULL,
            flow_data TEXT NOT NULL,
            updated_at TEXT,
            FOREIGN KEY (bot_id) REFERENCES bots (id) ON DELETE CASCADE
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bot_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_id INTEGER NOT NULL,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (bot_id) REFERENCES bots (id) ON DELETE CASCADE
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS custom_commands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_id INTEGER NOT NULL,
            command TEXT NOT NULL,
            description TEXT,
            flow_data TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            created_at TEXT,
            updated_at TEXT,
            UNIQUE(bot_id, command),
            FOREIGN KEY (bot_id) REFERENCES bots (id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    conn.close()
    _db_initialized = True

def add_bot(name, token, base_url='https://platform-api.max.ru'):
    """Добавляет нового бота в базу данных. БД создаётся автоматически при первом вызове."""
    init_db()  # Автоматическая инициализация при первом использовании
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    now = datetime.now().isoformat()
    cursor.execute('''
        INSERT INTO bots (name, token, base_url, status, created_at, updated_at)
        VALUES (?, ?, ?, 'stopped', ?, ?)
    ''', (name, token, base_url, now, now))
    
    bot_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return bot_id

def get_bot(bot_id):
    """Получает информацию о боте по ID. Если БД не существует, возвращает None."""
    if not os.path.exists(DB_FILE):
        return None
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Получаем данные с именами колонок для безопасности
    cursor.execute('PRAGMA table_info(bots)')
    columns = [col[1] for col in cursor.fetchall()]
    
    cursor.execute('SELECT * FROM bots WHERE id = ?', (bot_id,))
    bot = cursor.fetchone()
    
    conn.close()
    
    if bot:
        # Создаём словарь по именам колонок
        bot_dict = dict(zip(columns, bot))
        
        return {
            'id': bot_dict.get('id'),
            'name': bot_dict.get('name'),
            'token': bot_dict.get('token'),
            'base_url': bot_dict.get('base_url'),
            'start_message': bot_dict.get('start_message'),
            'menu_config': json.loads(bot_dict['menu_config']) if bot_dict.get('menu_config') else [],
            'status': bot_dict.get('status'),
            'text_restriction_enabled': bool(bot_dict.get('text_restriction_enabled')) if bot_dict.get('text_restriction_enabled') is not None else True,
            'text_restriction_warning': bot_dict.get('text_restriction_warning') if bot_dict.get('text_restriction_warning') else 'Для управления ботом, пожалуйста, используйте кнопки ⬇️',
            'allowed_commands': json.loads(bot_dict['allowed_commands']) if bot_dict.get('allowed_commands') else ['/start', '/help'],
            'created_at': bot_dict.get('created_at'),
            'updated_at': bot_dict.get('updated_at')
        }
    return None

def get_all_bots():
    """Получает список всех ботов. Если БД не существует, возвращает пустой список."""
    if not os.path.exists(DB_FILE):
        return []
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Получаем имена колонок для безопасного доступа
    cursor.execute('PRAGMA table_info(bots)')
    columns = [col[1] for col in cursor.fetchall()]
    
    cursor.execute('SELECT * FROM bots')
    bots = cursor.fetchall()
    
    conn.close()
    
    result = []
    for bot in bots:
        # Создаём словарь по именам колонок
        bot_dict = dict(zip(columns, bot))
        
        result.append({
            'id': bot_dict.get('id'),
            'name': bot_dict.get('name'),
            'token': bot_dict.get('token'),
            'base_url': bot_dict.get('base_url'),
            'start_message': bot_dict.get('start_message'),
            'menu_config': json.loads(bot_dict['menu_config']) if bot_dict.get('menu_config') else [],
            'status': bot_dict.get('status'),
            'text_restriction_enabled': bool(bot_dict.get('text_restriction_enabled')) if bot_dict.get('text_restriction_enabled') is not None else True,
            'text_restriction_warning': bot_dict.get('text_restriction_warning') if bot_dict.get('text_restriction_warning') else 'Для управления ботом, пожалуйста, используйте кнопки ⬇️',
            'allowed_commands': json.loads(bot_dict['allowed_commands']) if bot_dict.get('allowed_commands') else ['/start', '/help'],
            'created_at': bot_dict.get('created_at'),
            'updated_at': bot_dict.get('updated_at')
        })
    
    return result

def update_bot(bot_id, name=None, token=None, base_url=None, text_restriction_enabled=None, text_restriction_warning=None, allowed_commands=None):
    """Обновляет информацию о боте. БД создаётся автоматически при первом вызове."""
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    updates = []
    values = []
    
    if name:
        updates.append('name = ?')
        values.append(name)
    if token:
        updates.append('token = ?')
        values.append(token)
    if base_url:
        updates.append('base_url = ?')
        values.append(base_url)
    if text_restriction_enabled is not None:
        updates.append('text_restriction_enabled = ?')
        values.append(1 if text_restriction_enabled else 0)
    if text_restriction_warning is not None:
        updates.append('text_restriction_warning = ?')
        values.append(text_restriction_warning)
    if allowed_commands is not None:
        updates.append('allowed_commands = ?')
        values.append(json.dumps(allowed_commands))
    
    updates.append('updated_at = ?')
    values.append(datetime.now().isoformat())
    values.append(bot_id)
    
    if updates:
        cursor.execute(f'UPDATE bots SET {", ".join(updates)} WHERE id = ?', values)
    
    conn.commit()
    conn.close()

def delete_bot(bot_id):
    """Удаляет бота из базы данных."""
    if not os.path.exists(DB_FILE):
        return
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM bots WHERE id = ?', (bot_id,))
    
    conn.commit()
    conn.close()

def update_bot_status(bot_id, status):
    """Обновляет статус бота. БД создаётся автоматически при первом вызове."""
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('UPDATE bots SET status = ?, updated_at = ? WHERE id = ?', 
                   (status, datetime.now().isoformat(), bot_id))
    
    conn.commit()
    conn.close()

def save_bot_flow(bot_id, flow_data):
    """Сохраняет flow для бота. БД создаётся автоматически при первом вызове."""
    init_db()
    # Проверяем, что flow не пустой
    nodes = flow_data.get('nodes', [])
    if not nodes:
        raise ValueError("Cannot save empty flow - at least one node is required")
    
    # Проверяем, что есть хотя бы один start-узел
    start_node = next((n for n in nodes if n.get('isStart')), None)
    if not start_node:
        raise ValueError("Cannot save flow without start node - at least one node must have isStart: true")
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    now = datetime.now().isoformat()
    
    cursor.execute('SELECT id FROM bot_flows WHERE bot_id = ?', (bot_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
            UPDATE bot_flows SET flow_data = ?, updated_at = ? WHERE bot_id = ?
        ''', (json.dumps(flow_data), now, bot_id))
    else:
        cursor.execute('''
            INSERT INTO bot_flows (bot_id, flow_data, updated_at)
            VALUES (?, ?, ?)
        ''', (bot_id, json.dumps(flow_data), now))
    
    conn.commit()
    conn.close()

def get_bot_flow(bot_id):
    """Получает flow бота. Если БД не существует, возвращает None."""
    if not os.path.exists(DB_FILE):
        return None
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT flow_data FROM bot_flows WHERE bot_id = ?', (bot_id,))
    result = cursor.fetchone()
    
    conn.close()
    
    if result:
        return json.loads(result[0])
    return None

def add_bot_log(bot_id, level, message):
    """Добавляет лог для бота. БД создаётся автоматически при первом вызове."""
    init_db()
    import time
    for attempt in range(5):
        try:
            conn = sqlite3.connect(DB_FILE, timeout=5.0)
            cursor = conn.cursor()
            
            now = datetime.now().isoformat()
            cursor.execute('''
                INSERT INTO bot_logs (bot_id, level, message, timestamp)
                VALUES (?, ?, ?, ?)
            ''', (bot_id, level, message, now))
            
            conn.commit()
            conn.close()
            return
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e):
                time.sleep(0.1)
                continue
            else:
                raise
    raise Exception("Failed to add log after retries")

def get_bot_logs(bot_id, limit=100):
    """Получает логи бота. Если БД не существует, возвращает пустой список."""
    if not os.path.exists(DB_FILE):
        return []
    init_db()
    import time
    for attempt in range(5):
        try:
            conn = sqlite3.connect(DB_FILE, timeout=5.0)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, bot_id, level, message, timestamp 
                FROM bot_logs 
                WHERE bot_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            ''', (bot_id, limit))
            
            logs = cursor.fetchall()
            
            conn.close()
            
            return [
                {
                    'id': log[0],
                    'bot_id': log[1],
                    'level': log[2],
                    'message': log[3],
                    'timestamp': log[4]
                }
                for log in logs
            ]
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e):
                time.sleep(0.1)
                continue
            else:
                raise
    raise Exception("Failed to get logs after retries")

def clear_bot_logs(bot_id):
    """Очищает логи бота."""
    if not os.path.exists(DB_FILE):
        return
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM bot_logs WHERE bot_id = ?', (bot_id,))
    
    conn.commit()
    conn.close()

def migrate_add_text_restriction_fields():
    """
    Миграция для добавления полей ограничения текстовых сообщений в существующую БД.
    Эта функция безопасна для многократного вызова.
    """
    if not os.path.exists(DB_FILE):
        return
    
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # Проверяем, существуют ли новые колонки
        cursor.execute("PRAGMA table_info(bots)")
        columns = [column[1] for column in cursor.fetchall()]
        
        # Добавляем недостающие колонки
        if 'text_restriction_enabled' not in columns:
            cursor.execute('''
                ALTER TABLE bots ADD COLUMN text_restriction_enabled INTEGER DEFAULT 1
            ''')
            print("Добавлено поле text_restriction_enabled")
        
        if 'text_restriction_warning' not in columns:
            cursor.execute('''
                ALTER TABLE bots ADD COLUMN text_restriction_warning TEXT DEFAULT 'Для управления ботом, пожалуйста, используйте кнопки ⬇️'
            ''')
            print("Добавлено поле text_restriction_warning")
        
        if 'allowed_commands' not in columns:
            cursor.execute('''
                ALTER TABLE bots ADD COLUMN allowed_commands TEXT DEFAULT '["/start", "/help"]'
            ''')
            print("Добавлено поле allowed_commands")
        
        conn.commit()
        print("Миграция успешно выполнена")
        
    except sqlite3.OperationalError as e:
        print(f"Ошибка миграции: {e}")
    finally:
        conn.close()

# ==========================================================================
# Функции для работы с пользовательскими командами
# ==========================================================================

def add_custom_command(bot_id, command, description='', flow_data=None):
    """Добавляет пользовательскую команду для бота."""
    init_db()
    if flow_data is None:
        flow_data = {'nodes': [], 'connections': []}
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    now = datetime.now().isoformat()
    
    try:
        cursor.execute('''
            INSERT INTO custom_commands (bot_id, command, description, flow_data, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
        ''', (bot_id, command, description, json.dumps(flow_data), now, now))
        
        command_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return command_id
    except sqlite3.IntegrityError:
        conn.close()
        raise ValueError(f"Команда '{command}' уже существует для этого бота")

def get_custom_commands(bot_id):
    """Получает список всех пользовательских команд бота."""
    if not os.path.exists(DB_FILE):
        return []
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, bot_id, command, description, flow_data, enabled, created_at, updated_at
        FROM custom_commands
        WHERE bot_id = ?
        ORDER BY command ASC
    ''', (bot_id,))
    
    commands = cursor.fetchall()
    conn.close()
    
    return [
        {
            'id': cmd[0],
            'bot_id': cmd[1],
            'command': cmd[2],
            'description': cmd[3],
            'flow_data': json.loads(cmd[4]) if cmd[4] else {'nodes': [], 'connections': []},
            'enabled': bool(cmd[5]),
            'created_at': cmd[6],
            'updated_at': cmd[7]
        }
        for cmd in commands
    ]

def get_custom_command(bot_id, command):
    """Получает конкретную пользовательскую команду бота."""
    if not os.path.exists(DB_FILE):
        return None
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, bot_id, command, description, flow_data, enabled, created_at, updated_at
        FROM custom_commands
        WHERE bot_id = ? AND command = ?
    ''', (bot_id, command))
    
    cmd = cursor.fetchone()
    conn.close()
    
    if cmd:
        return {
            'id': cmd[0],
            'bot_id': cmd[1],
            'command': cmd[2],
            'description': cmd[3],
            'flow_data': json.loads(cmd[4]) if cmd[4] else {'nodes': [], 'connections': []},
            'enabled': bool(cmd[5]),
            'created_at': cmd[6],
            'updated_at': cmd[7]
        }
    return None

def get_custom_command_by_id(command_id):
    """Получает пользовательскую команду по ID."""
    if not os.path.exists(DB_FILE):
        return None
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, bot_id, command, description, flow_data, enabled, created_at, updated_at
        FROM custom_commands
        WHERE id = ?
    ''', (command_id,))
    
    cmd = cursor.fetchone()
    conn.close()
    
    if cmd:
        return {
            'id': cmd[0],
            'bot_id': cmd[1],
            'command': cmd[2],
            'description': cmd[3],
            'flow_data': json.loads(cmd[4]) if cmd[4] else {'nodes': [], 'connections': []},
            'enabled': bool(cmd[5]),
            'created_at': cmd[6],
            'updated_at': cmd[7]
        }
    return None

def update_custom_command(command_id, command=None, description=None, flow_data=None, enabled=None):
    """Обновляет пользовательскую команду."""
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    updates = []
    values = []
    
    if command is not None:
        updates.append('command = ?')
        values.append(command)
    if description is not None:
        updates.append('description = ?')
        values.append(description)
    if flow_data is not None:
        updates.append('flow_data = ?')
        values.append(json.dumps(flow_data))
    if enabled is not None:
        updates.append('enabled = ?')
        values.append(1 if enabled else 0)
    
    updates.append('updated_at = ?')
    values.append(datetime.now().isoformat())
    values.append(command_id)
    
    if updates:
        cursor.execute(f'UPDATE custom_commands SET {", ".join(updates)} WHERE id = ?', values)
    
    conn.commit()
    conn.close()

def delete_custom_command(command_id):
    """Удаляет пользовательскую команду."""
    if not os.path.exists(DB_FILE):
        return
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM custom_commands WHERE id = ?', (command_id,))
    
    conn.commit()
    conn.close()

def save_custom_command_flow(command_id, flow_data):
    """Сохраняет flow для пользовательской команды."""
    init_db()
    # Проверяем, что flow не пустой
    nodes = flow_data.get('nodes', [])
    if not nodes:
        raise ValueError("Cannot save empty flow - at least one node is required")
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    now = datetime.now().isoformat()
    
    cursor.execute('''
        UPDATE custom_commands SET flow_data = ?, updated_at = ? WHERE id = ?
    ''', (json.dumps(flow_data), now, command_id))
    
    conn.commit()
    conn.close()

def get_custom_command_flow(command_id):
    """Получает flow пользовательской команды."""
    if not os.path.exists(DB_FILE):
        return None
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT flow_data FROM custom_commands WHERE id = ?', (command_id,))
    result = cursor.fetchone()
    
    conn.close()
    
    if result:
        return json.loads(result[0])
    return None

def migrate_add_custom_commands_table():
    """
    Миграция для добавления таблицы пользовательских команд в существующую БД.
    Эта функция безопасна для многократного вызова.
    """
    if not os.path.exists(DB_FILE):
        return
    
    init_db()
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    try:
        # Проверяем, существует ли таблица custom_commands
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='custom_commands'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            # Создаём таблицу custom_commands
            cursor.execute('''
                CREATE TABLE custom_commands (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bot_id INTEGER NOT NULL,
                    command TEXT NOT NULL,
                    description TEXT,
                    flow_data TEXT NOT NULL,
                    enabled INTEGER DEFAULT 1,
                    created_at TEXT,
                    updated_at TEXT,
                    UNIQUE(bot_id, command),
                    FOREIGN KEY (bot_id) REFERENCES bots (id) ON DELETE CASCADE
                )
            ''')
            print("Таблица custom_commands создана")
        else:
            print("Таблица custom_commands уже существует")
        
        conn.commit()
        print("Миграция custom_commands выполнена успешно")
        
    except sqlite3.OperationalError as e:
        print(f"Ошибка миграции: {e}")
    finally:
        conn.close()

# БД больше не инициализируется автоматически при импорте модуля
# Инициализация происходит при первом вызове любой функции, работающей с БД
