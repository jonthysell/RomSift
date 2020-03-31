//
// Copyright (c) 2020 Jon Thysell
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//

const fs = require('fs');
const path = require('path');

const chalk = require('chalk');
const commander = require('commander');
const readlineSync = require('readline-sync');

const packageJson = require('./package.json');

const program = new commander.Command(packageJson.name)
    .description(packageJson.description)
    .version(packageJson.version)
    .usage('command [options] <rom-directory>');

program.command('sift <rom-directory>')
    .description('sift through files to remove duplicates')
    .option("-i, --interactive", "prompt the user for which files to sift", false)
    .option("-n, --noop", "only preview file changes, don't actually sift", false)
    .option("-v, --verbose", "show verbose output", false)
    .action((dir, cmdObj) => {
        checkDir(dir);
        romSift(dir, {
            interactive: cmdObj.interactive,
            noop: cmdObj.noop,
            verbose: cmdObj.verbose,
        });
    });
    
program.command('clean <rom-directory>')
    .description('remove unecessary tags from file names')
    .option("-i, --interactive", "prompt the user for which files to clean", false)
    .option("-n, --noop", "only preview file changes, don't actually clean", false)
    .option("-v, --verbose", "show verbose output", false)
    .action((dir, cmdObj) => {
        checkDir(dir);
        romClean(dir, {
            interactive: cmdObj.interactive,
            noop: cmdObj.noop,
            verbose: cmdObj.verbose,
        });
    });

program.parse(process.argv);

function checkDir(dir) {
    if (!fs.existsSync(dir)) {
        console.error(`error: directory ${dir} not found`);
        process.exit(1);
    } else {
        try {
            fs.accessSync(dir);
        }
        catch {
            console.error(`error: directory ${dir} cannot be accessed`);
            process.exit(1);
        }
    }
}

function createFileEntry(filename) {
    filename = path.basename(filename);

    let extension = path.extname(filename);
    let title = filename.slice(0, -extension.length);

    let tags = title.match(/\(([^()]+)\)/g);
    tags = tags ? tags.map(i => i.slice(1, -1)) : [];
    
    title = title.split('(')[0].trim();

    return {
        filename:  filename,
        extension: extension,
        title: title,
        tags: tags,
        keep: false,
    };
}

function scanDir(dir, options) {
    var fileMap = {};

    console.log(`Scanning ${dir}...`);

    var filenames = fs.readdirSync(dir);

    var count = 0;
    filenames.forEach(filename => {
        var fileEntry = createFileEntry(filename);

        if (options.verbose) {
            console.log(`Found ${chalk.bold(fileEntry.filename)}.`);
        }

        if (!fileMap.hasOwnProperty(fileEntry.title)) {
            fileMap[fileEntry.title] = [];
            count++;
        }

        fileMap[fileEntry.title].push(fileEntry);
    });

    if (count > 0) {
        console.log(`Scan complete, found ${chalk.bold(count)} titles across ${chalk.bold(filenames.length)} files.`);
    }

    return fileMap;
}

function pauseForEnter(interactive, message) {
    if (interactive) {
        if (message) {
            console.log();
            console.log(message);
        }
        console.log();
        readlineSync.question('Press enter to continue...');
    }
}

function getRomSiftOperation(romDirectory, fileEntries, options) {
    var romsToKeep = Array.from({length: fileEntries.length}, (x, i) => i);

    if (options.interactive) {
        console.log();
        console.log(`Select files for title ${chalk.bold(fileEntries[0].title)}:`);

        fileEntries.forEach((fileEntry, i) => {
            console.log(`${i+1}) ${chalk.bold(fileEntry.filename)}`);
        });

        var response = readlineSync.question(`Which files do you want to keep? [${ romsToKeep.map(i => i + 1).map(String).join(',') }] `);

        var responseRomsToKeep = [];
        var split = response.split(',');

        var validResponse = false;
        for (var i = 0; i < split.length; i++) {
            var value = parseInt(split[i]);
            if (!isNaN(value)) {
                validResponse = true;
                if (value == 0) {
                    responseRomsToKeep = [];
                    break;
                } else {
                    responseRomsToKeep.push(value - 1);
                }
            }
        }

        if (validResponse) {
            romsToKeep = responseRomsToKeep;
        }
    }

    var removeCount = 0;
    fileEntries.forEach((fileEntry, i) => {
        var keep = romsToKeep.indexOf(i) >= 0;

        if (options.verbose) {
            console.log(`Would ${ keep ? 'keep' : 'remove' } ${chalk.bold(fileEntry.filename)}...`);
        }

        fileEntry.keep = keep;
        removeCount += fileEntry.keep ? 0 : 1;
    });

    return {
        removeCount: removeCount,
        callback: () => {
            var count = 0;
            fileEntries.forEach((fileEntry) => {
                if (options.verbose) {
                    console.log(`${ fileEntry.keep ? 'Keeping' : 'Removing' } ${chalk.bold(fileEntry.filename)}...`);
                }

                if (!fileEntry.keep) {
                    try {
                        fs.unlinkSync(path.join(romDirectory, fileEntry.filename));
                        count++;
                    } catch {
                        console.error(`error: unable to remove ${fileEntry.filename}`);
                    }
                }
            });
            return count;
        }
    };
}

