const fs = require('fs');
const path = require('path');

const p = 'C:/Users/User/.gemini/antigravity-ide/brain/de41932f-e4ba-47a9-adb9-0107e8ea78fe/.user_uploaded/media_1787550397060.png';
const base64 = fs.readFileSync(p).toString('base64');
const tsContent = `// Mauricio Chamorro Official Signature Base64
export const MAURICIO_CHAMORRO_SIGNATURE_BASE64 = 'data:image/png;base64,${base64}';
`;

fs.writeFileSync('C:/Users/User/.gemini/antigravity-ide/scratch/bodega-control/src/utils/signatureAsset.ts', tsContent);
console.log('signatureAsset.ts written successfully! Size:', fs.statSync('C:/Users/User/.gemini/antigravity-ide/scratch/bodega-control/src/utils/signatureAsset.ts').size, 'bytes');
