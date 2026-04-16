import { createApp } from './infrastructure/bootstrap/createApp';

const app = createApp();

await app.start();
