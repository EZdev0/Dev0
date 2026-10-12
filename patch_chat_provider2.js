const fs = require('fs');

let content = fs.readFileSync('providers/ChatProvider.tsx', 'utf8');

const regex = /if \(url\.includes\('toolkit\.rork\.com'\) \|\| url\.includes\('\/agent\/chat'\)\) \{\s*const proxyUrl = 'https:\/\/corsproxy\.io\/\?' \+ encodeURIComponent\(url\);\s*return fetch\(proxyUrl, init\);\s*\}/g;

const newStr = `if (url.includes('toolkit.rork.com') || url.includes('/agent/chat')) {
          try {
            const bodyObj = init && init.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
            bodyObj.endpoint = url;
            return fetch('/api/chat', { ...init, body: JSON.stringify(bodyObj) });
          } catch (e) {
            return fetch('/api/chat', init);
          }
        }`;

content = content.replace(regex, newStr);

fs.writeFileSync('providers/ChatProvider.tsx', content);
