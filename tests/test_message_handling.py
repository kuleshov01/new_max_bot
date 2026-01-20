#!/usr/bin/env python3
"""
Тест для проверки обработки сообщений ботом
"""

import sys
import time
import json
from unittest.mock import patch, MagicMock
from bot import handle_message, handle_callback, send_message, answer_callback
