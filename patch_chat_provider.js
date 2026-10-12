const fs = require('fs');

let content = fs.readFileSync('providers/ChatProvider.tsx', 'utf8');

const oldStr = `        // Skip proxy if it's already a relative URL or not toolkit
        if (url.includes('toolkit.rork.com') || url.includes('/agent/chat')) {
          const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
          return fetch(proxyUrl, init);
        }`;

const newStr = `        // Skip proxy if it's already a relative URL or not toolkit
        if (url.includes('toolkit.rork.com') || url.includes('/agent/chat')) {
          try {
            const bodyObj = init && init.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
            bodyObj.endpoint = url;
            return fetch('/api/chat', { ...init, body: JSON.stringify(bodyObj) });
          } catch (e) {
            return fetch('/api/chat', init);
          }
        }`;

content = content.replace(oldStr, newStr);

fs.writeFileSync('providers/ChatProvider.tsx', content);
