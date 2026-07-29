import { build } from 'vite';

const result = await build({ configFile: './vite.config.js' });
console.log('Build complete');
