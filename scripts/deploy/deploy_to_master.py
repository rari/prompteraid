#!/usr/bin/env python3
"""
Deploy to Master Script for PrompterAid
Merges changes from explore branch to master and pushes for deployment.
"""

import os
import sys
import subprocess
from pathlib import Path

def run_command(cmd, check=True, capture_output=False):
    """Run a git command and return the result."""
    try:
        if capture_output:
            result = subprocess.run(cmd, capture_output=True, text=True, check=check)
            return result
        else:
            result = subprocess.run(cmd, check=check)
            return result
    except subprocess.CalledProcessError as e:
        print(f"❌ Command failed: {' '.join(cmd)}")
        print(f"Error: {e}")
        return None

def get_current_branch():
    """Get the current branch name."""
    result = run_command(['git', 'branch', '--show-current'], capture_output=True)
    if result:
        return result.stdout.strip()
    return None

def check_working_directory_clean():
    """Check if the working directory is clean."""
    result = run_command(['git', 'status', '--porcelain'], capture_output=True)
    if result and result.stdout.strip():
        print("⚠️  Working directory has uncommitted changes:")
        print(result.stdout)
        return False
    return True

def deploy_to_master():
    """Deploy changes from explore branch to master."""
    print("🚀 Deploying PrompterAid to master branch...")
    print("=" * 50)
    
    # Check current branch
    current_branch = get_current_branch()
    print(f"📍 Current branch: {current_branch}")
    
    if current_branch != 'explore':
        print("⚠️  You should be on the explore branch to deploy.")
        print("💡 Run: git checkout explore")
        return False
    
    # Check if working directory is clean
    if not check_working_directory_clean():
        print("❌ Please commit or stash your changes before deploying.")
        return False
    
    # Fetch latest changes
    print("\n📥 Fetching latest changes...")
    if not run_command(['git', 'fetch', 'origin']):
        return False
    
    # Check if explore branch is up to date
    print("🔍 Checking if explore branch is up to date...")
    result = run_command(['git', 'status'], capture_output=True)
    if result and 'Your branch is behind' in result.stdout:
        print("⚠️  Your explore branch is behind origin. Please pull first.")
        return False
    
    # Switch to master branch
    print("\n🔄 Switching to master branch...")
    if not run_command(['git', 'checkout', 'master']):
        return False
    
    # Pull latest master
    print("📥 Pulling latest master...")
    if not run_command(['git', 'pull', 'origin', 'master']):
        return False
    
    # Merge explore branch
    print("\n🔀 Merging explore branch into master...")
    if not run_command(['git', 'merge', 'explore']):
        print("❌ Merge failed. You may need to resolve conflicts manually.")
        print("💡 After resolving conflicts, run: git add . && git commit")
        return False
    
    # Update sitemap
    print("\n📝 Updating sitemap...")
    if not run_command(['python', 'scripts/deploy/update_sitemap.py']):
        print("⚠️  Sitemap update failed, but continuing with deployment...")
    
    # Update schema
    print("🔧 Updating schema...")
    if not run_command(['python', 'scripts/deploy/update_schema.py']):
        print("⚠️  Schema update failed, but continuing with deployment...")
    
    # Stage any updated files
    print("📦 Staging updated files...")
    run_command(['git', 'add', '.'])
    
    # Commit if there are changes
    result = run_command(['git', 'status', '--porcelain'], capture_output=True)
    if result and result.stdout.strip():
        print("💾 Committing updates...")
        if not run_command(['git', 'commit', '-m', 'Deploy: Update sitemap and schema']):
            return False
    
    # Push to master
    print("\n🚀 Pushing to master branch...")
    if not run_command(['git', 'push', 'origin', 'master']):
        return False
    
    # Switch back to explore branch
    print("\n🔄 Switching back to explore branch...")
    if not run_command(['git', 'checkout', 'explore']):
        return False
    
    print("\n✅ Deployment completed successfully!")
    print("🌐 Your changes should be live in 2-5 minutes.")
    print("💡 You can continue working on the explore branch.")
    
    return True

def main():
    """Main function."""
    if len(sys.argv) > 1 and sys.argv[1] == '--help':
        print("🚀 PrompterAid Deploy to Master Script")
        print("=" * 40)
        print("Usage: python scripts/sitemap/deploy_to_master.py")
        print("\nThis script will:")
        print("1. Check you're on explore branch")
        print("2. Ensure working directory is clean")
        print("3. Switch to master branch")
        print("4. Merge explore branch into master")
        print("5. Update sitemap and schema")
        print("6. Push to master for deployment")
        print("7. Switch back to explore branch")
        print("\nMake sure you're on the explore branch before running!")
        return
    
    success = deploy_to_master()
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main() 