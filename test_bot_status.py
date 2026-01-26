#!/usr/bin/env python3
import sys
sys.path.insert(0, 'src')
from database import get_bot, update_bot_status
from bot_manager import bot_manager

bot = get_bot(7)
print('Bot from DB:', bot)
print('Status from DB:', bot['status'])

status = bot_manager.get_bot_status(7)
print('Status from bot_manager:', status)
