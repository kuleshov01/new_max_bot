#!/usr/bin/env python3
import sys
sys.path.insert(0, 'src')
from database import get_bot_logs, get_all_bots

bots = get_all_bots()
print('Bots:', bots)
if bots:
    bot_id = bots[0]['id']
    logs = get_bot_logs(bot_id, 10)
    print(f'Logs for bot {bot_id}:', logs)
