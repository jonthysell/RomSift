# romsift #

romsift is utility for sifting through large ROM collections.

It is intended to help pare down large romsets (particularly [no-intro](https://www.no-intro.org/)) to remove unwanted duplicates and make browsing the files easier.

It works by scanning a directory of files and grouping them by their title, ignoring any tags (text in parentheses).

With the `sift` command, you can delete duplicate files for a title. You choose which file(s) you wish to keep, and let romsift delete the others.

With the `clean` command, you can rename files to remove the tags. romsift will only remove the tags that every title has in common, leaving the unique tags. For example, cleaning the following:

```
Popular Game (USA).zip
Popular Game (USA) (Beta).zip
```

will become: 

```
Popular Game.zip
Popular Game (Beta).zip
```

because every file for `Popular Game` has the `USA` tag.

However, cleaning:

```
Popular Game (Japan).zip
Popular Game (USA).zip
Popular Game (USA) (Beta).zip
```

results in no changes:

```
Popular Game (Japan).zip
Popular Game (USA).zip
Popular Game (USA) (Beta).zip
```

because each tag is still necessary to differentiate the files.

## Usage ##

```
Usage: romsift command [options] <rom-directory>

Utility for sifting through large ROM collections.

Options:
  -V, --version                    output the version number
  -h, --help                       display help for command

Commands:
  sift [options] <rom-directory>   sift through files to remove duplicates
  clean [options] <rom-directory>  remove unecessary tags from file names
  help [command]                   display help for command
```

```
Usage: romsift sift [options] <rom-directory>

sift through files to remove duplicates

Options:
  -i, --interactive  prompt the user for which files to sift (default: false)
  -n, --noop         only preview file changes, don't actually sift (default: false)
  -v, --verbose      show verbose output (default: false)
  -h, --help         display help for command
```

```
Usage: romsift clean [options] <rom-directory>

remove unecessary tags from file names

Options:
  -i, --interactive  prompt the user for which files to clean (default: false)
  -n, --noop         only preview file changes, don't actually clean (default: false)
  -v, --verbose      show verbose output (default: false)
  -h, --help         display help for command
```

## Errata ##

TEGS is open-source under the MIT license.

Copyright (c) 2020-2022 Jon Thysell
