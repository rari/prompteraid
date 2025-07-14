#!/bin/bash

echo "PrompterAid Maintenance Toggle"
echo "============================="

if [ -f "index.html" ]; then
    if [ -f "index.html.backup" ]; then
        echo ""
        echo "ERROR: Both index.html and index.html.backup exist!"
        echo "This suggests the maintenance mode is already active."
        echo ""
        echo "To restore normal site:"
        echo "  - Delete index.html (current maintenance page)"
        echo "  - Rename index.html.backup to index.html"
        echo ""
        read -p "Press Enter to continue..."
        exit 1
    else
        echo ""
        echo "Switching to MAINTENANCE mode..."
        echo "- Backing up current index.html"
        mv "index.html" "index.html.backup"
        echo "- Activating maintenance page"
        mv "maintenance.html" "index.html"
        echo ""
        echo "✅ Maintenance mode ACTIVATED"
        echo ""
        echo "To restore normal site later, run this script again."
        echo ""
    fi
else
    if [ -f "index.html.backup" ]; then
        echo ""
        echo "Switching to NORMAL site mode..."
        echo "- Removing maintenance page"
        rm "index.html"
        echo "- Restoring original index.html"
        mv "index.html.backup" "index.html"
        echo ""
        echo "✅ Normal site RESTORED"
        echo ""
    else
        echo ""
        echo "ERROR: No index.html or index.html.backup found!"
        echo "Please ensure you have both index.html and maintenance.html files."
        echo ""
        read -p "Press Enter to continue..."
        exit 1
    fi
fi

echo ""
echo "Current status:"
if [ -f "index.html.backup" ]; then
    echo "🔧 MAINTENANCE MODE - Site shows maintenance page"
else
    echo "✅ NORMAL MODE - Site shows main content"
fi
echo ""
read -p "Press Enter to continue..." 