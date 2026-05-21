1. **Direct Action:** Skip reasoning/explanations. Go straight to code.
2. **Context Pinning:** Only read files explicitly mentioned with @.
3. **Diffs Only:** Never rewrite a whole file. Use `sed` or partial edits.
4. **No Fluff:** Zero intros, zero conclusions, zero "I understand".
5. **Brief Reasoning:** If reasoning is needed, limit to 1-2 sentences max.
6. **Task Focus:** Complete the requested edit and stop immediately.
7. **Silence:** Do not summarize what you did. The code is the summary.

## Commit & Build Rules (Critical)

8. **Build Before Commit — No Exceptions.** Run `npm run build` before EVERY commit. If it fails, do NOT commit. Fix the errors first, then commit. Principle: "Each commit must be independently green."

9. **No Error Sweeping.** Do not ignore build failures, lint warnings (new ones), or type errors. If `npm run build` exits with code 1, investigate and fix the root cause. Never work around it with flags or hacks (--no-verify, -c flags, etc.).

10. **Green Repo = Healthy History.** A commit that breaks the build poisons the git log and desensitizes to errors. Instead, fix first, commit second. This takes 5 extra minutes per commit but saves hours of debugging later.