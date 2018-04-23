/** @babel */
/** @jsx etch.dom */
/* global Promise Symbol document window atom */

import etch from 'etch'
import {Emitter} from 'atom'

import EtchComponent from './etch-component'
import symbols from './symbols'

const createNewLine = Symbol()
const cursorLineElement = Symbol()
const metaForLine = Symbol()
const elementForLine = Symbol()
const insert = Symbol()
const buildAttributes = Symbol()
const setState = Symbol()
const forEachToken = Symbol()
const resetData = Symbol()
const moveCursor = Symbol()

const classes = [
    "ansi-black",
    "ansi-red",
    "ansi-green",
    "ansi-yellow",
    "ansi-blue",
    "ansi-magenta",
    "ansi-cyan",
    "ansi-white",
    "ansi-bright-black",
    "ansi-bright-red",
    "ansi-bright-green",
    "ansi-bright-yellow",
    "ansi-bright-blue",
    "ansi-bright-magenta",
    "ansi-bright-cyan",
    "ansi-bright-white"
]

const palette = [
    [0,     0,   0], // class_name: "ansi-black"
    [187,   0,   0], // class_name: "ansi-red"
    [0,   187,   0], // class_name: "ansi-green"
    [187, 187,   0], // class_name: "ansi-yellow"
    [0,     0, 187], // class_name: "ansi-blue"
    [187,   0, 187], // class_name: "ansi-magenta"
    [0,   187, 187], // class_name: "ansi-cyan"
    [255, 255, 255], // class_name: "ansi-white"
    [85,   85,  85], // class_name: "ansi-bright-black"
    [255,  85,  85], // class_name: "ansi-bright-red"
    [0,   255,   0], // class_name: "ansi-bright-green"
    [255, 255,  85], // class_name: "ansi-bright-yellow"
    [85,   85, 255], // class_name: "ansi-bright-blue"
    [255,  85, 255], // class_name: "ansi-bright-magenta"
    [85,  255, 255], // class_name: "ansi-bright-cyan"
    [255, 255, 255], // class_name: "ansi-bright-white"
]

// Index 16..231 : RGB 6x6x6
// https://gist.github.com/jasonm23/2868981#file-xterm-256color-yaml
const levels = [
    0,
    95,
    135,
    175,
    215,
    255
];
for (let r = 0; r < 6; ++r) {
    for (let g = 0; g < 6; ++g) {
        for (let b = 0; b < 6; ++b) {
            palette.push([
                levels[r], levels[g], levels[b]
            ])
        }
    }
}

// Index 232..255 : Grayscale
for (let i = 0, grey = 8; i < 24; ++i, grey += 10) {
    palette.push([grey, grey, grey])
}

const DEFAULT_BACKGROUND = palette[0]
const DEFAULT_FOREGROUND = palette[7]
const DEFAULT_STATE = {
    foreground: DEFAULT_FOREGROUND,
    background: DEFAULT_BACKGROUND,
    invert: false,
    conceal: false,

    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,

    blinkSlow: false,
    blinkFast: false
}

function innerTextNode (node) {
    while (node && 3 !== node.nodeType) {
        node = node.firstChild
    }

    if (node && 3 === node.nodeType) {
        return node
    }

    return null
}

function splitNode (node, delta) {
    const clone = node.cloneNode(true)
    const leading = innerTextNode(clone)
    const trailing = innerTextNode(node)

    leading.textContent = leading.textContent.substr(0, delta)
    trailing.textContent = trailing.textContent.substr(delta)

    clone.dataset.length = delta
    node.dataset.length -= delta

    node.parentNode.insertBefore(clone, node)

    return clone
}

class Token
{
    constructor () {
        this.mode = null
        this.args = []
        this.modifier = null
        this.command = null
        this.text = ''

        this.currArg = ''
    }

    finalize () {
        if (this.currArg) {
            this.args.push(this.currArg)
            this.currArg = null
        }

        this.args = this.args.map(Number)
        this.finalized = true

        return this
    }

