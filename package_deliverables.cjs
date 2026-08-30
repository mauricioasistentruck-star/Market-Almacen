const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Empaquetando entregables de Market Almacén...');

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  console.log('Carpeta dist no encontrada. Ejecutando npm run build...');
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
}

const zipOut = path.join(__dirname, 'Market-Almacen-Web-Deploy.zip');
try {
  if (fs.existsSync(zipOut)) fs.unlinkSync(zipOut);
  // Empaquetar dist con powershell Compress-Archive
  execSync(`powershell -Command "Compress-Archive -Path 'dist\\*' -DestinationPath 'Market-Almacen-Web-Deploy.zip' -Force"`, {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('✅ Paquete web generado exitosamente: Market-Almacen-Web-Deploy.zip');
} catch (e) {
  console.error('Error al empaquetar web:', e.message);
}
