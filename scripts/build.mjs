import { cp, mkdir, rm } from 'node:fs/promises';

const publishDirectory = new URL('../public/', import.meta.url);

await rm(publishDirectory, { recursive: true, force: true });
await mkdir(publishDirectory, { recursive: true });
await cp(new URL('../static/', import.meta.url), new URL('static/', publishDirectory), {
  recursive: true
});

console.log('Static assets prepared in public/static. Application routes are served by Netlify Functions.');
