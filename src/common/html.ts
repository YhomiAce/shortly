/** Escapes text for safe inclusion in HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Renders a minimal standalone HTML page used by the public redirect routes. */
export function renderPage(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · shortly</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f6f8;color:#1f2933;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
  main{background:#fff;padding:2rem 2.5rem;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:380px;width:100%}
  h1{font-size:1.3rem;margin:0 0 .75rem}
  p{color:#52606d;line-height:1.5}
  input{width:100%;box-sizing:border-box;padding:.6rem .7rem;border:1px solid #cbd2d9;border-radius:8px;font-size:1rem;margin:.5rem 0 1rem}
  button{width:100%;padding:.65rem;border:0;border-radius:8px;background:#3b5bdb;color:#fff;font-size:1rem;cursor:pointer}
  .error{color:#c92a2a}
</style>
</head>
<body><main>${bodyHtml}</main></body>
</html>`;
}
