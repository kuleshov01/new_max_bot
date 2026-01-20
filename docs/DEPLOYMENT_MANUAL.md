# Руководство по развертыванию Max Bot

## Системные требования

### Минимальные требования

- **CPU:** 1 ядро
- **RAM:** 512 MB
- **Storage:** 1 GB
- **OS:** Linux (Ubuntu 20.04+, Debian 10+, CentOS 7+)
- **Python:** 3.7+

### Рекомендуемые требования

- **CPU:** 2+ ядра
- **RAM:** 1+ GB
- **Storage:** 5+ GB
- **Python:** 3.9+

## Установка

### Шаг 1. Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### Шаг 2. Установка Python и pip

```bash
sudo apt install python3 python3-pip python3-venv -y
```

### Шаг 3. Создание виртуального окружения

```bash
cd /opt
sudo mkdir max-bot
sudo chown $USER:$USER max-bot
cd max-bot
python3 -m venv venv
source venv/bin/activate
```

### Шаг 4. Установка зависимостей

```bash
pip install requests
```

### Шаг 5. Клонирование или копирование файлов

```bash
git clone <repository-url> .
# или скопируйте файлы bot.py и config.py
```

### Шаг 6. Настройка конфигурации

Создайте файл `config.py`:

```python
import os

# Токен API
TOKEN = os.getenv("MAX_BOT_TOKEN", "your_token_here")

# Payload для мини-приложений
APP_PAYLOAD = os.getenv("MAX_BOT_APP_PAYLOAD", "app_id_here")

# Базовый URL API
BASE_URL = "https://platform-api.max.ru"
```

Установите переменные окружения:

```bash
export MAX_BOT_TOKEN="your_token_here"
export MAX_BOT_APP_PAYLOAD="app_id_here"
```

Для постоянной настройки добавьте в `~/.bashrc` или создайте файл `.env`:

```bash
echo 'export MAX_BOT_TOKEN="your_token_here"' >> ~/.bashrc
echo 'export MAX_BOT_APP_PAYLOAD="app_id_here"' >> ~/.bashrc
source ~/.bashrc
```

## Запуск

### Тестовый запуск

```bash
cd /opt/max-bot
source venv/bin/activate
python bot.py
```

### Проверка работы

Отправьте команду `/start` боту в чате.

## Настройка как службы (systemd)

### Шаг 1. Создание файла службы

```bash
sudo nano /etc/systemd/system/max-bot.service
```

### Шаг 2. Конфигурация службы

```ini
[Unit]
Description=Max Bot - информационный помощник
After=network.target

[Service]
Type=simple
User=your_user
Group=your_user
WorkingDirectory=/opt/max-bot
Environment="PATH=/opt/max-bot/venv/bin"
Environment="MAX_BOT_TOKEN=your_token_here"
Environment="MAX_BOT_APP_PAYLOAD=app_id_here"
ExecStart=/opt/max-bot/venv/bin/python bot.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Замените `your_user` на имя пользователя.

### Шаг 3. Запуск службы

```bash
sudo systemctl daemon-reload
sudo systemctl enable max-bot
sudo systemctl start max-bot
```

### Шаг 4. Проверка статуса

```bash
sudo systemctl status max-bot
```

### Просмотр логов

```bash
sudo journalctl -u max-bot -f
```

## Настройка как службы (supervisor)

### Установка supervisor

```bash
sudo apt install supervisor -y
```

### Создание конфигурации

```bash
sudo nano /etc/supervisor/conf.d/max-bot.conf
```

```ini
[program:max-bot]
command=/opt/max-bot/venv/bin/python bot.py
directory=/opt/max-bot
user=your_user
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/max-bot.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=10
environment=MAX_BOT_TOKEN="your_token_here",MAX_BOT_APP_PAYLOAD="app_id_here"
```

### Запуск supervisor

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start max-bot
```

## Docker развертывание

### Создание Dockerfile

```dockerfile
FROM python:3.9-slim

WORKDIR /app

RUN pip install --no-cache-dir requests

COPY bot.py .
COPY config.py .

CMD ["python", "bot.py"]
```

### Создание .dockerignore

```
__pycache__/
*.pyc
.git/
.gitignore
.env
```

