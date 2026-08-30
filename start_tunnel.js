import { startTunnel } from 'untun';

async function main() {
  try {
    const tunnel = await startTunnel({
      port: 3000,
      acceptCloudflareNotice: true
    });
    const url = await tunnel.getURL();
    console.log('TUNNEL_PUBLIC_URL=' + url);
  } catch (err) {
    console.error('Tunnel error:', err);
  }
}

main();
