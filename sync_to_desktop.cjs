const fs = require('fs');
const path = require('path');

const srcDir = 'C:/Users/User/.gemini/antigravity-ide/scratch/bodega-control';
const destDir = 'C:/Users/User/Desktop/Bodega control';

const excludedDirs = new Set(['node_modules', '.git', '.gradle', 'build', '.system_generated', '.gemini']);

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    const base = path.basename(src);
    if (excludedDirs.has(base)) return;

    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('Sincronizando archivos hacia Escritorio/Bodega control...');
copyRecursiveSync(srcDir, destDir);
console.log('¡Sincronización completada con éxito!');
