import { writeFile } from 'node:fs/promises';
import 'dotenv/config';

import { createApplication, createOpenApiDocument } from '../src/bootstrap.js';

const app = await createApplication();
await app.init();
const document = createOpenApiDocument(app);
await writeFile('openapi.json', `${JSON.stringify(document, null, 2)}\n`, 'utf8');
await app.close();
