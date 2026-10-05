@echo off
REM Setup script for ITSM ML Project (Windows)

echo ======================================
echo ITSM ML Project - Setup Script
echo ======================================
echo.

REM Check Python
echo Checking Python installation...
python --version
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.8 or higher.
    pause
    exit /b 1
)

REM Create virtual environment
echo.
echo Creating virtual environment...
python -m venv venv

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo.
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install requirements
echo.
echo Installing dependencies...
pip install -r requirements.txt

echo.
echo ======================================
echo Setup Complete!
echo ======================================
echo.
echo Next steps:
echo 1. Activate the virtual environment:
echo    venv\Scripts\activate
echo.
echo 2. Run the pipeline:
echo    cd src ^&^& python main_pipeline.py
echo.
echo 3. (Optional) Configure OpenAI API:
echo    echo OPENAI_API_KEY=your-key ^> .env
echo.
pause
