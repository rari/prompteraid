const fs = require('fs');
const path = require('path');

// API endpoint to serve image paths
module.exports = (req, res) => {
  const srefDir = path.join(process.cwd(), 'img', 'sref');
  const imagePaths = [];
  
  try {
    // Get all directories in the sref folder
    const dirs = fs.readdirSync(srefDir).filter(file => 
      fs.statSync(path.join(srefDir, file)).isDirectory()
    );
    
    // For each directory, get all webp files
    dirs.forEach(dir => {
      const dirPath = path.join(srefDir, dir);
      const files = fs.readdirSync(dirPath).filter(file => 
        file.endsWith('.webp')
      );
      
      // Add each file path to the array
      files.forEach(file => {
        // Use forward slashes for web paths
        imagePaths.push(`img/sref/${dir}/${file}`);
      });
    });
    
    // Send the array as JSON
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(imagePaths));
  } catch (error) {
    console.error('Error scanning image directories:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Failed to scan image directories' }));
  }
}; 