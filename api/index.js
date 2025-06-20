// This file serves as an API endpoint for Vercel
module.exports = (req, res) => {
  // Redirect to the main page
  res.writeHead(302, { Location: '/' });
  res.end();
}; 