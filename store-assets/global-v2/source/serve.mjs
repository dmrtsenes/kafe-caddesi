import { createServer } from 'vite';
import { resolve } from 'node:path';
const server=await createServer({configFile:false,cacheDir:resolve('store-assets/.cache'),optimizeDeps:{noDiscovery:true},server:{host:'127.0.0.1',port:5187,strictPort:true,open:false,hmr:false,watch:null}});
await server.listen();
console.log('Game: http://127.0.0.1:5187/ | Gallery: http://127.0.0.1:5187/store-assets/');
