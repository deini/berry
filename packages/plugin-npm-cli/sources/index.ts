import {Plugin}   from '@berry/core';

import npmPublish from './commands/npm/publish';
import whoami     from './commands/npm/whoami';

const plugin: Plugin = {
  commands: [
    npmPublish,
    whoami,
  ],
};

// eslint-disable-next-line arca/no-default-export
export default plugin;