    isValid () {
        return !!(this.command || this.text)
    }

    toString () {
        let c = this.mode || ''
        c += this.args.join(';')
        c += this.modifier || ''
        c += this.command || ''
        c += this.text
        return c
    }

    getArg (idx, def) {
        if (!Number.isNaN(this.args[idx])) {
            return this.args[idx]
        }

        return def
    }
}

class Cursor
{
    constructor (row = 1, column = 1) {
        this.row = row
        this.column = column
        this.state = Object.assign({}, DEFAULT_STATE)
    }

    clone () {
        return new Cursor(this.getRow(), this.getColumn())
    }

    reset () {
        this.clear()
        this.resetState()
        this.row = 1
        this.column = 1

        // NOTE when etch detects a parent node removal, it propogates all child
        // nodes removing them from the parents. This means this.element.children
        // will also be removed
        this.element = null
    }

    clear () {
        if (this.element) {
            this.element.textContent = ''
        }
    }

    getRow () {
        return Math.max(this.row, 1)
    }

    getColumn () {
        return Math.max(this.column, 1)
    }

    storePosition () {
        this.storePositiondRow = this.getRow()
        this.storePositiondColumn = this.getColumn()
    }

    restorePosition () {
        return new Cursor(this.storePositiondRow || this.getRow(), this.storePositiondColumn || this.getColumn())
    }

    focus () {
        if (this.element) {
            this.element.lastChild.focus()
        }
    }

    blur () {
        if (this.element) {
            this.element.lastChild.blur()
        }
    }

    getElement () {
        if (!this.element) {
            const input   = document.createElement('input')
            const display = document.createElement('span')
            const cursor  = document.createElement('cursor')

            cursor.textContent = ' '
            cursor.style.width = '0.6em'

            let index = 0
            let length = 0

            const handleKeyboard = (event) => {
                if (event.ctrlKey && event.key === 'c' && !event.altKey) {
                    this.write('^C')
                    if (this.emitter) {
                        this.emitter.emit('signal', 'SIGKILL')
                    }
                } else if (1 === event.key.length) {
                    if (index === length) {
                        display.textContent += event.key
                    } else if (0 === index) {
                        display.textContent = event.key + display.textContent
                    } else {
                        const leading = display.textContent.slice(0, index)
                        const trailing = display.textContent.slice(index)

                        display.textContent = leading + event.key + trailing
                    }

                    index++
                    length++
                } else {
                    switch (event.key) {
                        case 'ArrowLeft':
                            index = Math.max(index - 1, 0)
                            break
                        case 'ArrowRight':
                            index = Math.min(index + 1, length)
                            break
                        case 'Backspace':
                            if (0 === index) {
                                break
                            }
                            index--
                            // Fall through
                        case 'Delete':
                            if (index < length - 1) {
                                const leading = display.textContent.slice(0, index)
                                const trailing = display.textContent.slice(index + 1)

                                display.textContent = leading + trailing
                                length--
                            }
                            break
                        case 'Enter':
                            if (this.emitter) {
                                this.emitter.emit('input', display.textContent + '\n')
                            }
                            display.textContent = ''
                            index = 0
                            length = 0
                            break
                    }
                }

                cursor.style.left = `calc(0.6em * ${index})`
                cursor.textContent = display.textContent.charCodeAt(index) ? display.textContent[index] : ' '
                input.value = ''
            }

            input.type = 'text'
            input.onkeydown = handleKeyboard
            input.onfocus = () => this.element.classList.add('blinking-cursor')
            input.onblur = () => this.element.classList.remove('blinking-cursor')

            this.element = document.createElement('span')
            this.element.dataset.length = 0
            this.element.className = 'etch-term-cursor'
            this.element.onclick = () => input.focus()

            this.element.appendChild(display)
            this.element.appendChild(cursor)
            this.element.appendChild(input)
        }

        return this.element
    }

    getState () {
        return Object.assign({}, this.state)
    }

