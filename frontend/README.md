# ShAIRR Platform

## Quick Start

#### Prerequisites
Before you begin, make sure your development environment includes `Node.js®` and an `npm` package manager.

###### Node.js
[**Angular 18**](https://angular.io/guide/what-is-angular) requires `Node.js` LTS version `^14.20` or `^16.13` or `^18.10`.

- To check your version, run `node -v` in a terminal/console window.
- To get `Node.js`, go to [nodejs.org](https://nodejs.org/).

###### Angular CLI
Install the Angular CLI globally using a terminal/console window.
```bash
npm install -g @angular/cli
```

### Installation

``` bash
$ npm install
```

### Basic usage

``` bash
# dev server with hot reload at http://localhost:4200
$ npm run start
```

If you are not running shAIRR's backend locally, run:
``` bash
# dev server with hot reload at http://localhost:4200
$ npm run start-remote
```

Navigate to [http://localhost:4200](http://localhost:4200). The app will automatically reload if you change any of the source files.

#### Build

Run `build` to build the project. The build artifacts will be stored in the `dist/` directory.

```bash
# build for production with minification
$ npm run build
```

`ng build --baseHref=/example/`

## What's included

Within the download you'll find the following directories and files, logically grouping common assets and providing both compiled and minified variations. You'll see something like this:

```
coreui-free-angular-admin-template
├── src/                         # project root
│   ├── app/                     # main app directory
|   │   ├── containers/          # layout containers
|   |   │   └── default-layout/  # layout containers
|   |   |       └── _nav.js      # sidebar navigation config
|   │   ├── icons/               # icons set for the app
|   │   └── views/               # application views
│   ├── assets/                  # images, icons, etc.
│   ├── components/              # components for demo only
│   ├── scss/                    # scss styles
│   └── index.html               # html template
│
├── angular.json
├── README.md
└── package.json
```

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Third-party copyright and licenses

Based on the CoreUI base template:
- [CoreUI Angular Admin Dashboard Template & UI Components Library](https://coreui.io/angular)

- [CoreUI Angular Demo](https://coreui.io/angular/demo/4.3/free/)

- [CoreUI Angular Docs](https://coreui.io/angular/docs/)

Copyright 2022 creativeLabs Łukasz Holeczek.

Code released under [the MIT license](https://github.com/coreui/coreui-free-react-admin-template/blob/master/LICENSE).
There is only one limitation you can't re-distribute the CoreUI as stock. You can’t do this if you modify the CoreUI. In past we faced some problems with persons who tried to sell CoreUI based templates.

## Troubleshooting
### "Could not resolve dependency" when installing node modules (npm i)
Try `npm install --legacy-peer-deps` instead of `npm i` / `npm install`.