import './load-env';
import { startPooler } from './start-pooler';

startPooler().catch((error) => {
  console.error('Pooler failed to start:', error);
  process.exit(1);
});
