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
    ansi = require('ansi'),
    Stream = require('stream');

var logger = {
    levels: {},
    prefixes: {},
    colors: {},
    output: process.stdout
};

logger.cursor = ansi(logger.output);

logger.log = function (logLevel, message) {
    if (this.levels[logLevel] >= this.levels[this.logLevel]) {
        var prefix = this.prefixes[logLevel] ? this.prefixes[logLevel] + ': ' : '';
            suffix = '\n';
            message = prefix + message + suffix;

        if (!this.cursor) {
            this.output.write(message);
        }
        if (this.output !== this.cursor.stream) {
            this.cursor = ansi(this.output, { enabled: colorEnabled });
        }
        var color = this.colors[logLevel];
        !!color && this.cursor.bold().fg[color]();
        this.cursor.write(message);
        this.cursor.reset();
    }
};

logger.addLevel = function (level, severity, prefix, color) {
    this.levels[level] = severity;
    prefix && (this.prefixes[level] = prefix);
    color && (this.colors[level] = color);
    
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

logger.addLevel('verbose', 1000, '', 'grey');
logger.addLevel('normal' , 2000);
logger.addLevel('warn'   , 2000, 'WARN ', 'yellow');
logger.addLevel('info'   , 5000);
logger.addLevel('error'  , 5000, 'ERROR', 'red');

logger.setLevel('normal');

if (process.argv.slice(2).indexOf('--silent') >= 0) {
    logger.setLevel("error");
}

if (process.argv.slice(2).indexOf('--verbose') >= 0 || process.argv.slice(2).indexOf('-d') >= 0) {
    logger.setLevel("verbose");
}

module.exports = logger;