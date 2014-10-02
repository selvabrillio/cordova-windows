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

var util = require('util'),
    Stream = require('stream');

var logger = {
    levels: {},
    prefixes: {},
    output: process.stdout
};

logger.log = function (logLevel, message) {
    if (this.levels[logLevel] >= this.levels[this.logLevel]) {
        var prefix = this.prefixes[logLevel] ? this.prefixes[logLevel] + ': ' : '';
            // suffix = /.*(\r|\n)$/.test(message) ? '' : '\n';
            suffix = '\n';
        this.output.write(prefix + message + suffix);
    }
};

logger.addLevel = function (level, severity, prefix) {
    this.levels[level] = severity;
    if (prefix) {
        this.prefixes[level] = prefix;
    }
    if (!this[level]) {
        this[level] = this.log.bind(this, level);
        return this[level];
    }
};

logger.setLevel = function (logLevel) {
    if (this.levels[logLevel]) {
        this.logLevel = logLevel;
    }
};

logger.setOutput = function (stream) {
    if (stream instanceof Stream) {
        this.output = stream;
    }
};

logger.addLevel('normal' , 2000);
logger.addLevel('info'   , 5000);
logger.addLevel('verbose', 1000, 'DEBUG');
logger.addLevel('error'  , 5000, 'ERROR');

logger.setLevel('normal');

if (process.argv.slice(2).indexOf('--silent') >= 0) {
    logger.setLevel("error");
}

if (process.argv.slice(2).indexOf('--verbose') >= 0) {
    logger.setLevel("verbose");
}

module.exports = logger;