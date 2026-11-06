# Fix List

Sorted with demo-breaking problems first.

1. server.js had a stray line of text before module.exports, so the server could not start. I deleted the line. FIXED
2. style.css and app.js had pieces mixed together (:root { and the JavaScript). I put each piece back in its own file. FIXED
3. register.html had a duplicate DOCTYPE and login.html had none. I fixed both. FIXED
4. The background image path was bg..jpg. I changed it to bg.jpg and checked the file is in public. FIXED
5. .logo-icon is in the CSS but not used in any HTML. Harmless, left as is. FIXED

Still to confirm before the final:
- Check 20: api-docs.md has a row for every route in server.js.
- Check 17: no part of my WeatherAPI key is in the code.