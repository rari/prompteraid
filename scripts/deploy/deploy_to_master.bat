@echo off
REM Deploy to Master Script for PrompterAid
REM This script deploys changes from explore branch to master

echo 🚀 Deploying PrompterAid to master branch...
echo.

REM Get the directory of this script
set SCRIPT_DIR=%~dp0

REM Run the Python deployment script using the full path
python "%SCRIPT_DIR%deploy_to_master.py"

echo.
pause 