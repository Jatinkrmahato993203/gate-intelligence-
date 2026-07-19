const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');

const styleStart = lines.findIndex(l => l.includes('<style>'));
const styleEnd = lines.findIndex(l => l.includes('</style>'));

const scriptStart = lines.findIndex(l => l.includes('<script>'));
const scriptEnd = lines.findIndex(l => l.includes('</script>'));

const cssLines = lines.slice(styleStart + 1, styleEnd);
const jsLines = lines.slice(scriptStart + 1, scriptEnd);

fs.writeFileSync('public/css/main.css', cssLines.join('\n'));
fs.writeFileSync('public/js/main.js', jsLines.join('\n'));

const newHtmlLines = [
  ...lines.slice(0, styleStart),
  '  <link rel="stylesheet" href="/css/main.css">',
  ...lines.slice(styleEnd + 1, scriptStart),
  '  <script type="module" src="/js/main.js"></script>',
  ...lines.slice(scriptEnd + 1)
];

fs.writeFileSync('index.html', newHtmlLines.join('\n'));

console.log('Successfully extracted CSS and JS!');
