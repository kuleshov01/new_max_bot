# Установка переменной окружения APPLICATION_ROOT

Для работы сайта по адресу `https://max.sakhalin.gov.ru/manage` необходимо установить переменную окружения `APPLICATION_ROOT=/manage`.

## Способ 1: Через командную строку (Linux/Mac)

### Перед запуском приложения:
```bash
export APPLICATION_ROOT=/manage
python src/app.py
```

### В одной команде:
```bash
APPLICATION_ROOT=/manage python src/app.py
```

## Способ 2: Через командную строку (Windows)

### PowerShell:
```powershell
$env:APPLICATION_ROOT="/manage"; python src\app.py
```

### CMD:
```cmd
set APPLICATION_ROOT=/manage && python src\app.py
```

## Способ 3: Создать .env файл (рекомендуется)

1. **Установить python-dotenv:**
```bash
pip install python-dotenv
```

2. **Создать файл `.env` в корне проекта:**
```
APPLICATION_ROOT=/manage
```

3. **Обновить `src/app.py`** для загрузки переменных из .env:
```python
from dotenv import load_dotenv
load_dotenv()

APPLICATION_ROOT = os.environ.get('APPLICATION_ROOT', '')
```

## Способ 4: Через systemd service (для продакшена)

Создайте файл `/etc/systemd/system/max-bot.service`:
```ini
[Unit]
Description=Max Bot Manager
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/new_max_bot
Environment="APPLICATION_ROOT=/manage"
ExecStart=/usr/bin/python3 src/app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Активируйте сервис:
```bash
sudo systemctl daemon-reload
sudo systemctl enable max-bot
sudo systemctl start max-bot
```

## Способ 5: Через gunicorn (рекомендуется для продакшена)

```bash
pip install gunicorn
```

Запуск:
```bash
APPLICATION_ROOT=/manage gunicorn -w 4 -b 0.0.0.0:5000 src.app:app
```

## Способ 6: Через nginx + gunicorn

### Конфигурация nginx (`/etc/nginx/sites-available/max-bot`):
```nginx
server {
    listen 80;
    server_name max.sakhalin.gov.ru;

    location /manage {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Создайте systemd service как в Способе 4, но с gunicorn:
```ini
ExecStart=/usr/bin/gunicorn -w 4 -b 127.0.0.1:5000 src.app:app
```

## Проверка

После установки переменной проверьте, что она работает:

1. Запустите приложение
2. Откройте в браузере: `http://your-server/manage`
3. API запросы должны идти на `http://your-server/manage/api/bots` вместо `http://your-server/api/bots`

## Быстрая проверка переменной

```bash
echo $APPLICATION_ROOT
```

Должно вывести: `/manage`