    setState (state) {
        Object.assign(this.state, state)

        if (this.element) {
            const {classes, styles} = this[buildAttributes]()

            this.element.className = [
                'etch-term-cursor',
                ...classes
            ].join(' ')

            for (const name in styles) {
                this.element.style[name] = styles[name]
            }
        }
    }

    resetState () {
        this.setState(DEFAULT_STATE)
    }

    write (text) {
        const {classes, styles} = this[buildAttributes]()
        const span = document.createElement('span')

        span.classList.add(...classes)
        span.dataset.length = text.length
        span.textContent = text

        for (const name in styles) {
            span.style[name] = styles[name]
        }

        const parentNode = this.element ? this.element.parentNode : null

        if (!parentNode) {
            throw new Error('Cursor is not attached')
        }

        parentNode.insertBefore(span, this.element)
        parentNode.dataset.length = parseInt(parentNode.dataset.length) + text.length
        this.column += text.length

        // Remove text.length after
        let nextNode = this.element.nextSibling
        let remainder = text.length

        while (nextNode && remainder >= nextNode.dataset.length) {
            const nodeLength = parseInt(nextNode.dataset.length)

            parentNode.dataset.length = parseInt(parentNode.dataset.length) - nodeLength
            remainder -= nodeLength

            parentNode.removeChild(nextNode)
            nextNode = this.element.nextSibling
        }

        if (nextNode && remainder) {
            const leading = splitNode(nextNode, remainder)

            parentNode.dataset.length = parseInt(parentNode.dataset.length) - remainder
            parentNode.removeChild(leading)
        }

        let total = Array.from(parentNode.childNodes).reduce((t, i) => t + parseInt(i.dataset.length), 0)

        console.assert(!isNaN(parentNode.dataset.length), `not a number ${parentNode.dataset.length}`) // eslint-disable-line no-undef
        console.assert(parentNode.dataset.length == total, `line total missmatch ${parentNode.dataset.length} !== ${total}`) // eslint-disable-line no-undef

        return span
    }

    on (name, callback) {
        if (!this.emitter) {
            this.emitter = new Emitter()
        }

        return this.emitter.on(name, callback)
    }

    [buildAttributes] ({background = DEFAULT_BACKGROUND, foreground = DEFAULT_FOREGROUND} = {}) {
        const classes = []
        const styles = {}

        let bg = this.state.background
        let fg = this.state.foreground

        if (this.state.invert) {
            const swap = bg
            bg = fg
            fg = swap
        }

        if (this.state.conceal) {
            fg = bg
        }

        if (background !== bg) {
            if (typeof bg === 'string') {
                classes.push(bg + '-bg')
            } else {
                styles['background-color'] = 'rgb(' + bg.join(',') + ')'
            }
        }

        if (foreground !== fg) {
            if (typeof fg === 'string') {
                classes.push(fg + '-fg')
            } else {
                styles['color'] = 'rgb(' + fg.join(',') + ')'
            }
        }

        if (this.state.bold) { // font-weight: bold
            styles.fontWeight = 'bold'
        }
        if (this.state.italic) { // font-style: italic
            styles.fontStyle = 'italic'
        }
        if (this.state.underline) { // text-decoration: underline
            styles.textDecoration = 'underline'
        }
        if (this.state.strikethrough) { // text-decoration: line-through
            styles.textDecoration = (styles.textDecoration ? styles.textDecoration + ' ' : '') + 'line-through'
        }

        return {classes, styles, background: bg, foreground: fg}
    }
}

export default class EtchTerminal extends EtchComponent
{
    constructor () {
        super(...arguments)

        if (this[symbols.self].properties.onPreRenderLine) {
            this.on('pre-render-line', this[symbols.self].properties.onPreRenderLine)
        }

        if (this[symbols.self].properties.onInput) {
            this.on('input', this[symbols.self].properties.onInput)
        }
    }

    update () {
        return Promise.resolve()
    }

