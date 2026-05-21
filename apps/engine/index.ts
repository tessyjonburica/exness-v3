import './load-env';
import { startEngine } from './src/start-engine';

startEngine().catch((error) => {
  console.error('Engine failed to start:', error);
  process.exit(1);
});
