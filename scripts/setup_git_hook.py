#!/usr/bin/env python3
"""
Git Hook Setup Script for PrompterAid
Installs the pre-commit hook to automatically update sitemap.xml.
"""

import os
import sys
import subprocess
from pathlib import Path

def install_git_hook():
    """Install the pre-commit hook."""
    
    try:
        # Get the repository root
        repo_root = subprocess.run(['git', 'rev-parse', '--show-toplevel'], 
                                 capture_output=True, text=True, check=True).stdout.strip()
        
        # Paths for the hook
        hooks_dir = Path(repo_root) / '.git' / 'hooks'
        hook_file = hooks_dir / 'pre-commit'
        script_path = Path(__file__).parent / 'pre-commit-hook.py'
        
        # Create hooks directory if it doesn't exist
        hooks_dir.mkdir(parents=True, exist_ok=True)
        
        # Create the hook file
        hook_content = f"""#!/bin/bash
# PrompterAid Pre-commit Hook
# Automatically updates sitemap.xml when HTML files are changed

python3 "{script_path.absolute()}"
"""
        
        with open(hook_file, 'w') as f:
            f.write(hook_content)
        
        # Make the hook executable
        os.chmod(hook_file, 0o755)
        
        print("✅ Git pre-commit hook installed successfully!")
        print(f"📁 Hook location: {hook_file}")
        print("🔄 The sitemap will now be automatically updated when you commit HTML files.")
        
        return True
        
    except subprocess.CalledProcessError:
        print("❌ Error: Not in a Git repository!")
        return False
    except Exception as e:
        print(f"❌ Error installing hook: {e}")
        return False

def uninstall_git_hook():
    """Remove the pre-commit hook."""
    
    try:
        # Get the repository root
        repo_root = subprocess.run(['git', 'rev-parse', '--show-toplevel'], 
                                 capture_output=True, text=True, check=True).stdout.strip()
        
        # Path for the hook
        hook_file = Path(repo_root) / '.git' / 'hooks' / 'pre-commit'
        
        if hook_file.exists():
            hook_file.unlink()
            print("✅ Git pre-commit hook removed successfully!")
        else:
            print("ℹ️  No pre-commit hook found to remove.")
            
        return True
        
    except subprocess.CalledProcessError:
        print("❌ Error: Not in a Git repository!")
        return False
    except Exception as e:
        print(f"❌ Error removing hook: {e}")
        return False

def main():
    """Main function."""
    if len(sys.argv) > 1 and sys.argv[1] == '--uninstall':
        success = uninstall_git_hook()
    else:
        print("🔧 Setting up PrompterAid Git pre-commit hook...")
        print("=" * 50)
        success = install_git_hook()
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main() 