    clear () {
        return this[symbols.scheduleUpdate](() => {
            this[resetData]()

            etch.updateSync(this)
        })
    }

    focus () {
        if (this[symbols.self].properties.enableInput) {
            this[symbols.self].cursor.focus()
        }
    }

    blur () {
        if (this[symbols.self].properties.enableInput) {
            this[symbols.self].cursor.blur()
        }
    }

    write (data) {
        return this[symbols.scheduleUpdate](() => {
            const listElement = this.refs.list
            let autoScroll = listElement.scrollHeight - listElement.scrollTop === listElement.clientHeight

            this[forEachToken](data, token => {
                this[setState](token)

                if (token.text) {
                    this[insert](token.text)
                }
            })

            etch.updateSync(this)

            if (autoScroll) {
                this[elementForLine](-1).scrollIntoView()
            }

            this.focus()
        })
    }

    writeln (data) {
        return this.write(data + '\n')
    }

    selectAll () {
        const selection = window.getSelection()
        selection.removeAllRanges()
        const range = document.createRange()
        range.selectNodeContents(this.element)
        selection.addRange(range)
    }

    getSelection () {
        const selection = window.getSelection()

        if (this.element.contains(selection.anchorNode) && this.element.contains(selection.focusNode)) {
            return selection.toString()
        }

        return ''
    }

    copySelection () {
        const selection = this.getSelection()
        atom.clipboard.write(selection)

        return selection
    }

    pasteContent (data) {
        if (!this[symbols.self].properties.enableInput) {
            return
        }

        // Care needs to be taken when data contains newlines. They should invoke an
        // 'Enter'
        const lines = data.split('\n')

        for (let i = 0; i < lines.length - 1; i++) {
            const text = lines[i]

            // TODO should we append this to current line?
            this[symbols.emit]('input', text + '\n')
        }

        this[symbols.self].input.value = lines[lines.length - 1]
    }

    getCursor () {
        return this[symbols.self].cursor.clone()
    }

    setCursor (row, column) {
        return this[symbols.scheduleUpdate](() => {
            this[moveCursor](new Cursor(row, column))
        })
    }

    showCursor () {
        const element = this[symbols.self].cursor.getElement()

        element.style.display = 'initial'
    }

    hideCursor () {
        const element = this[symbols.self].cursor.getElement()

        element.style.display = 'none'
    }

    render () {
        return (
            <ul
                ref="list"
                className={ this[symbols.getClassName]('etch-term', 'native-key-bindings') }
                tabIndex="-1"
                onClick={ () => this[symbols.self].cursor.focus() }
            >
                { this[symbols.self].virtualLines }
            </ul>
        )
    }

    [symbols.initialize] () {
        this[symbols.self].cursor = new Cursor()
        this[resetData]()

        const changeListener = () => {
            const selection = window.getSelection()
            const selectedNode = selection.baseNode

            if (!selectedNode || selectedNode !== this.element || this.element.contains(selectedNode)) {
                if (selection.isCollapsed) {
                    this.element.classList.remove('has-selection')
                } else {
                    this.element.classList.add('has-selection')
                }
            }
        }

        this[symbols.addEventListener](document, 'selectionchange', changeListener)
        this[symbols.addDisposable](this[symbols.self].cursor.on('signal', (signal) => {
            this[symbols.emit]('signal', signal)
        }))
        this[symbols.addDisposable](this[symbols.self].cursor.on('input', (data) => {
            this[symbols.emit]('input', data)
        }))
    }

    [symbols.getDefaultProperties] () {
        return {
            enableInput: true
        }
    }

    [insert] (text) {
        this[symbols.self].cursor.write(text)
    }

    [cursorLineElement] () {
        const lineIndex = this[symbols.self].cursor.getRow() - 1
        const cursorElement = this[symbols.self].cursor.getElement()
        const element = this[elementForLine](lineIndex)

        if (!element.contains(cursorElement)) {
            throw new Error(`Cursor does not belong to current line (${lineIndex})`)
        }

        return element
    }

