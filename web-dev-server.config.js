import rollupCommonjs from '@rollup/plugin-commonjs';
import { fromRollup } from '@web/dev-server-rollup';

const commonjs = fromRollup(rollupCommonjs);

export default {
  host: '0.0.0.0',
  port: 8000,
  appIndex: 'demo/index.html',
  watch: true,
  open: false,
  nodeResolve: true,
  plugins: [commonjs()]
};