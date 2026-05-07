const https = require('https');
const fs = require('fs');

https.get('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf', (res) => {
  if (res.statusCode === 302 || res.statusCode === 301) {
      https.get(res.headers.location, (res2) => {
          const chunks = [];
          res2.on('data', (c) => chunks.push(c));
          res2.on('end', () => {
              const b64 = Buffer.concat(chunks).toString('base64');
              fs.writeFileSync('roboto-b64.js', 'export const robotoBase64 = "' + b64 + '";');
              console.log('Done, length:', b64.length);
          });
      });
  } else {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
          const b64 = Buffer.concat(chunks).toString('base64');
          fs.writeFileSync('roboto-b64.js', 'export const robotoBase64 = "' + b64 + '";');
          console.log('Done, length:', b64.length);
      });
  }
});
