import os
from flask import Flask, render_template, request, jsonify
from database import add_bot, get_bot, get_all_bots, update_bot, delete_bot, get_bot_logs, clear_bot_logs
from bot_manager import bot_manager

# Try to load from .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv is not installed, continue without it

# Get the base path from environment variable or default to empty string
# This allows the app to work both at root and under /manage prefix
APPLICATION_ROOT = os.environ.get('APPLICATION_ROOT', '')

# Debug output
print(f"=== APPLICATION_ROOT = '{APPLICATION_ROOT}' ===")
if APPLICATION_ROOT:
    print(f"App will be available at: http://localhost:5000{APPLICATION_ROOT}/")
else:
    print(f"App will be available at: http://localhost:5000/")
print("=" * 50)

app = Flask(__name__,
            template_folder='../templates',
            static_folder='../static',
            static_url_path=APPLICATION_ROOT + '/static' if APPLICATION_ROOT else '/static')

# Отключаем строгое требование слэша в конце URL
app.url_map.strict_slashes = False

# Добавляем префикс ко всем роутам
def route(path, **kwargs):
    """Wrapper для добавления префикса к роутам"""
    full_path = (APPLICATION_ROOT + path) if APPLICATION_ROOT else path
    return app.route(full_path, **kwargs)

@route('/')
def index():
    return render_template('index.html', base_url=APPLICATION_ROOT)

@route('/api/config', methods=['GET'])
def get_config():
    return jsonify({'base_url': APPLICATION_ROOT})

@route('/flow-editor')
def flow_editor():
    return render_template('flow_editor.html', base_url=APPLICATION_ROOT)

@route('/api/bots', methods=['GET'])
def list_bots():
    bots = get_all_bots()
    for bot in bots:
        status = bot_manager.get_bot_status(bot['id'])
        if status:
            bot['status'] = status
    return jsonify(bots)

@route('/api/bots', methods=['POST'])
def create_bot():
    data = request.json
    name = data.get('name')
    token = data.get('token')
    base_url = data.get('base_url', 'https://platform-api.max.ru')
    
    if not name or not token:
        return jsonify({'error': 'Name and token are required'}), 400
    
    bot_id = add_bot(name, token, base_url)
    
    # Создать начальный flow с узлом 'start'
    from database import save_bot_flow
    initial_flow = {
        'nodes': [
            {
                'id': 'start',
                'type': 'menu',
                'x': 100,
                'y': 100,
                'text': '👋 Добро пожаловать! Выберите действие:',
                'buttons': [
                    {'id': 'start_1', 'text': 'Начать диалог'}
                ],
                'isStart': True
            }
        ],
        'connections': []
    }
    save_bot_flow(bot_id, initial_flow)
    
    bot = get_bot(bot_id)
    
    return jsonify(bot), 201

@route('/api/bots/<int:bot_id>', methods=['GET'])
def get_bot_by_id(bot_id):
    bot = get_bot(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404

    status = bot_manager.get_bot_status(bot_id)
    if status:
        bot['status'] = status

    return jsonify(bot)

@route('/api/bots/<int:bot_id>', methods=['PUT'])
def update_bot_by_id(bot_id):
    data = request.json
    update_bot(
        bot_id,
        name=data.get('name'),
        token=data.get('token'),
        base_url=data.get('base_url'),
        text_restriction_enabled=data.get('text_restriction_enabled'),
        text_restriction_warning=data.get('text_restriction_warning'),
        allowed_commands=data.get('allowed_commands')
    )

    bot = get_bot(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404

    return jsonify(bot)

@route('/api/bots/<int:bot_id>', methods=['DELETE'])
def delete_bot_by_id(bot_id):
    bot_manager.stop_bot(bot_id)
    delete_bot(bot_id)
    return jsonify({'message': 'Bot deleted successfully'})

@route('/api/bots/<int:bot_id>/start', methods=['POST'])
def start_bot(bot_id):
    success = bot_manager.start_bot(bot_id)
    if success:
        return jsonify({'message': 'Bot started successfully'})
    return jsonify({'error': 'Failed to start bot'}), 500

@route('/api/bots/<int:bot_id>/stop', methods=['POST'])
def stop_bot(bot_id):
    success = bot_manager.stop_bot(bot_id)
    if success:
        return jsonify({'message': 'Bot stopped successfully'})
    return jsonify({'error': 'Failed to stop bot'}), 500

@route('/api/bots/<int:bot_id>/restart', methods=['POST'])
def restart_bot(bot_id):
    success = bot_manager.restart_bot(bot_id)
    if success:
        return jsonify({'message': 'Bot restarted successfully'})
    return jsonify({'error': 'Failed to restart bot'}), 500

@route('/api/bots/<int:bot_id>/reload-restriction', methods=['POST'])
def reload_bot_restriction(bot_id):
    """Перезагружает настройки ограничения текстовых сообщений без перезапуска бота."""
    try:
        if bot_id in bot_manager.bots:
            bot_instance = bot_manager.bots[bot_id]
            bot_instance.reload_restriction_settings()
            return jsonify({'message': 'Restriction settings reloaded successfully'})
        else:
            return jsonify({'error': 'Bot is not running'}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to reload restriction settings: {str(e)}'}), 500

@route('/api/bots/<int:bot_id>/flow', methods=['GET'])
def get_bot_flow(bot_id):
    bot = get_bot(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404

    from database import get_bot_flow
    flow_data = get_bot_flow(bot_id)
    return jsonify(flow_data or {'nodes': [], 'connections': []})

@route('/api/bots/<int:bot_id>/flow', methods=['POST'])
def save_bot_flow(bot_id):
    bot = get_bot(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404

    flow_data = request.json
    from database import save_bot_flow
    try:
        save_bot_flow(bot_id, flow_data)
        return jsonify({'message': 'Flow saved successfully'})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

@route('/api/bots/<int:bot_id>/logs', methods=['GET'])
def get_bot_logs_endpoint(bot_id):
    try:
        bot = get_bot(bot_id)
        if not bot:
            return jsonify({'error': 'Bot not found'}), 404

        limit = request.args.get('limit', 100, type=int)
        logs = get_bot_logs(bot_id, limit)
        response = jsonify(logs)
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
    except Exception as e:
        print(f"Error getting logs for bot {bot_id}: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@route('/api/bots/<int:bot_id>/logs', methods=['DELETE'])
def clear_bot_logs_endpoint(bot_id):
    bot = get_bot(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404

    clear_bot_logs(bot_id)
    return jsonify({'message': 'Logs cleared successfully'})

started = False

@app.before_request
def startup():
    global started
    if not started:
        try:
            # Выполняем миграцию базы данных
            from database import migrate_add_text_restriction_fields
            migrate_add_text_restriction_fields()
            
            bots = get_all_bots()
            for bot in bots:
                if bot['status'] == 'running':
                    bot_manager.start_bot(bot['id'])
            started = True
        except Exception as e:
            print(f"Error starting bots on startup: {e}")

if __name__ == '__main__':
    app.run(debug=True)
