'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.colorize = colorize;
exports.default = createLogger;

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _ansi256Colors = require('ansi-256-colors');

var _ansi256Colors2 = _interopRequireDefault(_ansi256Colors);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const {
    getRgb: rgb
} = _ansi256Colors.fg;

const SPACER = rgb(1, 1, 1) + '┈' + _ansi256Colors.reset;
const GET_LEVEL = responseTime => Math.floor(responseTime / 50) - 1;

function join(strings, ...values) {
    const indent = strings[0].match(/\n( *)/)[1];

    let result = '';

    for (let i = 0; i < strings.length; i++) {
        const split = strings[i].split(indent);

        result += (split[1] || '') + (values[i] || '');

        if (i !== strings.length - 1) {
            result += ' ';
        }
    }

    result = result.replace(/\s+$/, '');

    return result;
}

function chars(character, num) {
    let string = '';

    for (let i = 0; i < num; i++) {
        string += character;
    }

    return string;
}

function breakLines(message, messageWidth, map) {
    const lines = [];

    for (let i = 0; i < message.length; i = i + messageWidth) {
        let line = message.substr(i, messageWidth);

        const lineBreak = line.indexOf('\n');

        if (lineBreak >= 0) {
            line = line.substr(0, lineBreak);
            i = i - messageWidth + lineBreak + 1;
        }

        lines.push(line);
    }

    for (let i = 0; i < lines.length; i++) {
        map(lines[i], i, lines);
    }
}

function colorize(color = 0) {
    if (typeof color === 'number') {
        if (color <= 0) {
            return character => character;
        }

        let green = 6 - color;

        if (green < 0) {
            green = 0;
        }

        return character => rgb(5, green, 0) + character + _ansi256Colors.reset;
    } else {
        let format;

        switch (color) {
            case 'info':
                format = _ansi256Colors2.default.fg.standard[4];
                break;
            case 'warning':
                format = rgb(5, 5, 0);
                break;
            case 'error':
                format = rgb(5, 2, 0);
                break;
            case 'fatal':
                format = rgb(5, 0, 0);
                break;
        }

        if (format) {
            return character => format + character + _ansi256Colors.reset;
        } else {
            return character => character;
        }
    }
}

function printToConsole({
    colorizer,
    context,
    getWidth,
    maxLocaleTimeLength,
    reporter,
    slim,
    slot,
    slots
}) {
    return ({
        char,
        format,
        formatLine,
        meta = () => false,
        separator = SPACER
    }) => {
        return (...messages) => {
            if (!formatLine) {
                if (format) {
                    formatLine = format;
                } else {
                    formatLine = string => string;
                }
            }

            const message = messages.map(arg => {
                if (arg instanceof Function) {
                    return String(arg);
                }

                if (arg instanceof Object) {
                    return _util2.default.inspect(arg, {
                        depth: null
                    });
                }

                return arg;
            }).join(' ');

            const timeLength = maxLocaleTimeLength();

            const now = new Date();

            const _slots = slots.map(slot => slot ? colorizer(now - slot, context)('│') : separator);

            let messageWidth;

            const width = getWidth();

            if (width) {
                messageWidth = width - 4 - timeLength - 6 - slots.length * 2;
            }

            if (!width || messageWidth < 1) {
                messageWidth = message.length;
            }

            breakLines(message, messageWidth, (line, i, lines) => {
                let $meta = meta(i, lines.length);

                if (!$meta) {
                    $meta = chars(' ', 4 + timeLength + 5);
                }

                _slots[slot] = format ? format(char(i, lines.length)) : colorizer(now - slots[slot], context)(char(i, lines.length));

                const $slots = _slots.join(slim ? '' : separator);

                const formattedLine = join`
                    ${$meta}
                    ${$slots}
                    ${formatLine(line)}
                `;

                reporter.write(formattedLine + '\n');
            });
        };
    };
}

