/** @babel */
/* global atom window */

import etch from 'etch'
import {Emitter, CompositeDisposable} from 'atom'
import symbols from './symbols'
import {camelCase, toArray, clone} from './utils'

const parseProperties = (...props) => {
	const properties = Object.assign({}, ...props)
	const dataset = properties.dataset || {}

	Object.keys(properties).forEach(key => {
		if (key.startsWith('data-')) {
			const value = properties[key]
			const newKey = camelCase(key.substring(5))

			dataset[newKey] = value
		}
	})

	properties.dataset = dataset

	return properties
}

export default class EtchComponent
{
	constructor (properties, children) {
		properties = parseProperties({
			attributes: {}
		}, this[symbols.getDefaultProperties](), properties || {})

		if (etch.getScheduler() !== atom.views) {
			etch.setScheduler(atom.views);
		}

		if (properties.state) {
			this[symbols.state] = clone(properties.state)
		} else {
			this[symbols.state] = {}
		}

		this[symbols.self] = {
			children: children || [],
			properties
		}

		if (typeof this[symbols.initialize] === 'function') {
			this[symbols.initialize](this[symbols.self].properties, this[symbols.self].children)
		}

		etch.initialize(this)

		this[symbols.addDataSet]()
		this[symbols.addEventListeners]()
	}

	update (properties, children, options) {
		this[symbols.self].properties = parseProperties(this[symbols.self].properties, properties || {})

		if (Array.isArray(children)) {
			this[symbols.self].children = children
		}

		options = Object.assign({}, {
			update: 'update',
			replaceNode: true
		}, options)

		if (options.update) {
			return etch[options.update](this, options.replaceNode)
		}
	}

	destroy () {
		if (this.listeners) {
			this.listeners.dispose()
		}

		etch.destroy(this)
	}

	getState () {
		return null
	}

	on (eventName, cb) {
		if (!this.emitter) {
			this.emitter = new Emitter()
		}

		return this.emitter.on(eventName, cb)
	}

	setAttribute (name, value) {
		this.element.setAttribute(name, value)
	}

	removeAttribute (name) {
		this.element.removeAttribute(name)
	}

	addClass (names) {
		names = toArray(...arguments)

		this.element.classList.add(...names)
	}

	removeClass (names) {
		names = toArray(...arguments)

		this.element.classList.remove(...names)
	}

	getClassList () {
		return this.element.classList
	}

	getDataSetValue (name) {
		return this.element.dataset[name]
	}

	render () {
		throw new Error('EtchComponent.render has not been implemented!')
	}

	[symbols.getDefaultProperties] () {
		return {}
	}

	[symbols.listen] (disposable) {
		if (!this.listeners) {
			this.listeners = new CompositeDisposable()
		}

		this.listeners.add(disposable)
	}

	[symbols.emit] (eventName, data) {
		if (!this.emitter) {
			this.emitter = new Emitter()
		}
		this.emitter.emit(eventName, data)
	}

	[symbols.addEventListeners] (element, listeners) {
		element = element || this.element
		listeners = listeners || this[symbols.self].properties.on

		for (var name in listeners) {
			element.addEventListener(name, listeners[name])
		}
	}

	[symbols.addHoverListener] (element = null, key = null, listener = null) {
		element = element || this.element
		listener = listener || this[symbols.emit].bind(this, 'hover')

		let isKeyPressed = key ? false : true
		let isHovering = false

		const handleHover = (keyPressed, hovering, event) => {
			const toggle = keyPressed !== isKeyPressed || hovering !== isHovering

			if (toggle) {
				isKeyPressed = keyPressed
				isHovering = hovering

				listener({
					component: this,
					hovering: keyPressed && hovering,
					event
				})
			}
		}

		const monitorKeyboard = (event) => {
			const keyPressed = 'keydown' === event.type && event.key === key
			handleHover(keyPressed, isHovering, event)
		}

		const monitorMouse = (event) => {
			const hovering = 'mouseover' === event.type
			handleHover(isKeyPressed, hovering, event)
		}

		if (null !== key) {
			window.addEventListener('keydown', monitorKeyboard, true)
			window.addEventListener('keyup', monitorKeyboard, true);

			this[symbols.listen]({
				dispose: () => {
					window.removeEventListener('keydown', monitorKeyboard,)
					window.removeEventListener('keyup', monitorKeyboard)
				}
			})
		}

		element.addEventListener('mouseover', monitorMouse, true)
		element.addEventListener('mouseleave', monitorMouse, true)
	}

	[symbols.addDataSet] (element, dataset) {
		dataset = dataset || this[symbols.self].properties.dataset
		element = element || this.element

		for (var name in dataset) {
			element.dataset[name] = dataset[name]
		}
	}

	[symbols.scheduleUpdate] (cb) {
		atom.views.updateDocument(cb)

		return atom.views.getNextUpdatePromise()
	}

	[symbols.getClassNames] () {
		return toArray(this[symbols.self].properties.className, ...arguments).filter((name, index, self) => {
			return self.indexOf(name) === index
		})
	}

	[symbols.getClassName] () {
		return this[symbols.getClassNames](...arguments).join(' ')
	}

	[symbols.getStyle] (append) {
		return Object.assign({}, this[symbols.self].properties.style, append)
	}
}
