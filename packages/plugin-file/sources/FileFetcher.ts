import querystring = require('querystring');

import {Fetcher, FetchOptions, FetchResult, MinimalFetchOptions} from '@berry/core';
import {Locator}                                                 from '@berry/core';
import {structUtils, tgzUtils}                                   from '@berry/core';
import {posix}                                                   from 'path';

import {PROTOCOL}                                                from './constants';

export class FileFetcher implements Fetcher {
  public mountPoint: string = `cached-fetchers`;

  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    return true;
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const {parentLocator, filePath} = this.parseLocator(locator);

    let [baseFs, release] = posix.isAbsolute(filePath)
      ? [opts.rootFs, async () => {}]
      : await opts.fetcher.fetch(parentLocator, opts);

    try {
      const packageFs = await tgzUtils.makeArchiveFromDirectory(filePath, {
        prefixPath: `berry-pkg`,
        baseFs,
      });

      return [packageFs, async () => packageFs.close()] as FetchResult;
    } finally {
      await release();
    }
  }

  private parseLocator(locator: Locator) {
    const qsIndex = locator.reference.indexOf(`?`);

    if (qsIndex === -1)
      throw new Error(`Invalid file-type locator`);

    const filePath = locator.reference.slice(PROTOCOL.length, qsIndex);
    const queryString = querystring.parse(locator.reference.slice(qsIndex + 1));

    if (typeof queryString.locator !== `string`)
      throw new Error(`Invalid file-type locator`);

    const parentLocator = structUtils.parseLocator(queryString.locator);

    return {parentLocator, filePath};
  }
}