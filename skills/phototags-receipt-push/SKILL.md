---
name: phototags-receipt-push
description: Validate, commit, and push completed PhotoTags Receipt Booth code updates to its GitHub repository under the user's standing instruction. Apply after code changes in this project or explicit requests to save its work.
---

# PhotoTags Receipt Booth updates

The user requests a Git push after every completed code update. Carry this out without asking again, unless a later instruction says to keep changes local or stop.

The intended remote is https://github.com/jmtags/phototags_receiptbooh_allplatform.git. The local project is normally C:/codes/PhotoTagsReceipt_Booth_ALL. Verify the current repository, remote, branch, and upstream before publishing; do not push this app into the separate PhotoTags marketing website repository.

Run `npm run build` and the checks appropriate to the change. Review the diff and stage only the completed task's source, bundled assets, tests, and documentation. Exclude credentials, environment files, dependencies, generated builds, browser histories, captured photos, logs, and temporary test artifacts. Preserve unrelated work.

Commit with a description of the delivered change, then push the current branch to its intended upstream. Verify the push succeeded and report the branch and commit. Do not create an empty commit when already synchronized. If validation fails, fix the relevant failure before publishing. If authentication, branch protection, or divergent history blocks the push, preserve the local commit and report the blocker; do not force-push, rewrite history, or retry indefinitely.

This preference authorizes ordinary Git commits and pushes. It does not independently authorize Vercel deployments, domain changes, database mutations, or changes to other repositories. State separately whether a deployment was actually verified.
