import { translateApiMock } from './demo/translate-api-mock.js';

export default {
  host: '0.0.0.0',
  port: 8000,
  appIndex: 'demo/index.html',
  watch: true,
  open: true,
  nodeResolve: true,
  // Serves `/translate` per wiki/translation/translate-api.openapi.yml, so the demo can exercise the
  // URL forms of `translation.setTranslator` over real HTTP. Demo-only; not part of the library.
  middleware: [translateApiMock()]
};
