# kubedump

[![GitHub stars](https://img.shields.io/github/stars/codejamninja/kubedump.svg?style=social&label=Stars)](https://github.com/codejamninja/kubedump)

> dump kubernetes

Please ★ this repo if you found it useful ★ ★ ★

## Features

- dump kubernetes volumes

## Installation

```sh
npm install -g kubedump
```

## Flags

| Name             | Type    | Required |
| ---------------- | ------- | -------- |
| all-namespaces   | boolean | false    |
| rancher-cluster  | string  | false    |
| rancher-dump     | boolean | false    |
| rancher-endpoint | string  | false    |
| rancher-token    | string  | false    |
| skip-namespaces  | string  | false    |
| volume-dump      | boolean | false    |
| dry              | boolean | false    |
| namespace        | string  | false    |
| output           | string  | false    |
| privileged       | boolean | false    |

## Dependencies

- [NodeJS](https://nodejs.org)

## Usage

[Contribute](https://github.com/codejamninja/kubedump/blob/master/CONTRIBUTING.md) usage docs

Copy the kube config file into locally

Create API Keys with no scope in rancher, its genetares secret key

```sh
pnpm run build
cp example.env env
```

To know name spaces

```sh
kubens
```

Select the name space and Activate it

```sh
kubens <name space>
```

```
node ./bin/kubedump.js --dry

run that output commands
```

To backup rancher

```
node ./bin/kubedump.js --rancher-dump

you will get tar file and extract it
```

If you want tree structure

```
sudo apt-get install tree
```

Now got to the extracted folder and run tree command, you will get the file structure.

In the answers.txt file contains questions and answers.

To dump database

```
node ./bin/kubedump.js -o tmp
```

Extract the output tar file.Under the volumes folder contain database data.

I you want any help on copying files.

```
kubectl cp --help
```

## Support

Submit an [issue](https://github.com/codejamninja/kubedump/issues/new)

## Screenshots

[Contribute](https://github.com/codejamninja/kubedump/blob/master/CONTRIBUTING.md) a screenshot

## Contributing

Review the [guidelines for contributing](https://github.com/codejamninja/kubedump/blob/master/CONTRIBUTING.md)

## License

[MIT License](https://github.com/codejamninja/kubedump/blob/master/LICENSE)

[Jam Risser](https://codejam.ninja) © 2020

## Changelog

Review the [changelog](https://github.com/codejamninja/kubedump/blob/master/CHANGELOG.md)

## Credits

- [Jam Risser](https://codejam.ninja) - Author

## Support on Liberapay

A ridiculous amount of coffee ☕ ☕ ☕ was consumed in the process of building this project.

[Add some fuel](https://liberapay.com/codejamninja/donate) if you'd like to keep me going!

[![Liberapay receiving](https://img.shields.io/liberapay/receives/codejamninja.svg?style=flat-square)](https://liberapay.com/codejamninja/donate)
[![Liberapay patrons](https://img.shields.io/liberapay/patrons/codejamninja.svg?style=flat-square)](https://liberapay.com/codejamninja/donate)
