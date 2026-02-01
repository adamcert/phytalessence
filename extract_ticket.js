const http = require('http');
const fs = require('fs');

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  // Login
  const loginData = JSON.stringify({email:'admin@phytalessence.com',password:'admin123'});
  const loginRes = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Content-Length': loginData.length}
  }, loginData);

  const token = loginRes.token || loginRes.data?.token;

  // Get transaction 16
  const txRes = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/transactions/16',
    method: 'GET',
    headers: {'Authorization': 'Bearer ' + token}
  });

  const tx = txRes.data || txRes;

  // Save image
  if (tx.ticketImageBase64) {
    fs.writeFileSync('D:/wamp64/www/phytalessence/ticket_16.jpg', Buffer.from(tx.ticketImageBase64, 'base64'));
    console.log('Image saved to ticket_16.jpg');
  }

  console.log('\n=== SNAPSS EXTRACTED PRODUCTS ===');
  console.log(JSON.stringify(tx.ticketProducts, null, 2));

  console.log('\n=== MATCHED PRODUCTS ===');
  console.log(JSON.stringify(tx.matchedProducts, null, 2));
}

main().catch(console.error);
