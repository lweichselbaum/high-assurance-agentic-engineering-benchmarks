// Harness entry — the only script index.html loads. Not app code.
// 1. Install the Trusted Types boundary before anything else can touch the DOM.
// 2. Start the app.
import './trusted-boundary';
import '../src/main';
