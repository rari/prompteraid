#!/usr/bin/env python3
"""
GitHub Authentication Check for PrompterAid
Verifies that the repository is properly configured for the rari account.
"""

import os
import sys
import subprocess
from pathlib import Path

def check_git_config():
    """Check Git configuration."""
    print("🔍 Checking Git configuration...")
    
    try:
        # Check user config
        user_name = subprocess.run(['git', 'config', 'user.name'], 
                                 capture_output=True, text=True).stdout.strip()
        user_email = subprocess.run(['git', 'config', 'user.email'], 
                                  capture_output=True, text=True).stdout.strip()
        
        print(f"👤 User name: {user_name}")
        print(f"📧 User email: {user_email}")
        
        # Check remote URL
        remote_url = subprocess.run(['git', 'remote', 'get-url', 'origin'], 
                                  capture_output=True, text=True).stdout.strip()
        print(f"🔗 Remote URL: {remote_url}")
        
        # Check if it's the correct repository
        if 'rari/prompteraid' in remote_url:
            print("✅ Repository URL is correct for rari account")
        else:
            print("⚠️  Repository URL doesn't match rari/prompteraid")
            
    except Exception as e:
        print(f"❌ Error checking Git config: {e}")

def check_authentication():
    """Check if authentication is working."""
    print("\n🔐 Checking authentication...")
    
    try:
        # Try to fetch to test authentication
        result = subprocess.run(['git', 'fetch', '--dry-run'], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Authentication is working (fetch successful)")
        else:
            print("❌ Authentication failed (fetch failed)")
            print(f"Error: {result.stderr}")
            
    except Exception as e:
        print(f"❌ Error testing authentication: {e}")

def check_hook_status():
    """Check if the pre-commit hook is installed."""
    print("\n📋 Checking pre-commit hook status...")
    
    try:
        hook_path = Path('.git/hooks/pre-commit')
        
        if hook_path.exists():
            print("✅ Pre-commit hook is installed")
            
            # Check if it's executable
            if os.access(hook_path, os.X_OK):
                print("✅ Hook is executable")
            else:
                print("⚠️  Hook exists but may not be executable")
        else:
            print("❌ Pre-commit hook is not installed")
            print("💡 Run: python scripts/sitemap/setup_git_hook.py")
            
    except Exception as e:
        print(f"❌ Error checking hook status: {e}")

def main():
    """Main function."""
    print("🔍 PrompterAid GitHub Authentication Check")
    print("=" * 50)
    
    check_git_config()
    check_authentication()
    check_hook_status()
    
    print("\n" + "=" * 50)
    print("📝 Summary:")
    print("- If authentication is working, you can push normally")
    print("- The sitemap scripts will work with any GitHub auth method")
    print("- Make sure your GitHub account (rari) has access to the repository")
    print("- If using PAT, ensure it has repo permissions")
    print("- If using SSH, ensure your SSH key is added to GitHub")

if __name__ == "__main__":
    main() 