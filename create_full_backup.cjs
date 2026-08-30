const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = 'C:/Users/User/.gemini/antigravity-ide/scratch/bodega-control';
const desktopDir = 'C:/Users/User/Desktop/Bodega control';
const zipPath = path.join(desktopDir, 'RESPALDO_COMPLETO_BODEGA_CONTROL.zip');

fs.copyFileSync(path.join(srcDir, 'EJECUTAR_BODEGA_CONTROL.bat'), path.join(desktopDir, 'EJECUTAR_BODEGA_CONTROL.bat'));
fs.copyFileSync(path.join(srcDir, 'LEEME_INSTRUCCIONES_PENDRIVE.txt'), path.join(desktopDir, 'LEEME_INSTRUCCIONES_PENDRIVE.txt'));

console.log('Generando archivo ZIP de respaldo completo...');
const tempZipDir = 'C:/Users/User/.gemini/antigravity-ide/scratch/temp_backup_bodega';
if (fs.existsSync(tempZipDir)) fs.rmSync(tempZipDir, { recursive: true, force: true });
fs.mkdirSync(tempZipDir, { recursive: true });

const excluded = new Set(['node_modules', '.git', '.gradle', 'build', '.system_generated', '.gemini', 'temp_backup_bodega']);

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach(item => {
    if (excluded.has(item)) return;
    const sPath = path.join(src, item);
    const dPath = path.join(dest, item);
    if (fs.statSync(sPath).isDirectory()) {
      copyDir(sPath, dPath);
    } else {
      fs.copyFileSync(sPath, dPath);
    }
  });
}

copyDir(srcDir, tempZipDir);

try {
  execSync(`powershell -ExecutionPolicy Bypass -Command "Compress-Archive -Path '${tempZipDir}/*' -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit' });
  console.log('¡ZIP Respaldo Completo creado exitosamente! Tamaño:', (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2), 'MB');
} catch (err) {
  console.error('Error al comprimir:', err.message);
} finally {
  if (fs.existsSync(tempZipDir)) {
    fs.rmSync(tempZipDir, { recursive: true, force: true });
  }
}
