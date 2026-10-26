@echo off
echo ================================================
echo   CyberRAT v2 - First Time Setup
echo ================================================
echo.
echo This will create your .env file automatically.
echo.

set /p GMAIL=Enter your Gmail address:
set /p APPPASS=Enter your Gmail App Password (16 chars):

echo FLASK_ENV=development > .env
echo SECRET_KEY=cyberrat-secret-key-2026 >> .env
echo JWT_SECRET_KEY=cyberrat-jwt-secret-2026 >> .env
echo DATABASE_URL=sqlite:///cyberrat.db >> .env
echo PORT=5000 >> .env
echo. >> .env
echo MAIL_DEBUG_MODE=false >> .env
echo MAIL_SERVER=smtp.gmail.com >> .env
echo MAIL_PORT=587 >> .env
echo MAIL_USE_TLS=true >> .env
echo MAIL_USERNAME=%GMAIL% >> .env
echo MAIL_PASSWORD=%APPPASS% >> .env
echo MAIL_DEFAULT_SENDER=%GMAIL% >> .env

echo.
echo ================================================
echo   .env file created successfully!
echo ================================================
echo.
echo Now installing dependencies...
pip install -r requirements.txt
echo.
echo DONE! Run 'python app.py' to start the backend.
echo.
pause
