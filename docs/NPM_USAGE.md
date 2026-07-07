# Standard NPM Integration Guide

DevTools-Terminator is fully compatible with standard npm workflows and should be installed via `package.json` just like any other dependency (e.g., React, Axios, or Lodash).

## Understanding the Initialization Process

Unlike standard UI components that you simply import and render, a security and detection script requires a specific initialization pattern to function correctly. Specifically, it requires two things:

1. **Global Configuration:** The library must be configured globally *before* it executes.
2. **A Redirect Page:** It requires an actual HTML page to redirect the user to when DevTools are detected.

> **Note on the CLI Tool:**
> The repository includes an interactive CLI tool (`npx devtools-terminator init`) that automatically scaffolds these files for you. However, **this is entirely optional**. You do not need to use the CLI if you prefer to configure the package manually as shown below.

---

## Step-by-Step Implementation

Here is the cleanest, standard way to use DevTools-Terminator purely as an npm package in modern projects (React, Vue, Vite, Next.js, etc.).

### 1. Install the Package

Install the library normally. This will add it to your `package.json` dependencies.

```bash
npm install devtools-terminator
```

### 2. Create the "Terminated" Page

Because the library redirects users when it detects DevTools, you must provide a destination page. Create a standard HTML file in your project's public directory (e.g., `public/terminated.html` or `src/terminated.html`, depending on your framework's routing).

```html
<!-- Example: public/terminated.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Session Terminated</title>
</head>
<body>
    <h1>Access Denied</h1>
    <p>Your session has been terminated because developer tools were detected.</p>
</body>
</html>
```

### 3. Configure and Initialize

In your main JavaScript entry file (e.g., `main.js`, `index.js`, or `App.jsx`), you must set the configuration on the `window` object **before** importing the library.

```javascript
// src/main.js (or index.js / App.jsx)

// 1. Set the configuration FIRST
window.__DEVTOOLS_TERMINATOR_CONFIG__ = {
  terminationURL: '/terminated.html', // Point to the HTML file created in Step 2
  destructiveClear: false,            // Set to true to wipe localStorage/cookies upon detection
  blockKeyboard: true,                // Blocks F12, Ctrl+Shift+I, Cmd+Option+I, etc.
  disableOnMobile: true               // Highly recommended to prevent mobile false-positives
};

// 2. Import the library SECOND to activate the shield
import 'devtools-terminator';

// 3. Import the rest of your application
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

---

## Design Philosophy: Why Global Initialization?

You might wonder why this doesn't work like a standard component import (e.g., `import { DevTools } from 'devtools-terminator'`).

Most npm packages export functions or components that are called within your application's component tree. However, DevTools-Terminator is designed to act as a **global security shield**.

* **Immediate Execution:** It needs to attach event listeners to the `window` object and intercept browser events the millisecond the page begins loading.
* **Component Lifecycle Limitations:** If you imported it inside a specific React or Vue component, it wouldn't start protecting the page until that specific component mounted and rendered, leaving a vulnerability window.

By requiring you to configure `window.__DEVTOOLS_TERMINATOR_CONFIG__` and importing the script at the absolute top level of your application's entry point, the library ensures the security shield is active immediately upon page load.

---

## Quick Summary

1. Treat it as a standard npm package (`npm install devtools-terminator`).
2. Create a simple HTML page for the redirect destination.
3. Define `window.__DEVTOOLS_TERMINATOR_CONFIG__` at the very top of your main JS entry file.
4. `import 'devtools-terminator'` immediately after the configuration.
