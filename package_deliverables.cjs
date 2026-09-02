const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('      EMPAQUETADOR DE ENTREGABLES MARKET ALMACEN    ');
console.log('====================================================');

const projectDir = __dirname;
const distDir = path.join(projectDir, 'dist');

// 1. Verificar o compilar la web
if (!fs.existsSync(distDir)) {
  console.log('Compilando aplicacion web...');
  try {
    execSync('npm.cmd run build', { stdio: 'inherit', cwd: projectDir });
  } catch (_) {
    execSync('npm run build', { stdio: 'inherit', cwd: projectDir });
  }
}

// 2. Generar archivo zip para Netlify
const zipOut = path.join(projectDir, 'Market-Almacen-Web-Deploy.zip');
try {
  if (fs.existsSync(zipOut)) fs.unlinkSync(zipOut);
  console.log('Generando Market-Almacen-Web-Deploy.zip para Netlify Drop...');
  execSync(`powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipOut}' -Force"`, {
    stdio: 'inherit',
    cwd: projectDir
  });
  const zipSize = (fs.statSync(zipOut).size / 1024).toFixed(2);
  console.log(`[OK] Paquete Netlify creado con exito: Market-Almacen-Web-Deploy.zip (${zipSize} KB)`);
} catch (e) {
  console.error('Error al empaquetar web para Netlify:', e.message);
}

// 3. Copiar el archivo APK mas reciente a la raiz del proyecto
const apkDebugPath = path.join(projectDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const rootApkPath = path.join(projectDir, 'Market-Almacen.apk');

if (fs.existsSync(apkDebugPath)) {
  try {
    fs.copyFileSync(apkDebugPath, rootApkPath);
    const apkStat = fs.statSync(rootApkPath);
    const apkSizeMB = (apkStat.size / (1024 * 1024)).toFixed(2);
    console.log(`[OK] Archivo APK actualizado con exito: Market-Almacen.apk (${apkSizeMB} MB)`);
    console.log(`   Fecha de modificacion: ${apkStat.mtime.toLocaleString()}`);
  } catch (err) {
    console.error('Error al copiar APK a la raiz:', err.message);
  }
} else {
  console.log('El archivo debug APK no se encontro en android/app/build/outputs/apk/debug/app-debug.apk');
}

console.log('====================================================');
