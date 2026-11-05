const token = process.argv[2];
if (!token) {
  console.log('Usage: node decode.js PASTE_YOUR_TOKEN_HERE');
  process.exit(1);
}
const middle = token.split('.')[1];
console.log(JSON.parse(Buffer.from(middle, 'base64url').toString()));