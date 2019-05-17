import { Configuration, LocatorHash, PluginConfiguration, Project, Workspace } from '@berry/core';
import { Cache, DescriptorHash, LightReport, MessageName, StreamReport }       from '@berry/core';
import { miscUtils, structUtils }                                              from '@berry/core';
import { PortablePath }                                                        from '@berry/fslib';
import { Writable }                                                            from 'stream';
import { cpus }                                                                from 'os';
import pLimit                                                                  from 'p-limit';


type ForeachOptions = {
  args: Array<string>;
  command: string;
  cwd: PortablePath;
  exclude: string[];
  include: string[];
  interlaced: boolean;
  parallel: boolean;
  prefixed: boolean;
  stdout: Writable;
  withDependencies: boolean;
}

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

    .command(`workspaces foreach <command> [...args] [-p,--parallel] [--with-dependencies] [-I,--interlaced] [-P,--prefixed] [-i,--include WORKSPACES...] [-x,--exclude WORKSPACES...]`)
    .flags({proxyArguments: true})

    .categorize(`Workspace-related commands`)
    .describe(`run a command on all workspaces`)

    .action(
      async ({cwd, args, stdout, command, exclude, include, interlaced, parallel, withDependencies, prefixed, ...env}: ForeachOptions) => {
        const configuration = await Configuration.find(cwd, pluginConfiguration);
        const { project } = await Project.find(configuration, cwd);
        const cache = await Cache.find(configuration);

        const needsProcessing = new Map<LocatorHash, Workspace>();
        const processing = new Set<DescriptorHash>();

        const concurrency = parallel ? Math.max(1, cpus().length / 2) : 1;
        const limit = pLimit(concurrency);

        let commandCount = 0;

        const resolutionReport = await LightReport.start({configuration, stdout}, async (report: LightReport) => {
          await project.resolveEverything({lockfileOnly: true, cache, report});
        });

        if (resolutionReport.hasErrors())
          return resolutionReport.exitCode();
    
        const runReport = await StreamReport.start({configuration, stdout}, async report => {
          let workspaces = command.toLowerCase() === `run`
            ? project.workspaces.filter(workspace => workspace.manifest.scripts.has(args[0]))
            : project.workspaces;

          if (include.length > 0)
            workspaces = workspaces.filter(workspace => include.includes(workspace.locator.name))

          if (exclude.length > 0)
            workspaces = workspaces.filter(workspace => !exclude.includes(workspace.locator.name))

          for (const workspace of workspaces)
            needsProcessing.set(workspace.anchoredLocator.locatorHash, workspace);

          while (needsProcessing.size > 0) {
            const commandPromises = [];

            for (const [identHash, workspace] of needsProcessing) {
              // If we are already running the command on that workspace, skip
              if (processing.has(workspace.anchoredDescriptor.descriptorHash))
                continue;

              let isRunnable = true;

              // By default we do topological, however we don't care of the order when running
              // in --parallel unless also given the --with-dependencies flag
              if (!parallel || withDependencies) {
                for (const [identHash, descriptor] of workspace.dependencies) {
                  const locatorHash = project.storedResolutions.get(descriptor.descriptorHash);
                  if (typeof locatorHash === `undefined`)
                    throw new Error(`Assertion failed: The resolution should have been registered`);

                  if (needsProcessing.has(locatorHash)) {
                    isRunnable = false;
                    break;
                  }
                }
              }

              if (!isRunnable)
                continue;

              processing.add(workspace.anchoredDescriptor.descriptorHash);

              commandPromises.push(limit(async () => {
                await runCommand(workspace, {
                  commandIndex: ++commandCount,
                });

                needsProcessing.delete(identHash);
                processing.delete(workspace.anchoredDescriptor.descriptorHash);
              }));
            }

            if (commandPromises.length === 0)
              return report.reportError(MessageName.CYCLIC_DEPENDENCIES, `Dependency cycle detected`);

            await Promise.all(commandPromises);
          }

          async function runCommand(workspace: Workspace, {commandIndex}: {commandIndex: number}) {
            const prefix = getPrefix(workspace, {configuration, prefixed, commandIndex});

            const stdout = createStream(report, {prefix, interlaced});
            const stderr = createStream(report, {prefix, interlaced});

            try {
              await clipanion.run(null, args, {
                ...env,
                cwd: workspace.cwd,
                stdout: stdout,
                stderr: stderr,
              });
            } finally {
              stdout.end();
              stderr.end();
            }

            // If we don't wait for the `end` event, there is a race condition
            // between this function (`runCommand`) completing and report.exitCode()
            // being called which will trigger StreamReport finalize and we would get
            // something like `➤ YN0000: Done in Ns` before all the commands complete.
            await Promise.all([
              new Promise(resolve => stdout.on(`end`, resolve)),
              new Promise(resolve => stderr.on(`end`, resolve)),
            ]);
          }
        });

        return runReport.exitCode();
      }
    );


function createStream(report: Report, {prefix, interlaced}: {prefix: string | null, interlaced: boolean}) {
  const streamReporter = report.createStreamReporter(prefix);

  if (interlaced)
    return streamReporter;

  const streamBuffer = new miscUtils.BufferStream();
  streamBuffer.pipe(streamReporter);

  return streamBuffer;
}

type GetPrefixOptions = {
  configuration: Configuration;
  commandIndex: number;
  prefixed: boolean;
};

function getPrefix(workspace: Workspace, {configuration, commandIndex, prefixed}: GetPrefixOptions) {
  if (!prefixed)
    return null;

  const ident = structUtils.convertToIdent(workspace.locator);
  const name = structUtils.stringifyIdent(ident);

  let prefix = `[${name}]:`;

  const colors = [`cyan`, `green`, `yellow`, `blue`, `magenta`];
  const colorName = colors[commandCount % colors.length];

  return configuration.format(prefix, colorName);
}