    [metaForLine] (idx = null) {
        if (null === idx) {
            idx = this[symbols.self].cursor.getRow() - 1
        } else if (idx < 0) {
            idx = this[symbols.self].virtualLines.length + idx
        }

        if (!(idx in this[symbols.self].virtualLines)) {
            throw new Error(`Line index '${idx} is out of range (0 - ${this[symbols.self].virtualLines.length})'`)
        }

        return this[symbols.self].virtualLines[idx]
    }

    [elementForLine] (idx = null) {
        return this[metaForLine](idx).element
    }

    [resetData] () {
        this[symbols.self].virtualLines = []
        this[symbols.self].buffer = ''
        this[symbols.self].cursor.reset()

        this[createNewLine]()
        this[symbols.self].virtualLines[0].element.appendChild(this[symbols.self].cursor.getElement())
    }

    [moveCursor] (cursor) {
        // NOTE cursor is 1 based
        const lineIndex = cursor.getRow() - 1
        const columnIndex = cursor.getColumn() - 1

        while (this[symbols.self].virtualLines.length <= lineIndex) {
            this[createNewLine](true)
        }

        const currLine = this[symbols.self].virtualLines[lineIndex].element
        const cursorElement = this[symbols.self].cursor.getElement()
        const currLineLength = currLine.dataset.length

        if (0 === columnIndex) {
            currLine.insertBefore(cursorElement, currLine.firstChild)
        } else if (currLineLength === columnIndex) {
            currLine.appendChild(cursorElement)
        } else if (currLineLength > columnIndex) {
            let node = currLine.firstChild
            let prev = null
            let currStartIndex = 0

            while (currStartIndex < columnIndex) {
                currStartIndex += node.innerText.length
                prev = node
                node = node.nextSibling
            }

            if (currStartIndex !== columnIndex) {
                node = prev
                currStartIndex -= node.innerText.length

                const delta = columnIndex - currStartIndex

                splitNode(node, delta)
            }

            currLine.insertBefore(cursorElement, node)
        } else {
            const padding = ' '.repeat(columnIndex - currLineLength)

            currLine.appendChild(cursorElement)
            this[symbols.self].cursor.write(padding)
        }

        // console.log(`Moved cursor to row: ${cursor.getRow()}, column: ${cursor.getColumn()}`);
        // console.assert(currLine.contains(cursorElement))

        this[symbols.self].cursor.row = cursor.getRow()
        this[symbols.self].cursor.column = cursor.getColumn()
    }

    [createNewLine] (append = false) {
        const line = document.createElement('li')

        line.classList.add('etch-term-line')
        line.dataset.length = 0

        this[symbols.self].virtualLines.push({
            tag: function() {
                // NOTE unbound functions have their own 'this'
                this.element = line
            },
            element: line,
        })

        if (append) {
            this.refs.list.appendChild(line)
        }

        return line
    }

