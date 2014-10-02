/*
       Licensed to the Apache Software Foundation (ASF) under one
       or more contributor license agreements.  See the NOTICE file
       distributed with this work for additional information
       regarding copyright ownership.  The ASF licenses this file
       to you under the Apache License, Version 2.0 (the
       "License"); you may not use this file except in compliance
       with the License.  You may obtain a copy of the License at

         http://www.apache.org/licenses/LICENSE-2.0

       Unless required by applicable law or agreed to in writing,
       software distributed under the License is distributed on an
       "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
       KIND, either express or implied.  See the License for the
       specific language governing permissions and limitations
       under the License.
*/

var Q     = require('Q'),
    fs    = require('fs'),
    path  = require('path'),
    nopt  = require('nopt'),
    shell = require('shelljs'),
    uuid  = require('node-uuid'),
    logger = require('../../template/cordova/lib/logger');

// Creates cordova-windows project at specified path with specified namespace, app name and GUID
module.exports.run = function (argv) {

    // Parse args
    var args = nopt({"guid": String}, {}, argv);

    // Set parameters/defaults for create
    var projectPath = args.argv.remain[0];
    if (fs.existsSync(projectPath)){
        return Q.reject("Project directory already exists:\n\t" + projectPath);
    }
    var packageName = args.argv.remain[1] || "Cordova.Example",
        appName     = args.argv.remain[2] || "CordovaAppProj",
        // 64 symbols restriction goes from manifest schema definition
        // http://msdn.microsoft.com/en-us/library/windows/apps/br211415.aspx
        safeAppName = appName.length <= 64 ? appName : appName.substr(0, 64),
        templateOverrides = args.argv.remain[3],
        guid        = args['guid'] || uuid.v1(),
        root        = path.join(__dirname, '..', '..');

    logger.normal("Creating Cordova Windows Project:");
    logger.normal("\tApp Name  : " + appName);
    logger.normal("\tNamespace : " + packageName);
    logger.normal("\tPath      : " + projectPath);
    if (templateOverrides) {
        logger.verbose("\tCustomTemplatePath : " + templateOverrides);
    }

    // Copy the template source files to the new destination
    logger.verbose('Copying template to ' + projectPath);
    shell.cp("-rf", path.join(root, 'template', '*'), projectPath);

    // Copy our unique VERSION file, so peeps can tell what version this project was created from.
    shell.cp("-rf", path.join(root, 'VERSION'), projectPath);

    // copy node_modules to cordova directory
    shell.cp('-rf', path.join(root, 'node_modules'), path.join(projectPath, 'cordova'));

    if (templateOverrides && fs.existsSync(templateOverrides)) {
        logger.verbose('Copying template overrides from ' + templateOverrides + ' to ' + projectPath);
        shell.cp("-rf", templateOverrides, projectPath);
    }

    // replace specific values in manifests' templates
    logger.verbose('Writing packageName: ' + packageName + ' and appName: ' + safeAppName + ' to manifest files');
    ["package.windows.appxmanifest", "package.windows80.appxmanifest", "package.phone.appxmanifest"].forEach(function (file) {
        var fileToReplace = path.join(projectPath, file);
        shell.sed('-i', /\$guid1\$/g, guid, fileToReplace);
        shell.sed('-i', /\$safeprojectname\$/g, packageName, fileToReplace);
        shell.sed('-i', /\$projectname\$/g, safeAppName, fileToReplace);
    });

    // Delete bld forder and bin folder
    ["bld", "bin", "*.user", "*.suo", "MyTemplate.vstemplate"].forEach(function (file) {
        shell.rm('-rf', path.join(projectPath, file));
    });

    // TODO: Name the project according to the arguments
    // update the solution to include the new project by name
    // version BS
    // index.html title set to project name ?
    
    return Q.resolve();
};

module.exports.help = function () {
    console.log("Usage: create PathToProject [ PackageName [ AppName [ CustomTemplate ] ] ] [--guid=<GUID string>]");
    console.log("    PathToProject : The path to where you wish to create the project");
    console.log("    PackageName   : The namespace for the project (default is Cordova.Example)");
    console.log("    AppName       : The name of the application (default is CordovaAppProj)");
    console.log("    CustomTemplate: The path to project template overrides");
    console.log("                        (will be copied over default platform template files)");
    console.log("    --guid        : The App's GUID (default is random generated)");
    console.log("examples:");
    console.log("    create C:\\Users\\anonymous\\Desktop\\MyProject");
    console.log("    create C:\\Users\\anonymous\\Desktop\\MyProject io.Cordova.Example AnApp");
};