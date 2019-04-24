import {Resolver, ResolveOptions, MinimalResolveOptions} from '@berry/core';
import {Descriptor, Locator, Manifest} from '@berry/core';
import {LinkType} from '@berry/core';
import {miscUtils, structUtils} from '@berry/core';
import {NodeFS} from '@berry/fslib';
import querystring from 'querystring';

import {FILE_REGEXP, PROTOCOL} from './constants';

export class FileResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor, opts: MinimalResolveOptions) {
    if (descriptor.range.match(FILE_REGEXP)) return true;

    if (!descriptor.range.startsWith(PROTOCOL)) return false;

    return true;
  }

  supportsLocator(locator: Locator, opts: MinimalResolveOptions) {
    if (!locator.reference.startsWith(PROTOCOL)) return false;

    return true;
  }

  shouldPersistResolution(locator: Locator, opts: MinimalResolveOptions) {
    return false;
  }

  bindDescriptor(descriptor: Descriptor, fromLocator: Locator, opts: MinimalResolveOptions) {
    if (FILE_REGEXP.test(descriptor.range))
      descriptor = structUtils.makeDescriptor(descriptor, `file:${descriptor.range}`);

    if (descriptor.range.includes(`?`)) throw new Error(`File-type dependencies cannot contain the character "?"`);

    return structUtils.makeDescriptor(
      descriptor,
      `${descriptor.range}?${querystring.stringify({
        locator: structUtils.stringifyLocator(fromLocator),
      })}`,
    );
  }

  async getCandidates(descriptor: Descriptor, opts: ResolveOptions) {
    let path = descriptor.range;

    if (path.startsWith(PROTOCOL)) path = path.slice(PROTOCOL.length);

    return [structUtils.makeLocator(descriptor, `${PROTOCOL}${NodeFS.toPortablePath(path)}`)];
  }

  async resolve(locator: Locator, opts: ResolveOptions) {
    const packageFetch = await opts.fetcher.fetch(locator, opts);

    const manifest = await miscUtils.releaseAfterUseAsync(async () => {
      return await Manifest.find(packageFetch.prefixPath, {baseFs: packageFetch.packageFs});
    }, packageFetch.releaseFs);

    return {
      ...locator,

      version: manifest.version || `0.0.0`,

      languageName: opts.project.configuration.get(`defaultLanguageName`),
      linkType: LinkType.HARD,

      dependencies: manifest.dependencies,
      peerDependencies: manifest.peerDependencies,

      dependenciesMeta: manifest.dependenciesMeta,
      peerDependenciesMeta: manifest.peerDependenciesMeta,
    };
  }
}
