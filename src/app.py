from flask import Flask, render_template, request, jsonify
from database import add_bot, get_bot, get_all_bots, update_bot, delete_bot, get_bot_logs, clear_bot_logs
from bot_manager import bot_manager

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/flow-editor')
def flow_editor():
    return render_template('flow_editor.html')

@app.route('/api/bots', methods=['GET'])
def list_bots():
    bots = get_all_bots()
    for bot in bots:
        status = bot_manager.get_bot_status(bot['id'])
        if status:
            bot['status'] = status
    return jsonify(bots)

@app.route('/api/bots', methods=['POST'])
def create_bot():
    data = request.json
    name = data.get('name')
    token = data.get('token')
    base_url = data.get('base_url', 'https://platform-api.max.ru')
    start_message = data.get('start_message', '')
    menu_config = data.get('menu_config', [])
    
    if not name or not token:
        return jsonify({'error': 'Name and token are required'}), 400
    
    bot_id = add_bot(name, token, base_url, start_message, menu_config)
    bot = get_bot(bot_id)
    
    return jsonify(bot), 201

@app.route('/api/bots/<int:bot_id>', methods=['GET'])
def get_bot_by_id(bot_id):
    bot = get_bot(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    status = bot_manager.get_bot_status(bot_id)
    if status:
        bot['status'] = status
    
    return jsonify(bot)

@app.route('/api/bots/<int:bot_id>', methods=['PUT'])
def update_bot_by_id(bot_id):
    data = request.json
    update_bot(
        bot_id,
        name=data.get('name'),
        token=data.get('token'),
        base_url=data.get('base_url'),
        start_message=data.get('start_message'),
        menu_config=data.get('menu_config')
    )
    
    bot = get_bot(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    return jsonify(bot)

@app.route('/api/bots/<int:bot_id>', methods=['DELETE'])
def delete_bot_by_id(bot_id):
    bot_manager.stop_bot(bot_id)
    delete_bot(bot_id)
    return jsonify({'message': 'Bot deleted successfully'})

@app.route('/api/bots/<int:bot_id>/start', methods=['POST'])
def start_bot(bot_id):
    success = bot_manager.start_bot(bot_id)
    if success:
        return jsonify({'message': 'Bot started successfully'})
    return jsonify({'error': 'Failed to start bot'}), 500

@app.route('/api/bots/<int:bot_id>/stop', methods=['POST'])
def stop_bot(bot_id):
    success = bot_manager.stop_bot(bot_id)
    if success:
        return jsonify({'message': 'Bot stopped successfully'})
    return jsonify({'error': 'Failed to stop bot'}), 500

@app.route('/api/bots/<int:bot_id>/restart', methods=['POST'])
def restart_bot(bot_id):
    success = bot_manager.restart_bot(bot_id)
    if success:
        return jsonify({'message': 'Bot restarted successfully'})
    return jsonify({'error': 'Failed to restart bot'}), 500

@app.route('/api/bots/<int:bot_id>/flow', methods=['GET'])
def get_bot_flow(bot_id):
    bot = get_bot(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    from database import get_bot_flow
    flow_data = get_bot_flow(bot_id)
    return jsonify(flow_data or {'nodes': [], 'connections': []})

@app.route('/api/bots/<int:bot_id>/flow', methods=['POST'])
def save_bot_flow(bot_id):
    bot = get_bot(bot_id)
    if not bot:
        return jsonify({'error': 'Bot not found'}), 404
    
    flow_data = request.json
    from database import save_bot_flow
    save_bot_flow(bot_id, flow_data)
    return jsonify({'message': 'Flow saved successfully'})

@app.route('/api/bots/<int:bot_id>/logs', methods=['GET'])
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

@app.route('/api/bots/<int:bot_id>/logs', methods=['DELETE'])
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
            bots = get_all_bots()
            for bot in bots:
                if bot['status'] == 'running':
                    bot_manager.start_bot(bot['id'])
            started = True
        except Exception as e:
            print(f"Error starting bots on startup: {e}")

if __name__ == '__main__':
    app.run(debug=True)
