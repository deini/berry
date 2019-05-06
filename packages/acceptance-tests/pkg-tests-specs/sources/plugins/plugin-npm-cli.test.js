const {
  fs: {readJson, writeFile}
} = require('pkg-tests-core');

const AUTH_TOKEN = `686159dc-64b3-413e-a244-2de2b8d1c36f`;
const AUTH_IDENT = `dXNlcm5hbWU6YSB2ZXJ5IHNlY3VyZSBwYXNzd29yZA==`;

const INVALID_AUTH_TOKEN = `a24cb960-e6a5-45fc-b9ab-0f9fe0aaae57`;
const INVALID_AUTH_IDENT = `dXNlcm5hbWU6bm90IHRoZSByaWdodCBwYXNzd29yZA==`; // username:not the right password

describe(`Plugins`, () => {
  describe(`npm-cli`, () => {
    test(
      `should print the npm registry username when config has a valid npmAuthToken`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `npmAuthToken "${AUTH_TOKEN}"\n`);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `whoami`));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    test(
      `should print the npm registry username when config has a valid npmAuthIdent`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `npmAuthIdent "${AUTH_IDENT}"\n`);

        let code;
        let stdout;
        let stderr;

        try {
          ({code, stdout, stderr} = await run(`npm`, `whoami`));
        } catch (error) {
          ({code, stdout, stderr} = error);
        }

        expect({code, stdout, stderr}).toMatchSnapshot();
      })
    );

    test(
      `should throw an error when no auth config is found`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await expect(run(`npm`, `whoami`)).rejects.toThrowError(/Authentication not found/);
      })
    );

    test(
      `should throw an error when config has an invalid npmAuthToken`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `npmAuthToken "${INVALID_AUTH_TOKEN}"\n`);
        await expect(run(`npm`, `whoami`)).rejects.toThrowError(/Authentication failed/);
      })
    );

    test(
      `should throw an error when config has an invalid npmAuthIdent`,
      makeTemporaryEnv({}, async ({ path, run, source }) => {
        await writeFile(`${path}/.yarnrc`, `npmAuthIdent "${INVALID_AUTH_IDENT}"\n`);
        await expect(run(`npm`, `whoami`)).rejects.toThrowError(/Authentication failed/);
      })
    );
  });
});
