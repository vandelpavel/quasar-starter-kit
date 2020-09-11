const path = require('path');
const fs = require('fs');
const spawn = require('child_process').spawn;

const lintStyles = ['standard', 'airbnb', 'prettier'];

/**
 * Sorts dependencies in package.json alphabetically.
 * They are unsorted because they were grouped for the handlebars helpers
 * @param {object} data Data from questionnaire
 */
function sortDependencies(data) {
  const pkgFile = path.join(
    data.inPlace ? '' : data.destDirName,
    'package.json'
  );
  let sorted = false;
  const pkg = JSON.parse(fs.readFileSync(pkgFile));

  if (pkg.dependencies) {
    sorted = true;
    pkg.dependencies = sortObject(pkg.dependencies);
  }
  if (pkg.devDependencies) {
    sorted = true;
    pkg.devDependencies = sortObject(pkg.devDependencies);
  }

  if (sorted) {
    fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
  }
}

/**
 * Runs `npm install` in the project directory
 * @param {string} cwd Path of the created project directory
 * @param {object} data Data from questionnaire
 */
function installDependencies(cwd, executable = 'npm', color) {
  console.log(`\n\n ${color('[*] Installing project dependencies ...')}\n`);
  return runCommand(executable, ['install'], { cwd });
}

/**
 * Install all the selected app esxtension from preInstalledAppExtensions
 * @param {string} cwd Path of the created project directory
 * @param {object} data Data from questionnaire
 */
function installAppExtension(cwd, arg) {
  return runCommand('quasar ext add', [arg], { cwd });
}

/**
 * Runs `npm run lint -- --fix` in the project directory
 * @param {string} cwd Path of the created project directory
 * @param {object} data Data from questionnaire
 */
function runLintFix(cwd, data, color) {
  if (data.preset.lint && lintStyles.indexOf(data.lintConfig) !== -1) {
    console.log(
      `\n\n ${color(
        '[*] Running eslint --fix to comply with chosen preset rules...'
      )}\n\n`
    );
    const args =
      data.autoInstall === 'npm'
        ? ['run', 'lint', '--', '--fix']
        : ['run', 'lint', '--fix'];
    return runCommand(data.autoInstall, args, {
      cwd,
    });
  }
  return Promise.resolve();
}

/**
 * If the user will have to run lint --fix themselves, it returns a string
 * containing the instruction for this step.
 * @param {Object} data Data from questionnaire.
 */
function lintMsg(data) {
  return !data.autoInstall &&
    data.lint &&
    lintStyles.indexOf(data.lintConfig) !== -1
    ? 'npm run lint -- --fix (or for yarn: yarn run lint --fix)\n  '
    : '';
}

/**
 * Prints the final message with instructions of necessary next steps.
 * @param {Object} data Data from questionnaire.
 */
function printMessage(data, { green, yellow }) {
  const message = `
 ${green('[*] Quasar Project initialization finished!')}

To get started:

  ${yellow(
    `${data.inPlace ? '' : `cd ${data.destDirName}\n  `}${installMsg(
      data
    )}${lintMsg(data)}quasar dev`
  )}

Documentation can be found at: https://quasar.dev

Quasar is relying on donations to evolve. We'd be very grateful if you can
read our manifest on "Why donations are important": https://quasar.dev/why-donate
Donation campaign: https://donate.quasar.dev
Any amount is very welcomed.
If invoices are required, please first contact razvan@quasar.dev

Please give us a star on Github if you appreciate our work:
https://github.com/quasarframework/quasar

Enjoy! - Quasar Team
`;
  console.log(message);
}

/**
 * If the user will have to run `npm install` or `yarn` themselves, it returns a string
 * containing the instruction for this step.
 * @param {Object} data Data from the questionnaire
 */
function installMsg(data) {
  return !data.autoInstall ? 'npm install (or if using yarn: yarn)\n  ' : '';
}

/**
 * Spawns a child process and runs the specified command
 * By default, runs in the CWD and inherits stdio
 * Options are the same as node's child_process.spawn
 * @param {string} cmd
 * @param {array<string>} args
 * @param {object} options
 */
function runCommand(cmd, args, options) {
  return new Promise((resolve, reject) => {
    const spwan = spawn(
      cmd,
      args,
      Object.assign(
        {
          cwd: process.cwd(),
          stdio: 'inherit',
          shell: true,
        },
        options
      )
    );

    spwan.on('exit', (code) => {
      if (code) {
        console.log();
        console.log(
          ` ${cmd} install FAILED... Possible temporary npm registry issues?`
        );
        console.log(` Please try again later...`);
        console.log();
        process.exit(1);
      }

      resolve();
    });
  });
}

function sortObject(object) {
  // Based on https://github.com/yarnpkg/yarn/blob/v1.3.2/src/config.js#L79-L85
  const sortedObject = {};
  Object.keys(object)
    .sort()
    .forEach((item) => {
      sortedObject[item] = object[item];
    });
  return sortedObject;
}

module.exports.complete = function (data, { chalk }) {
  const green = chalk.green;
  const yellow = chalk.yellow;

  sortDependencies(data, green);

  const cwd = path.join(process.cwd(), data.inPlace ? '' : data.destDirName);
  const mapAppExtension = {
    ssg: {
      addExtension:
        'yarn add --dev https://github.com/freddy38510/quasar-app-extension-ssg',
      invokeExtension: 'quasar ext invoke ssg',
    },
    animate: '@dreamonkey/animate',
  };

  if (data.autoInstall) {
    installDependencies(cwd, data.autoInstall, green)
      .then(() => {
        console.log(`\n\n ${yellow('[*] Installing  app extensions: ...')}\n`);

        // return installAppExtension(cwd, mapAppExtension['animate']);

        const myExtensionsObj = data.preInstalledAppExtensions;
        const extensionsNames = [];

        for (const name in myExtensionsObj) {
          if (myExtensionsObj.hasOwnProperty(name)) {
            extensionsNames.push(name);
          }
        }

        console.log(extensionsNames);

        return extensionsNames.reduce((previousPromise, nextExtension) => {
          return previousPromise.then(() => {
            // This is a work around that will add ssg extension even if not published
            if (nextExtension === 'ssg') {
              return runCommand(
                mapAppExtension[nextExtension].addExtension,
                [''],
                {
                  cwd,
                }
              ).then(() => {
                return runCommand(
                  mapAppExtension[nextExtension].invokeExtension,
                  [''],
                  {
                    cwd,
                  }
                );
              });
            } else {
              return installAppExtension(cwd, mapAppExtension['animate']);
            }
          });
        }, Promise.resolve());
      })
      .then(() => {
        return runLintFix(cwd, data, green);
      })
      .then(() => {
        printMessage(data, green);
      })
      .catch((e) => {
        console.log(chalk.red('Error:'), e);
      });
  } else {
    printMessage(data, chalk);
  }
};
