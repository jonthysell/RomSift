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
    .option("--interactive", "prompt the user for which files to keep", false)
    .option("-n, --noop", "only preview file changes, don't actually sift", false)
    .action((dir, cmdObj) => {
        checkDir(dir);
        romSift(dir, cmdObj.interactive, cmdObj.noop);
    });
    
program.command('clean <rom-directory>')
    .description('remove unecessary tags from file names')
    .option("-n, --noop", "only preview file changes, don't actually clean", false)
    .action((dir, cmdObj) => {
        checkDir(dir);
        romClean(dir, cmdObj.noop);
    });

program.parse(process.argv);

function checkDir(dir) {
    if (!fs.existsSync(dir)) {
        console.error(`error: directory ${dir} not found`)
        process.exit(1);
    } else {
        try {
            fs.accessSync(dir);
        }
        catch {
            console.error(`error: directory ${dir} cannot be accessed`)
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

function scanDir(dir)
{
    var fileMap = {};

    console.log(`Scanning ${dir}...`);
    console.log();

    var filenames = fs.readdirSync(dir);

    var count = 0;
    filenames.forEach(filename => {
        var fileEntry = createFileEntry(filename);
        console.log(`Found ${chalk.bold(fileEntry.filename)}.`);

        if (!fileMap.hasOwnProperty(fileEntry.title)) {
            fileMap[fileEntry.title] = [];
            count++;
        }

        fileMap[fileEntry.title].push(fileEntry);
    });

    if (count > 0) {
        console.log();
        console.log(`Found ${chalk.bold(count)} titles across ${chalk.bold(filenames.length)} files.`);
    }

    return fileMap;
}

function pauseForEnter(interactive) {
    if (interactive) {
        console.log();
        readlineSync.question('Press enter to continue...');
    }
}

function defaultFilesToKeep(title, fileEntries) {
    return [];
}

function promptForFilesToKeep(title, fileEntries) {
    return [];
}

function romSift(romDirectory, interactive, noop) {
    var fileMap = scanDir(romDirectory);

    var titles = Object.keys(fileMap);

    if (titles.length == 0) {
        console.log('No files to sift.');
        return;
    }

    pauseForEnter(interactive);

    var totalCount = 0;
    titles.forEach(title => {
        var fileEntries = fileMap[title];
        totalCount += fileEntries.length;

        var filesToKeep = interactive ? promptForFilesToKeep(title, fileEntries) : defaultFilesToKeep(title, fileEntries);

    });
}

function tryRomRename(romDirectory, fileEntry, noop) {
    var oldName = fileEntry.filename;

    var newName = fileEntry.title;

    fileEntry.tags.forEach(tag => {
        newName += ` (${tag})`;
    });

    newName += fileEntry.extension;

    if (oldName == newName) {
        console.log(`${ noop ? 'Would s' : 'S' }kip ${chalk.bold(oldName)}...`);
    } else {
        console.log(`${ noop ? 'Would r' : 'R' }ename ${chalk.bold(oldName)} to ${chalk.bold(newName)}...`);
        if (!noop) {
            fs.renameSync(path.join(romDirectory, oldName), path.join(romDirectory, newName));
        }
        return true;
    }
    return false;
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

function romClean(romDirectory, noop) {
    var fileMap = scanDir(romDirectory);

    var titles = Object.keys(fileMap);

    if (titles.length == 0) {
        console.log('No files to clean.');
        return;
    }

    console.log();
    console.log(`Clean files...`);

    var totalCount = 0;
    var cleanCount = 0;
    titles.forEach(title => {
        var fileEntries = fileMap[title];
        totalCount += fileEntries.length;

        if (fileEntries.length == 1) {
            fileEntries[0].tags = [];
            if (tryRomRename(romDirectory, fileEntries[0], noop)) {
                cleanCount++;
            }
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
                if (tryRomRename(romDirectory, fileEntry, noop)) {
                    cleanCount++;
                }
            });
        }
    });

    if (cleanCount == 0) {
        console.log(`No files to clean.`);
    } else {
        console.log();
        console.log(`${ noop ? 'Would have c' : 'C' }leaned ${chalk.bold(cleanCount)} of ${chalk.bold(totalCount)} files.`);
    }
}

