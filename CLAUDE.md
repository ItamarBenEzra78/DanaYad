# Claude Code — Project Standards

## Language

Respond in the same language the user writes in. If the user writes in Hebrew, respond in Hebrew. If in English, respond in English.

---

## Architecture Principles

### SOLID
- **Single Responsibility** — One file = one concern. Never mix unrelated logic.
- **Open/Closed** — Extend through new modules, don't modify working ones.
- **Liskov Substitution** — Subclasses/implementations must be interchangeable.
- **Interface Segregation** — Keep interfaces small and focused.
- **Dependency Inversion** — Depend on abstractions (imports), not concrete globals.

### Clean Architecture Layers
1. **Config** — Constants, environment variables, settings (`config.js`, `.env`)
2. **Utils** — Pure helper functions with zero side effects (`utils/`)
3. **Domain** — Core business logic, independent of framework (`models/`, `services/`)
4. **Infrastructure** — External APIs, database, auth (`auth/`, `api/`)
5. **Presentation** — UI components, DOM manipulation, event handlers (`components/`, `views/`)

### Separation Rules
- Never put CSS or JS inline in HTML files.
- Each new feature = new module in the appropriate directory.
- All cross-module wiring goes through a single entry point (e.g., `app.js`, `main.js`).
- Use ES6 `import`/`export` exclusively. Never create implicit global functions.
- Keep HTML files as slim shells: structure only, no logic.

---

## Code Quality Standards

### General
- Write code that is self-explanatory. Add comments only where the "why" is not obvious.
- Prefer explicit over implicit. Name variables and functions descriptively.
- Keep functions under 30 lines. If longer, extract sub-functions.
- Maximum file size: 300 lines. If larger, split into logical modules.
- No dead code, commented-out code, or unused imports.
- No `console.log` in production code (use proper error handling).

### JavaScript / TypeScript
- Use `const` by default. Use `let` only when reassignment is needed. Never `var`.
- Use strict equality (`===`) always.
- Use template literals over string concatenation.
- Prefer `async/await` over `.then()` chains.
- Destructure objects and arrays when accessing multiple properties.
- Handle all error paths — never swallow errors silently.

### CSS
- Use CSS custom properties (variables) for colors, spacing, and typography.
- Follow a modular file structure: one file per concern (layout, components, theme).
- Use relative units (`rem`, `em`, `%`) over fixed pixels where appropriate.
- Mobile-first: write base styles for small screens, add breakpoints for larger.
- Never use `!important` unless overriding third-party CSS.

### HTML
- Use semantic elements (`header`, `main`, `nav`, `section`, `article`, `button`).
- All interactive elements must be keyboard-accessible.
- Images need `alt` attributes. Forms need `label` elements.
- Validate HTML structure (no orphaned tags, proper nesting).

---

## File & Directory Naming

- **Files**: `kebab-case.js`, `PascalCase.js` for classes/components
- **Directories**: `kebab-case/`
- **CSS files**: `kebab-case.css`
- **Constants**: `UPPER_SNAKE_CASE`
- **Functions/variables**: `camelCase`
- **Classes**: `PascalCase`

---

## Git & Version Control

### Commits
- Write clear, concise commit messages in English.
- Format: `<type>: <short description>`
- Types: `feat`, `fix`, `refactor`, `style`, `docs`, `test`, `chore`, `perf`
- Commit message describes **why**, not **what** (the diff shows what).

### Branching
- `main` — production-ready code only
- `feature/<name>` — new features
- `fix/<name>` — bug fixes
- `refactor/<name>` — code improvements without behavior changes

### Pull Requests
- Every PR must pass CI (lint + tests) before merge.
- PR title under 70 characters.
- PR description includes: Summary, What changed, How to test.

---

## Performance

- Lazy-load resources that are not needed on initial render.
- Minimize DOM manipulations — batch reads and writes.
- Use `requestAnimationFrame` for visual updates.
- Debounce/throttle expensive event handlers (scroll, resize, input).
- Optimize images: use appropriate formats (WebP/AVIF), compress, set dimensions.
- Keep the critical rendering path lean: minimal blocking CSS/JS in `<head>`.

---

## Security

- Never commit secrets, API keys, or credentials to the repository.
- Use environment variables for sensitive configuration.
- Sanitize all user input before rendering (prevent XSS).
- Use `Content-Security-Policy` headers where possible.
- Validate data at system boundaries (user input, API responses).
- Keep dependencies updated (Dependabot is enabled on this repo).

---

## Testing Strategy

- **Unit tests** for pure logic functions (calculations, transformations, validators).
- **Integration tests** for module interactions (API calls, auth flows).
- **E2E tests** for critical user paths (login, main workflow, export).
- Write tests before fixing a bug (regression prevention).
- Tests must be deterministic — no flaky tests, no timing dependencies.

---

## Workflow with Claude Code

### Before making changes
1. Read the existing code first. Understand before modifying.
2. Check if there's an existing module that handles the concern.
3. If adding a feature, identify which architectural layer it belongs to.

### While making changes
4. Make the smallest change that solves the problem.
5. Don't "improve" surrounding code unless asked.
6. Don't add error handling for impossible scenarios.
7. Don't create abstractions for one-time operations.
8. Run lint after changes: `npx eslint . --fix`

### After making changes
9. Always commit and push (user preference).
10. Verify the change doesn't break existing functionality.
11. If a change touches multiple modules, explain the dependency chain.

---

## Tool Configuration

This project uses the following automated tools:

| Tool | Purpose | Config File |
|------|---------|-------------|
| ESLint | JavaScript code quality | `.eslintrc.json` |
| Prettier | Code formatting | `.prettierrc` |
| GitHub Actions | CI/CD pipeline | `.github/workflows/` |
| Dependabot | Dependency updates | `.github/dependabot.yml` |
| Lighthouse CI | Performance/accessibility audits | `.github/workflows/lighthouse.yml` |
