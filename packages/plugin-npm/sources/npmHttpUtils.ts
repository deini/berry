import {Configuration, Ident, httpUtils} from '@berry/core';
import {MessageName, ReportError}        from '@berry/core';

type AuthOptions = {
  forceAuth?: boolean,
  ident?: Ident,
}

export type Options = httpUtils.Options & AuthOptions;

export async function get(url: string, {configuration, headers, ident, forceAuth, ... rest}: Options) {
  const auth = getAuthenticationHeader({configuration}, {ident, forceAuth});
  if (auth)
    headers = {... headers, authorization: auth};

  return await httpUtils.get(url, {configuration, headers, ... rest});
}

export async function put(url: string, body: httpUtils.Body, {configuration, headers, ident, forceAuth, ... rest}: Options) {
  // We always must authenticate our PUT requests
  const auth = getAuthenticationHeader({configuration}, {ident, forceAuth: true});
  if (auth)
    headers = {... headers, authorization: auth};

  return await httpUtils.put(url, body, {configuration, headers, ... rest});
}

function getAuthenticationHeader({configuration}: {configuration: Configuration}, {ident, forceAuth}: AuthOptions) {
  const mustAuthenticate = configuration.get(`npmAlwaysAuth`) || forceAuth;

  if (!mustAuthenticate && (!ident || !ident.scope))
    return null;

  if (configuration.get(`npmAuthToken`))
    return `Bearer ${configuration.get(`npmAuthToken`)}`;

  if (configuration.get(`npmAuthIdent`))
    return `Basic ${configuration.get(`npmAuthIdent`)}`;

  if (mustAuthenticate) {
    throw new ReportError(MessageName.AUTHENTICATION_NOT_FOUND ,`No authentication configured for request`);
  } else {
    return null;
  }
}