    [setState] (token) {
        if ('m' === token.command) {
            let state = this[symbols.self].cursor.getState()

            // TODO styles should be storePositiond in the cursor
            // See https://stackoverflow.com/a/33206814/1479092 for token args
            for (let i = 0; i < token.args.length; i++) {
                let arg = parseInt(token.args[i])

                switch (arg) {
                    case 0: // Reset
                        Object.assign(state, DEFAULT_STATE)
                        // state = this[symbols.self].cursor.resetState()
                        break
                    case 1:
                        state.bold = true
                        break
                        // case 2:  Faint
                    case 3: // Italic
                        state.italic = true
                        break
                    case 4: // Underline
                        state.underline = true
                        break
                    case 5: // Slow Blink
                        state.blinkSlow = true
                        break
                    case 6: // Rapid Blink
                        state.blinkFast = true
                        break
                    case 7: // Invert Colours
                        state.invert = true
                        break
                    case 8: // Conceal
                        state.conceal = true
                        break
                    case 9: // Crossed-Out
                        state.strikethrough = true;
                        break
                    case 21: // Faint-Off
                    case 22: // Bold-Off
                        state.bold = false
                        break
                    case 23: // Italic-Off
                        state.italic = false
                        break
                    case 24: // Underline-Off
                        state.underline = false
                        break
                    case 25: // Blink Off
                        state.blinkSlow = false
                        break
                    case 26: // Blink Off
                        state.blinkFast = false
                        break
                    case 27: // Invert Off
                        state.invert = false
                        break
                    case 28: // Conceal Off
                        state.conceal = false
                        break
                    case 29: // Crossed-Out Off
                        state.strikethrough = false
                        break
                    case 38:
                    case 48:
                        if (i + 2 < token.args.length) {
                            const mode = token.args[i + 1]
                            let color

                            if (mode === '5') {
                                const idx = parseInt(token.args[i + 2])
                                if (0 <= idx && idx <= 255) {
                                    color = palette[idx]
                                }
                                i += 2
                            } else if (mode === '2' && i + 4 < token.args.length) {
                                const r = parseInt(token.args[i + 2], 10)
                                const g = parseInt(token.args[i + 3], 10)
                                const b = parseInt(token.args[i + 4], 10)

                                if ((0 <= r && r <= 255) && (0 <= g && g <= 255) && (0 <= b && b <= 255)) {
                                    color = [r, g, b]
                                }
                                i += 4
                            }

                            if (arg === 38) {
                                state.foreground = color
                            } else {
                                state.background = color
                            }
                        }
                        break
                    case 39: // Foreground Colour
                        state.foreground = DEFAULT_FOREGROUND
                        break
                    case 49: // Background Colour
                        state.background = DEFAULT_BACKGROUND
                        break
                    default:
                        // Standard Foreground Colour
                        if (30 <= arg && arg <= 37) {
                            // NOTE: if bold (1) is also present 8 should be added to the index
                            state.foreground = classes[
                                arg - 30// Standard Background Colour
                            ]
                        } else if (40 <= arg && arg <= 47) {
                            // NOTE: if bold (1) is also present 8 should be added to the index
                            state.background = classes[
                                arg - 40// Bright Foreground Colour
                            ]
                        } else if (90 <= arg && arg <= 98) {
                            state.foreground = palette[
                                arg - 82// Bright Background Colour
                            ]
                        } else if (100 <= arg && arg <= 108) {
                            state.background = palette[arg - 92]
                        }
                        break
                }
            }

            this[symbols.self].cursor.setState(state)
        } else if ('A' <= token.command && token.command <= 'G') {
            const cursor = this[symbols.self].cursor.clone()
            const offset = token.getArg(0, 1)

            switch (token.command) {
                case 'A': // Move up
                    cursor.row = Math.max(cursor.row - offset, 1)
                    break
                case 'B': // Move down
                    cursor.row += offset
                    break
                case 'C': // Move forward
                    cursor.column += offset
                    break
                case 'D': // Move backward
                    cursor.column = Math.max(cursor.column - offset, 1)
                    break
                case 'E': // Move next line
                    cursor.column = 1
                    cursor.row += offset
                    break
                case 'F': // Move prev line
                    cursor.column = 1
                    cursor.row = Math.max(cursor.row - offset, 1)
                    break
                case 'G': // Move to column
                    cursor.column = Math.max(offset, 1)
                    break
            }

            this[moveCursor](cursor)
        } else if ('H' === token.command) {
            const row = token.getArg(0, 1)
            const col = token.getArg(1, 1)

            this[moveCursor](new Cursor(row, col))
        } else if ('s' === token.command) {
            this.token.storePosition()
        } else if ('u' === token.command) {
            this[moveCursor](this.token.restorePosition())
        }
    }

