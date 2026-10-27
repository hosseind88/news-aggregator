import { proxy } from '../_lib/proxy';

export default {
  fetch: (request: Request) => proxy('guardian', request),
};
