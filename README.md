# Topology Simulator

## Technology Stack

[Vue 3](https://vuejs.org/) · [Vite](https://vitejs.dev/) · [TypeScript](https://www.typescriptlang.org/) · [Tailwind CSS v4](https://tailwindcss.com/) · [PrimeVue](https://primevue.org/)

## Project Structure

```
src/
├── views/          # Page components
├── components/     # Reusable UI components
├── composables/    # Reactive logic
├── core/           # Simulation logic
├── stores/         # App state
└── router/         # Vue Router routes
```

## Development Setup

Node.js 20.19+ or 22.12+ is required.

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run typecheck # TypeScript validation
npm run lint:fix  # auto-fix linting issues
npm run build     # production build → dist/
npm run test      # unit tests
```

## Deployment

Pushing to `main` triggers the GitHub Actions CI pipeline, which lints, type-checks, builds, and deploys the app to GitHub Pages.