function romSift(romDirectory, options) {
    var fileMap = scanDir(romDirectory, options);

    var titles = Object.keys(fileMap);

    if (titles.length == 0) {
        console.log('No files to remove.');
        return;
    }

    pauseForEnter(options.interactive, 'Ready to evaluate files.');

    console.log();
    console.log(`Evaluating files...`);

    var totalCount = 0;
    var removeCount = 0;

    var callbacks = [];

    titles.forEach(title => {
        var fileEntries = fileMap[title];
        totalCount += fileEntries.length;

        var op = getRomSiftOperation(romDirectory, fileEntries, options);

        removeCount += op.removeCount;

        callbacks.push(op.callback);
    });

    console.log(`Evaluation complete, would remove ${chalk.bold(removeCount)} of ${chalk.bold(totalCount)} files.`);

    if (options.noop) {
        console.log();
        console.log(`Re-run without the -no-op flag to actually remove files.`);
    }
    else {
        pauseForEnter(options.interactive, 'Ready to remove files.');

        console.log();
        console.log(`Removing files...`);

        var count = 0;
        callbacks.forEach((cb) => {
            count += cb();
        });

        console.log(`Removed ${chalk.bold(count)} files.`);
    }
}

function setCleanFileName(fileEntry) {
    var newName = fileEntry.title;

    fileEntry.tags.forEach(tag => {
        newName += ` (${tag})`;
    });

    newName += fileEntry.extension;

    fileEntry.cleanFilename = newName;
}

function promptForConfirm(interactive, question, defaultResponse) {
    const yesStrings = ['y', 'yes'];
    const noStrings = ['n', 'no'];

    var defaultStr = defaultResponse ? 'y' : 'n';
    var response = defaultStr;

    if (interactive) {
        console.log();
        
        response = readlineSync.question(`${question} [${ defaultStr }] `);
        response = response.trim().toLowerCase();

        if (yesStrings.indexOf(response) < 0 && noStrings.indexOf(response) < 0) {
            response = defaultStr;
        }
    }

    if (yesStrings.indexOf(response) >= 0) {
        return true;
    } else if (noStrings.indexOf(response) >= 0) {
        return false;
    }
}

function getRomCleanOperation(romDirectory, fileEntry, options) {
    setCleanFileName(fileEntry);
    
    if (fileEntry.filename == fileEntry.cleanFilename) {
        if (options.verbose) {
            console.log(`Would skip ${chalk.bold(fileEntry.filename)}...`);
        }
    } else {
        if (options.verbose || options.interactive) {
            console.log(`Would rename ${chalk.bold(fileEntry.filename)} to ${chalk.bold(fileEntry.cleanFilename)}...`);
        }

        var rename = promptForConfirm(options.interactive, 'Do you want to rename this file?', true);

        if (rename) {
            return {
                clean: true,
                callback: () => {
                    if (options.verbose) {
                        console.log(`Renaming ${chalk.bold(fileEntry.filename)} to ${chalk.bold(fileEntry.cleanFilename)}...`);
                    }

                    try {
                        fs.renameSync(path.join(romDirectory, fileEntry.filename), path.join(romDirectory, fileEntry.cleanFilename));
                        return true;
                    } catch {
                        console.error(`error: unable to rename ${fileEntry.filename}`);
                    }
                    return false;
                }
            };
        }
    }

    return {
        clean: false,
        callback: () => {
            if (options.verbose) {
                console.log(`Skipping ${chalk.bold(fileEntry.filename)}...`);
            }
            return false;
        }
    };
}

function getTagHistogram(fileEntries) {
    var tagHist = {};
    fileEntries.forEach(fileEntry => {
        fileEntry.tags.forEach(tag => {
            if (!tagHist.hasOwnProperty(tag)) {
                tagHist[tag] = 0;
            }
            tagHist[tag]++;
        });
    });
    return tagHist;
}

function romClean(romDirectory, options) {
    var fileMap = scanDir(romDirectory, options);

    var titles = Object.keys(fileMap);

    if (titles.length == 0) {
        console.log('No files to rename.');
        return;
    }

    pauseForEnter(options.interactive, 'Ready to evaluate files.');

    console.log();
    console.log(`Evaluating files...`);

    var totalCount = 0;
    var cleanCount = 0;

    var callbacks = [];

    titles.forEach(title => {
        var fileEntries = fileMap[title];
        totalCount += fileEntries.length;

        if (fileEntries.length == 1) {
            var fileEntry = fileEntries[0];

            fileEntry.tags = [];

            var op = getRomCleanOperation(romDirectory, fileEntry, options);

            if (op.clean) {
                cleanCount++;
            }

            callbacks.push(op.callback);
        } else {
            var tagHist = getTagHistogram(fileEntries);

            Object.keys(tagHist).forEach(tag => {
                if (tagHist[tag] >= fileEntries.length) {
                    fileEntries.forEach(fileEntry => {
                        var index = fileEntry.tags.indexOf(tag);
                        while (index > -1) {
                            fileEntry.tags.splice(index, 1);
                            index = fileEntry.tags.indexOf(tag);
                        }
                    });
                }
            });

            fileEntries.forEach(fileEntry => {
                var op = getRomCleanOperation(romDirectory, fileEntry, options);

                if (op.clean) {
                    cleanCount++;
                }

                callbacks.push(op.callback);
            });
        }
    });

    console.log(`Evaluation complete, would rename ${chalk.bold(cleanCount)} of ${chalk.bold(totalCount)} files.`);

    if (options.noop) {
        console.log();
        console.log(`Re-run without the -no-op flag to actually rename files.`);
    }
    else {
        pauseForEnter(options.interactive, 'Ready to rename files.');

        console.log();
        console.log(`Renaming files...`);

        var count = 0;
        callbacks.forEach((cb) => {
            if (cb()) {
                count++;
            }
        });

        console.log(`Renamed ${chalk.bold(count)} files.`);
    }
}