function createLogger(options = {}) {
    const {
        minSlots = 1,
        getLevel = GET_LEVEL,
        colorizer = (responseTime, context) => {
            const level = getLevel(responseTime, context);

            return colorize(level);
        },
        width,
        timestamp: showTimestamp = false,
        slim = false,
        reporter = process.stdout,
        req = context => context.originalUrl,
        res = context => context.originalUrl
    } = options;

    let getWidth;

    switch (typeof width) {
        case 'function':
            getWidth = width;
            break;
        case 'number':
            getWidth = () => width;
            break;
        case 'boolean':
            getWidth = () => false;
            break;
        default:
            getWidth = () => process.stdout.columns;
    }

    const slots = new Array(minSlots).fill(null);

    let maxLocaleTimeLength;

    if (showTimestamp) {
        maxLocaleTimeLength = new Date().toLocaleTimeString().length;
    } else {
        maxLocaleTimeLength = 5;
    }

    return (() => {
        var _ref = _asyncToGenerator(function* (context, next) {
            const start = new Date();

            let slot;
            for (let i = 0; i < slots.length; i++) {
                if (!slots[i]) {
                    slot = i;
                    break;
                }
            }

            if (slot === undefined) {
                slots.push(null);
                slot = slots.length - 1;
            }

            slots[slot] = +start;

            const printer = printToConsole({
                colorizer,
                context,
                getWidth,
                maxLocaleTimeLength: function () {
                    return maxLocaleTimeLength;
                },
                reporter,
                slim,
                slot,
                slots
            });

            const log = printer({
                char: function () {
                    return '╎';
                },
                separator: ' '
            });

            log.info = printer({
                char: function () {
                    return '╎';
                },
                format: colorize('info'),
                separator: ' '
            });

            log.error = printer({
                char: function () {
                    return '╎';
                },
                format: colorize('fatal'),
                separator: ' '
            });

            context.log = log;

            const {
                method
            } = context;

            let $method = method.substr(0, 4);

            if ($method.length < 4) {
                $method += chars(SPACER, 4 - method.length);
            }

            {
                let $time;

                if (showTimestamp) {
                    $time = start.toLocaleTimeString();

                    if ($time.length > maxLocaleTimeLength) {
                        maxLocaleTimeLength = $time.length;
                    } else if ($time.length < maxLocaleTimeLength) {
                        $time = chars(SPACER, maxLocaleTimeLength - $time.length) + $time;
                    }
                } else {
                    $time = chars(SPACER, maxLocaleTimeLength);
                }

                const print = printer({
                    char: function (i) {
                        return i ? '│' : '┬';
                    },
                    meta: function (i) {
                        return !i && `──‣ ${$time} ${$method}`;
                    }
                });

                print(req(context));
            }

            let exception;

            try {
                yield next();
            } catch (error) {
                log.error(error);

                exception = error;
            }

            const end = new Date();
            const duration = end - start;

            let $duration;

            if (duration >= 1000) {
                let fixed = 6 - String(duration).length;

                if (fixed < 0) {
                    fixed = 0;
                }

                $duration = `${(duration / 1000).toFixed(fixed)}s`;
            } else {
                $duration = `${duration}ms`;
            }

            const durationLength = $duration.length;

            $duration = colorizer(duration, context)($duration);

            if (durationLength < maxLocaleTimeLength) {
                $duration = chars(SPACER, maxLocaleTimeLength - durationLength) + $duration;
            }

            const {
                status
            } = context;

            let $status;

            if (exception) {
                $status = colorize('fatal')('ERR');
            } else if (status >= 100 && status < 200) {
                $status = colorize('info')(status);
            } else if (status < 300) {
                $status = status;
            } else if (status >= 300 && status < 400) {
                $status = colorize('warning')(status);
            } else if (status < 500) {
                $status = colorize('error')(status);
            } else {
                $status = colorize('fatal')(status);
            }

            {
                const print = printer({
                    meta: function (i, length) {
                        return i === length - 1 && `${$status} ${$duration} ${$method}`;
                    },
                    char: function (i, length) {
                        return i === length - 1 ? '┴' : '│';
                    }
                });

                print(res(context));
            }

            slots[slot] = null;

            if (exception) {
                throw exception;
            }
        });

        function logger(_x, _x2) {
            return _ref.apply(this, arguments);
        }

        return logger;
    })();
}