// Small HTTPS/HTTP GET helper used by the movie importers.
// Uses IPv4 and a 30 second limit, and follows redirects. Node's built-in fetch gives up after 10 seconds
// and can stall on networks where IPv6 is broken, even though the same site opens fine in a browser.
const https = require('https');
const http = require('http');

function getJson(input, headers = {}, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const url = new URL(input);
    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.get(url, { headers, family: 4, timeout: 30000 }, (res) => {
      const redirect = [301, 302, 307, 308].includes(res.statusCode) && res.headers.location;
      if (redirect && redirectsLeft > 0) {
        res.resume();
        resolve(getJson(new URL(res.headers.location, url).toString(), headers, redirectsLeft - 1));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timed out after 30 seconds'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
  });
}

module.exports = { getJson };
