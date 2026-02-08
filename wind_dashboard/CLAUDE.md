# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wind Dashboard is a Next.js application for visualizing wind energy data. The project uses:
- Next.js 16.1.6 with App Router
- React 19.2.3
- TypeScript (strict mode enabled)
- Tailwind CSS 4.x with PostCSS
- ESLint with Next.js configuration

## Development Commands

```bash
# Start development server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Project Structure

This project follows the Next.js App Router architecture:

- **`app/`** - Application routes and layouts
  - `layout.tsx` - Root layout with font configuration (Geist Sans & Geist Mono)
  - `page.tsx` - Homepage component
  - `globals.css` - Global styles with Tailwind CSS and CSS variables for theming
- **`public/`** - Static assets (images, icons, etc.)
- **`next.config.ts`** - Next.js configuration
- **`tsconfig.json`** - TypeScript configuration with path aliases (`@/*` maps to root)

## Styling System

The project uses Tailwind CSS 4.x with a custom theming system:

- CSS variables defined in `app/globals.css` for colors (`--background`, `--foreground`)
- Theme tokens configured using Tailwind's `@theme inline` directive
- Automatic dark mode support via `prefers-color-scheme`
- Font variables from next/font/google integration

## TypeScript Configuration

- Strict mode enabled
- Path alias: `@/*` resolves to project root
- Target: ES2017
- JSX: react-jsx (automatic React import)
- Module resolution: bundler

## ESLint Configuration

ESLint uses the modern flat config format (`eslint.config.mjs`):
- `eslint-config-next/core-web-vitals` for Next.js best practices
- `eslint-config-next/typescript` for TypeScript support
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`
