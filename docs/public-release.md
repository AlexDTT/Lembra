# Publishing the repository

The source is MIT licensed. Open-source code does not make a deployment's accounts or data public; each deployment keeps its own invite-only access controls.

Before changing repository visibility:

- Review existing GitHub Actions logs and artifacts, releases, issues and attachments for private data. Delete any unwanted production backup artifacts. The backup workflow now runs only in a private repository with the `ENABLE_DATABASE_BACKUPS` variable set to `true`; this does not remove older artifacts.
- Move production backup configuration to a private repository. Copy the backup workflow there, enable the variable, configure its two secrets, and verify a backup and restore before retiring the old schedule.
- Enable private vulnerability reporting in GitHub Settings and use the process in `SECURITY.md`.
- Decide whether to publish existing commit author emails and historical deployment notes. Editing current files does not remove earlier versions from Git history.

If historical information should stay private, publish a new public repository from a clean copy of tracked source files without the existing `.git` directory. Keep the original repository private for history and production operations. Copy only tracked source files; exclude local `.env` files, backups, build outputs and credentials. Review the new repository before pushing. Rewriting and force-pushing existing history is another option, but requires coordinating with collaborators and separately cleaning any existing remote artifacts or references.

For future commits, set your Git author email to your GitHub-provided noreply address. This does not change prior commits.
