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
    path  = require('path'),
    nopt  = require('nopt'),
    spawn = require('./spawn'),
    utils = require('./utils'),
    MSBuildTools = require('./MSBuildTools'),
    ConfigParser = require('./ConfigParser');

// Platform project root folder
var ROOT = path.join(__dirname, '..', '..');
var projFiles = {
    phone: 'CordovaApp.Phone.jsproj',
    store: 'CordovaApp.Store.jsproj',
    store80: 'CordovaApp.Store80.jsproj'
};
// parsed nopt arguments
var args;
// build type (Release vs Debug)
var buildType;
// target chip architectures to build for
var buildArchs;
// MSBuild Tools available on this development machine
var msbuild;

// builds cordova-windows application with parameters provided.
// See 'help' function for args list
module.exports.run = function run (argv) {
    if (!utils.isCordovaProject(ROOT)){
        return Q.reject('Could not find project at ' + ROOT);
    }

    try {
        // thows exception if something goes wrong
        parseAndValidateArgs(argv);
    } catch (error) {
        return Q.reject(error);
    }

    return MSBuildTools.findAvailableVersion().then(
        function(msbuildTools) {
            msbuild = msbuildTools;
            console.log('MSBuildToolsPath: ' + msbuild.path);
            return applyPlatformConfig().then(buildTargets);
        });
};

// help/usage function
module.exports.help = function help() {
    console.log("");
    console.log("Usage: build [ --debug | --release ] [--archs=\"<list of architectures...>\"]");
    console.log("    --help    : Displays this dialog.");
    console.log("    --debug   : builds project in debug mode. (Default)");
    console.log("    --release : builds project in release mode.");
    console.log("    -r        : shortcut :: builds project in release mode.");
    console.log("    --archs   : Builds project binaries for specific chip architectures. `anycpu` + `arm` + `x86` + `x64` are supported.");
    console.log("examples:");
    console.log("    build ");
    console.log("    build --debug");
    console.log("    build --release");
    console.log("    build --release --archs=\"arm x86\"");
    console.log("");
    process.exit(0);
};

function parseAndValidateArgs(argv) {
    // parse and validate args
    args = nopt({'debug': Boolean, 'release': Boolean, 'archs': [String],
        'phone': Boolean, 'store': Boolean}, {'-r': '--release'}, argv);
    // Validate args
    if (args.debug && args.release) {
        throw 'Only one of "debug"/"release" options should be specified';
    }
    if (args.phone && args.store) {
        throw 'Only one of "phone"/"store" options should be specified';
    }
    
    // get build options/defaults
    buildType = args.release ? 'release' : 'debug';
    buildArchs = args.archs ? args.archs.split(' ') : ['anycpu'];
}

function buildTargets() {

    // filter targets to make sure they are supported on this development machine
    var buildTargets = filterSupportedTargets(getBuildTargets(), msbuild);

    var buildConfigs = [];

    // collect all build configurations (pairs of project to build and target architecture)
    buildTargets.forEach(function(buildTarget) {
        buildArchs.forEach(function(buildArch) {
            buildConfigs.push({target:buildTarget, arch: buildArch});
        })
    });

    // run builds serially
    return buildConfigs.reduce(function (promise, build) {
         return promise.then(function () {
            // support for "any cpu" specified with or without space
            if (build.arch == 'any cpu') {
                build.arch = 'anycpu';
            }
            // msbuild 4.0 requires .sln file, we can't build jsproj
            if (msbuild.version == '4.0' && build.target == projFiles.store80) {
                build.target = 'CordovaApp.vs2012.sln';
            }
            return msbuild.buildProject(path.join(ROOT, build.target), buildType,  build.arch);
         });
    }, Q()); 
}

function applyPlatformConfig() {
    // run powershell ApplyPlatformConfig.ps1
    return utils.getApplyPlatformConfigScript().then(function(ApplyPlatformConfigScript) {
        return spawn('Powershell', ['-File', ApplyPlatformConfigScript, ROOT]);
    });
}

function getBuildTargets() {
    var config = new ConfigParser(path.join(ROOT, 'config.xml'));
    var targets = [];
    var noSwitches = !(args.phone || args.store);

    if (args.store || noSwitches) { // if --store or no arg
        var windowsTargetVersion = config.getPreference('windows-target-version')
        switch(windowsTargetVersion) {
        case '8':
        case '8.0':
            targets.push(projFiles.store80);
            break;
        case '8.1':
            targets.push(projFiles.store);
            break;
        default:
            throw new Error('Unsupported windows-target-version value: ' + windowsTargetVersion)
        }
    }

    if (args.phone || noSwitches) { // if --phone or no arg
        var windowsPhoneTargetVersion = config.getPreference('windows-phone-target-version')
        switch(windowsPhoneTargetVersion) {
        case '8.1':
            targets.push(projFiles.phone);
            break;
        default:
            throw new Error('Unsupported windows-phone-target-version value: ' + windowsPhoneTargetVersion)
        }
    }
    return targets;
}

function filterSupportedTargets (targets) {
    if (!targets || targets.length == 0) {
        console.warn("\r\nNo build targets are specified.");
        return [];
    }

    if (msbuild.version != '4.0') {
        return targets;
    }

    // MSBuild 4.0 does not support Windows 8.1 and Windows Phone 8.1
    var supportedTargets = targets.filter(function(target) {
        return target != projFiles.store && target != projFiles.phone;
    });

    // unsupported targets have been detected
    if (supportedTargets.length != targets.length) {
        console.warn("\r\nWarning. Windows 8.1 and Windows Phone 8.1 target platforms are not supported on this development machine and will be skipped.");
        console.warn("Please install OS Windows 8.1 and Visual Studio 2013 Update2 in order to build for Windows 8.1 and Windows Phone 8.1.\r\n");
    }
    return supportedTargets;
}
