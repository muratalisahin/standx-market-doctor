# StandX Market Doctor

This version does NOT use `@vitejs/plugin-react`, so the Vite config cannot fail because that package is missing.

## Windows

Open CMD inside this folder and run:

```bat
rmdir /s /q node_modules
del package-lock.json
npm install
npm run dev
```

If either delete command says the file/folder does not exist, that is fine.

Then open the `Local:` URL Vite prints.

The app uses a local Vite proxy for StandX API requests during development and the included Vercel API functions in production.
