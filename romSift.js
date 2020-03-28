//
// Copyright (c) 2020 Jon Thysell
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//

const fs = require('fs');
const path = require('path');

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
    .action((dir, cmdObj) => {
        checkDir(dir);
        romSift(dir, cmdObj.interactive);
    });
    
program.command('clean <rom-directory>')
    .description('remove unecessary tags from files')
    .action((dir, cmdObj) => {
        checkDir(dir);
        romClean(dir);
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
        console.log(`Found ${fileEntry.filename}.`);

        if (!fileMap.hasOwnProperty(fileEntry.title)) {
            fileMap[fileEntry.title] = [];
        }

        fileMap[fileEntry.title].push(fileEntry);
        count++;
    });

    if (count > 0) {
        console.log();
        console.log(`Found ${count} titles across ${filenames.length} files.`);
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

function romSift(romDirectory, interactive) {
    var fileMap = scanDir(romDirectory);

    var titles = Object.keys(fileMap);

    if (titles.length == 0) {
        console.log('No files to sift.');
        return;
    }

    pauseForEnter(interactive);

    titles.forEach(title => {
        var fileEntries = fileMap[title];

        var filesToKeep = interactive ? promptForFilesToKeep(title, fileEntries) : defaultFilesToKeep(title, fileEntries);

    });
}

function romClean(romDirectory) {
    var fileMap = scanDir(romDirectory);

    var titles = Object.keys(fileMap);

    if (titles.length == 0) {
        console.log('No files to clean.');
        return;
    }

    console.log();
    console.log('Cleaning files...');

    var count = 0;
    titles.forEach(title => {
        var fileEntries = fileMap[title];

        if (fileEntries.length == 1) {
            var oldName = fileEntries[0].filename;
            var newName = fileEntries[0].title + fileEntries[0].extension;
            if (oldName != newName) {
                console.log(`Rename ${oldName} to ${newName}...`);
                fs.renameSync(path.join(romDirectory, oldName), path.join(romDirectory, newName));
                count++;
            }
        }
    });

    if (count == 0) {
        console.log('No files to clean.');
    } else {
        console.log();
        console.log(`Cleaned ${count} files.`);
    }
}

