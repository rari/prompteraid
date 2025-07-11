# Push Permission Rule

## CRITICAL: Never Push Without Explicit Permission

**Rule**: The AI assistant must NEVER push to remote repositories without explicit user permission.

### Requirements:
1. **Always ask first**: Before any `git push` command, ask "Would you like me to commit and push these changes?"
2. **Explicit permission only**: Only push when user explicitly requests it with phrases like:
   - "commit and push"
   - "push the changes"
   - "yes, push it"
   - "go ahead and push"
3. **No automatic pushing**: If user only says "commit" or similar, do NOT push automatically
4. **Confirm intent**: If user's intent is unclear, ask for clarification

### Examples:
- ✅ User: "commit and push" → AI can push
- ✅ User: "yes, push it" → AI can push  
- ❌ User: "commit" → AI should NOT push
- ❌ User: "save changes" → AI should NOT push
- ❌ User: "done" → AI should NOT push

### Implementation:
- Always use `run_terminal_cmd` with `require_user_approval: true` for push commands
- Ask permission before attempting any push operation
- Provide clear feedback about what will be pushed

This rule ensures the user maintains full control over when changes are pushed to remote repositories. 