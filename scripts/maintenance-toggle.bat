@echo off
setlocal enabledelayedexpansion

echo PrompterAid Maintenance Toggle
echo =============================

if exist "index.html" (
    if exist "index.html.backup" (
        echo.
        echo ERROR: Both index.html and index.html.backup exist!
        echo This suggests the maintenance mode is already active.
        echo.
        echo To restore normal site:
        echo   - Delete index.html (current maintenance page)
        echo   - Rename index.html.backup to index.html
        echo.
        pause
        exit /b 1
    ) else (
        echo.
        echo Switching to MAINTENANCE mode...
        echo - Backing up current index.html
        ren "index.html" "index.html.backup"
        echo - Activating maintenance page
        ren "maintenance.html" "index.html"
        echo.
        echo ✅ Maintenance mode ACTIVATED
        echo.
        echo To restore normal site later, run this script again.
        echo.
    )
) else (
    if exist "index.html.backup" (
        echo.
        echo Switching to NORMAL site mode...
        echo - Removing maintenance page
        del "index.html"
        echo - Restoring original index.html
        ren "index.html.backup" "index.html"
        echo.
        echo ✅ Normal site RESTORED
        echo.
    ) else (
        echo.
        echo ERROR: No index.html or index.html.backup found!
        echo Please ensure you have both index.html and maintenance.html files.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo Current status:
if exist "index.html.backup" (
    echo 🔧 MAINTENANCE MODE - Site shows maintenance page
) else (
    echo ✅ NORMAL MODE - Site shows main content
)
echo.
pause 