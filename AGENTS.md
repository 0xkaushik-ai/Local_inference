# Repository Guidelines

## Project Structure & Module Organization

This workspace currently contains no application source, tests, assets, or package manifests. The existing `.agents/`, `.codex/`, `.aws/`, and `.git/` directories are environment metadata; do not use them for application code.

When introducing the first implementation, organize source under `src/`, tests under `tests/`, and static resources under `assets/` where appropriate. Group related modules by feature. Add a `README.md` explaining the project's purpose and actual directory layout.

## Build, Test, and Development Commands

No build system, development server, or test commands are configured. Do not assume commands such as `npm test` or `make build` work here.

When choosing a toolchain, commit its manifest and dependency lockfile, and document exact installation, local development, build, lint, and test commands in `README.md`. Prefer reproducible project scripts over undocumented global tools.

## Coding Style & Naming Conventions

No language, formatter, or linter has been established. Use the chosen language's standard conventions and configure formatting and linting with the first implementation. Keep indentation consistent within each file, use descriptive names, and avoid unrelated formatting changes. Use lowercase, hyphenated names for documentation files, except conventional names such as `README.md` and `AGENTS.md`.

## Testing Guidelines

No testing framework or coverage threshold is defined. Add a framework appropriate to the selected stack. Name tests after the behavior they verify and follow the framework's discovery conventions. Cover new behavior, failure paths, and bug regressions; document how to run the suite.

## Commit & Pull Request Guidelines

Git history is unavailable in this workspace, so existing commit conventions cannot be verified. Use concise, imperative subjects, such as `Add initial project setup`. Keep commits focused.

Pull requests should explain the change, link relevant issues, and report validation performed or why it was unavailable. Include screenshots for visual changes and describe configuration changes.

## Security & Configuration

Never commit credentials, tokens, or local environment files. Provide placeholder configuration examples and ignore generated output and dependencies when adding tooling.
