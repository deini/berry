import querystring = require('querystring');

import {Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {Descriptor, Locator, Manifest}                   from '@berry/core';
import {structUtils}                                     from '@berry/core';

import {FILE_REGEXP, TARBALL_REGEXP, PROTOCOL}           from './constants';

export class TarballFileResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (!TARBALL_REGEXP.test(descriptor.range))
      return false;

    if (descriptor.range.startsWith(PROTOCOL))
      return true;

    if (FILE_REGEXP.test(descriptor.range))
      return true;

    return false;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!TARBALL_REGEXP.test(locator.reference))
      return false;

    if (locator.reference.startsWith(PROTOCOL))
      return true;

    return false;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return true;
  }

  async normalizeDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    if (FILE_REGEXP.test(descriptor.range))
      descriptor = structUtils.makeDescriptor(descriptor, `file:${descriptor.range}`);

    if (descriptor.range.includes(`?`))
      throw new Error(`File-type dependencies cannot contain the character "?"`);

    return structUtils.makeDescriptor(descriptor, `${descriptor.range}?${querystring.stringify({
      locator: structUtils.stringifyLocator(fromLocator),
    })}`);
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    return [descriptor.range];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const [baseFs, release] = await opts.fetcher.fetch(locator, opts);

    try {
      const manifest = await Manifest.fromFile(`package.json`, {baseFs});

      const dependencies = manifest.dependencies;
      const peerDependencies = manifest.peerDependencies;

      return {... locator, dependencies, peerDependencies};
    } finally {
      await release();
    }
  }
}