import {Configuration, MessageName, PluginConfiguration, StreamReport} from '@berry/core';
import {npmHttpUtils}                                                  from '@berry/plugin-npm';
import {Clipanion}                                                     from 'clipanion';
import {Readable, Writable}                                            from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: Clipanion, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`npm whoami`)
  .describe(`display username`)

  .detail(`
    Print the registry username to standard output.
  `)

  .example(
    `Print username for the default registry`,
    `yarn npm whoami`,
  )

  .action(async ({cwd, stdin, stdout}: {cwd: string, stdin: Readable, stdout: Writable, registry: string}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);

    const report = await StreamReport.start({configuration, stdout}, async report => {

      try {
        const responseBuffer = await npmHttpUtils.get(`/-/whoami`, { configuration, ident: null, forceAuth: true });
        const jsonResponse = JSON.parse(responseBuffer.toString());

        report.reportInfo(MessageName.UNNAMED, jsonResponse.username);
      } catch (err) {
        if (err.statusCode === 401 || err.statusCode === 403)
          report.reportError(MessageName.AUTHENTICATION_INVALID, `Authentication failed - your credentials may have expired`);

        report.reportError(MessageName.AUTHENTICATION_INVALID, err.toString());
      }
    });

    return report.exitCode();
  });