    [forEachToken] (data, cb) {
        data = this[symbols.self].buffer + data
        this[symbols.self].buffer = ''

        let nextIndex = 0

        const readNextChar = () => {
            let char = data[nextIndex]
            let code = data.charCodeAt(nextIndex)

            if (isNaN(code)) {
                return null
            }

            nextIndex += 1

            // Surrogate high
            if (0xD800 <= code && code <= 0xDBFF) {
                const low = data.charCodeAt(nextIndex)

                if (isNaN(low)) {
                    this[symbols.self].buffer = char

                    return null
                }

                nextIndex += 1

                if (0xDC00 <= low && low <= 0xDFFF) {
                    code = ((code - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000
                    char += data.charAt(nextIndex + 1)
                }
            }

            return {char, code}
        }

        let token = new Token()

        const finalizeToken = (final = '') => {
            if ('\x1B' === final[0] && '[' === final[1]) {
                cb(token.finalize())

                token = new Token()

                let index = 2
                while (index < final.length) {
                    const char = final[index]
                    const code = final.charCodeAt(index)

                    if (code === 33 || (code >= 60 && code <= 63)) {
                        token.mode = char
                    }
                    // ';' separated digits are command args
                    else if (code >= 48 && code <= 57) {
                        token.currArg += char
                    }
                    // argument separator
                    else if (code === 59) {
                        if (token.currArg) {
                            token.args.push(token.currArg)
                            token.currArg = ''
                        }
                    }
                    // (space), '!', '"', '#', '$', '%', '&', ''', '(', ')', '*', '+', ',', '-', '.', '/'
                    // Are intermedaite modifiers
                    else if (code >= 32 && code <= 47) {
                        token.modifier = char
                    }
                    // The command itself
                    else if (code >= 64 && code <= 126) {
                        token.command = char
                    }

                    index++
                }
            } else {
                token.text += final
            }

            cb(token.finalize())

            token = new Token()
        }

        let parseEscape = false
        let iter = readNextChar()

        while (iter) {
            const {char, code} = iter

            if (parseEscape) {
                // The leading chars (!, <, =, >, ?) are private mode
                if (code === 33 || (code >= 60 && code <= 63)) {
                    token.mode = char
                }
                // ';' separated digits are command args
                else if (code >= 48 && code <= 57) {
                    token.currArg += char
                }
                // argument separator
                else if (code === 59) {
                    if (token.currArg) {
                        token.args.push(token.currArg)
                        token.currArg = ''
                    }
                }
                // (space), '!', '"', '#', '$', '%', '&', ''', '(', ')', '*', '+', ',', '-', '.', '/'
                // Are intermedaite modifiers
                else if (code >= 32 && code <= 47) {
                    token.modifier = char
                }
                // The command itself
                else if (code >= 64 && code <= 126) {
                    token.command = char
                    parseEscape = false
                }
                // Illegal char within escape sequence
                else {
                    // Render the whole sequence and let the browser handle the display
                    const newToken = new Token()
                    newToken.text = token.toString()
                    token = newToken
                    parseEscape = false
                }
            } else if (char === '\r') {
                // Translates to 'move to column 1'
                finalizeToken('\x1B[0G')
            } else if (char === '\n') {
                // Translates to 'move to column 1' then 'move down one line'
                finalizeToken('\x1B[0G')
                finalizeToken('\x1B[1B')
            } else if (char === '\b') {
                // Translates to 'move back one space'
                finalizeToken('\x1B[1D')
            } else if (code === 27) {
                iter = readNextChar()

                if (!iter) {
                    // Incomplete Escape sequence
                    this[symbols.self].buffer = "\x1B"
                    break
                } else if (iter.char === '[') {
                    // Begin reading an ANSI escape sequence
                    finalizeToken()
                    parseEscape = true
                } else {
                    // Unprintable character. The browser should print a special
                    token.text += "\x1B" + char
                }
            }
            else {
                // Add char to current span data
                token.text += char
            }

            iter = readNextChar()
        }

        if (!token.isValid()) {
            // If the buffer was written above, the token should be empty
            this[symbols.self].buffer += token.toString()
        } else {
            finalizeToken()
        }
    }
}