### Сборка образа

```bash
docker build -t max-bot .
```

### Запуск контейнера

```bash
docker run -d \
  --name max-bot \
  --restart unless-stopped \
  -e MAX_BOT_TOKEN="your_token_here" \
  -e MAX_BOT_APP_PAYLOAD="app_id_here" \
  max-bot
```

### Просмотр логов

```bash
docker logs -f max-bot
```

## Docker Compose

Создайте `docker-compose.yml`:

```yaml
version: '3.8'

services:
  max-bot:
    build: .
    container_name: max-bot
    restart: unless-stopped
    environment:
      - MAX_BOT_TOKEN=${MAX_BOT_TOKEN}
      - MAX_BOT_APP_PAYLOAD=${MAX_BOT_APP_PAYLOAD}
```

Создайте `.env`:

```env
MAX_BOT_TOKEN=your_token_here
MAX_BOT_APP_PAYLOAD=app_id_here
```

Запуск:

```bash
docker-compose up -d
```

## Мониторинг

### Настройка логирования

Добавьте логирование в `bot.py`:

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/max-bot/bot.log'),
        logging.StreamHandler()
    ]
)

logging.info("Bot started")
```

Создайте директорию для логов:

```bash
sudo mkdir -p /var/log/max-bot
sudo chown your_user:your_user /var/log/max-bot
```

### Настройка logrotate

Создайте `/etc/logrotate.d/max-bot`:

```
/var/log/max-bot/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 your_user your_user
}
```

### Мониторинг с помощью монитора

Установка monit:

```bash
sudo apt install monit -y
```

Конфигурация `/etc/monit/conf.d/max-bot`:

```
check process max-bot with pidfile /var/run/max-bot.pid
    start program = "/bin/systemctl start max-bot"
    stop program  = "/bin/systemctl stop max-bot"
    if memory usage > 80% for 2 cycles then alert
    if cpu usage > 80% for 2 cycles then alert
```

## Резервное копирование

### Бэкап конфигурации

```bash
#!/bin/bash
BACKUP_DIR="/backup/max-bot"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

tar -czf $BACKUP_DIR/max-bot_$DATE.tar.gz /opt/max-bot

find $BACKUP_DIR -name "max-bot_*.tar.gz" -mtime +7 -delete
```

Создайте файл `/backup/backup-max-bot.sh` и сделайте его исполняемым:

```bash
chmod +x /backup/backup-max-bot.sh
```

Добавьте в crontab:

```bash
crontab -e
```

```
0 2 * * * /backup/backup-max-bot.sh
```

## Безопасность

### Фаервол (UFW)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Ограничение прав пользователя

```bash
sudo adduser --disabled-password --gecos "" maxbot
sudo chown -R maxbot:maxbot /opt/max-bot
```

Обновите службу systemd:

```ini
User=maxbot
Group=maxbot
```

## Обновление

### Обновление кода

```bash
cd /opt/max-bot
git pull origin main
```

### Перезапуск службы

```bash
sudo systemctl restart max-bot
```

### Docker обновление

```bash
docker-compose down
docker-compose pull
docker-compose up -d
```

## Решение проблем

### Бот не запускается

Проверьте логи:

```bash
sudo journalctl -u max-bot -n 50
```

### Ошибка токена

Убедитесь, что токен указан правильно в конфигурации.

### Проблемы с API

Проверьте подключение к API:

```bash
curl -H "Authorization: your_token" https://platform-api.max.ru/updates
```

### Диагностика с помощью встроенных методов

Для диагностики также можно использовать встроенные методы бота:

```bash
# Проверка конфигурации
python check_config.py

# Проверка токена и подключения
python test_bot.py

# Проверка получения информации о боте
python test_bot_info.py
```
```

## Производительность

### Оптимизация

- Используйте кэширование для часто запрашиваемых данных
- Оптимизируйте количество API-запросов
- Используйте async/await для параллельной обработки (можно заменить requests на aiohttp)

### Масштабирование

Для масштабирования используйте:
- Несколько экземпляров бота с балансировкой нагрузки
- Redis для совместного использования состояния
- PostgreSQL для хранения данных пользователей
