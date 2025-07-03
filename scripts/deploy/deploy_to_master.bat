@echo off
REM Deploy to Master Script for PrompterAid
REM This script deploys changes from explore branch to master

echo 🚀 Deploying PrompterAid to master branch...
echo.

REM Change to the project root directory
cd ..

REM Run the Python deployment script
python scripts/deploy/deploy_to_master.py

REM Pause to show results
echo.
pause 