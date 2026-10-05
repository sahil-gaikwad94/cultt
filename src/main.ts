import './styles/tokens.css';
import './styles/app.css';
import { createRepo } from './data';
import { installRepoBridge } from './components/phase1';

const repo = createRepo();
installRepoBridge(repo);
void import('./legacy');
