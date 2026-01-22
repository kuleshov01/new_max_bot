import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_FILE = '/storage/self/primary/Project/new_max_bot/data/db/bots_data.db'

def init_db():
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
    
    conn.commit()
    conn.close()

def add_bot(name, token, base_url='https://platform-api.max.ru'):
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
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM bots WHERE id = ?', (bot_id,))
    bot = cursor.fetchone()
    
    conn.close()
    
    if bot:
        return {
            'id': bot[0],
            'name': bot[1],
            'token': bot[2],
            'base_url': bot[3],
            'start_message': bot[4],
            'menu_config': json.loads(bot[5]) if bot[5] else [],
            'status': bot[6],
            'created_at': bot[7],
            'updated_at': bot[8]
        }
    return None

def get_all_bots():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM bots')
    bots = cursor.fetchall()
    
    conn.close()
    
    return [
        {
            'id': bot[0],
            'name': bot[1],
            'token': bot[2],
            'base_url': bot[3],
            'start_message': bot[4],
            'menu_config': json.loads(bot[5]) if bot[5] else [],
            'status': bot[6],
            'created_at': bot[7],
            'updated_at': bot[8]
        }
        for bot in bots
    ]

def update_bot(bot_id, name=None, token=None, base_url=None):
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
    
    updates.append('updated_at = ?')
    values.append(datetime.now().isoformat())
    values.append(bot_id)
    
    if updates:
        cursor.execute(f'UPDATE bots SET {", ".join(updates)} WHERE id = ?', values)
    
    conn.commit()
    conn.close()

def delete_bot(bot_id):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM bots WHERE id = ?', (bot_id,))
    
    conn.commit()
    conn.close()

def update_bot_status(bot_id, status):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('UPDATE bots SET status = ?, updated_at = ? WHERE id = ?', 
                   (status, datetime.now().isoformat(), bot_id))
    
    conn.commit()
    conn.close()

def save_bot_flow(bot_id, flow_data):
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
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT flow_data FROM bot_flows WHERE bot_id = ?', (bot_id,))
    result = cursor.fetchone()
    
    conn.close()
    
    if result:
        return json.loads(result[0])
    return None

def add_bot_log(bot_id, level, message):
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
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM bot_logs WHERE bot_id = ?', (bot_id,))
    
    conn.commit()
    conn.close()

init_db()
