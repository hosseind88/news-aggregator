import { proxy } from '../_lib/proxy.js';

export default {
  fetch: (request: Request) => proxy('nyt', request),
};
