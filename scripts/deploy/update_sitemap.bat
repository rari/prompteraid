@echo off
REM Sitemap Updater Batch Script for PrompterAid
REM This script runs the Python sitemap updater

echo 🔄 Running PrompterAid Sitemap Updater...
echo.

REM Change to the project root directory (assuming script is run from scripts folder)
cd ..

REM Run the Python script
python scripts/deploy/update_sitemap.py

REM Pause to show results
echo.
pause 