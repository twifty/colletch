/** @babel */
/** @jsx etch.dom */
/* global window */

import etch from 'etch'

import EtchComponent from './etch-component'
import symbols from './symbols'

const buildHierarchy = (children, parent) => {
	const childNodes = []

	children.forEach((child) => {
		if (child.tag === EtchTreeNode) {
			child.component[symbols.self].parentNode = parent

			childNodes.push(child.component)
		}
	})

	return childNodes
}

export default class EtchTreeNode extends EtchComponent
{
	constructor (props, children, options) {
		let doubleClickHandler = null
		let singleClickHandler = null

		if (props.on) {
			if (props.on.dblclick) {
				doubleClickHandler = props.on.dblclick
				delete props.on.dblclick
			}
			if (props.on.click) {
				singleClickHandler = props.on.click
				delete props.on.click
			}
		}

		super(props, children, options)

		this[symbols.self].childNodes = buildHierarchy(children, this)

		if (typeof props.onDidSelect === 'function') {
			this.on('select', props.onDidSelect)
		}

		if (typeof doubleClickHandler === 'function') {
			this.on('dblclick', doubleClickHandler)
		}

		if (typeof singleClickHandler === 'function') {
			this.on('click', singleClickHandler)
		}

		this[symbols.addHoverListener](this.element, 'Alt', ({hovering}) => {
			if (hovering) {
				this.element.classList.add('alt')
			} else {
				this.element.classList.remove('alt')
			}
		})
	}

	destroy () {
		window.removeEventListener('keydown', this.monitorKeyboard)
		window.removeEventListener('keyup', this.monitorKeyboard)

		super.destroy()
	}

	update (props, children) {
		return super.update(props, children).then(() => {
			this[symbols.self].childNodes = buildHierarchy(children, this)
		})
	}

	onDidSelect (cb) {
		return this.on('select', cb)
	}

	getChildNodes () {
		return this[symbols.self].childNodes
	}

	getParentNode () {
		return this[symbols.self].parentNode
	}

	setActive (active, event = null) {
		return this[symbols.scheduleUpdate](() => {
			let rootNode = this.getParentNode()

			while (rootNode.constructor.name !== 'EtchTreeView') {
				rootNode = rootNode.getParentNode()
			}

			if (active) {
				rootNode.setActiveNode(this)
			} else {
				rootNode.clearActiveNode(this)
			}

			if (event) {
				return this[symbols.emit]('active', {
					active,
					node: this,
					event
				})
			}
		})
	}

	setSelected (select, event = null) {
		return this[symbols.scheduleUpdate](() => {
			if (select) {
				this.element.classList.add('selected')
			} else {
				this.element.classList.remove('selected')
			}

			if (event) {
				return this[symbols.emit]('select', {
					selected: select,
					node: this,
					event
				})
			}
		})
	}

	setCollapsed (collapse, event = null) {
		return this[symbols.scheduleUpdate](() => {
			if (collapse) {
				this.element.classList.add('collapsed')
				this.element.classList.remove('expanded')
			} else {
				this.element.classList.add('expanded')
				this.element.classList.remove('collapsed')
			}

			if (event) {
				return this[symbols.emit]('click', {
					collapsed: collapse,
					node: this,
					event
				})
			}
		})
	}

	setDisabled (disable, event = null) {
		return this[symbols.scheduleUpdate](() => {
			if (disable) {
				this.element.setAttribute('disabled', true)
			} else {
				this.element.removeAttribute('disabled')
			}

			if (event) {
				return this[symbols.emit]('disable', {
					disabled: disable,
					node: this,
					event
				})
			}
		})
	}

	isSelected () {
		return this.element.classList.contains('selected')
	}

	isCollapsed () {
		return this.element.classList.contains('collapsed')
	}

	isDisabled () {
		return this.element.hasAttribute('disabled')
	}

	isActive () {
		return this.element.classList.contains('active')
	}

	onClick (event) {
		if (event.target.classList.contains('list-item')) {
			if (event.offsetX < event.target.firstChild.offsetLeft) {
				return this.setCollapsed(!this.isCollapsed(), event)
			}
		}

		this.setActive(true, event)

		if (event.altKey) {
			this.setCollapsed(!this.isCollapsed(), event)
		} else if (event.ctrlKey) {
			this.setSelected(!this.isSelected(), event)
		} else {
			if (this.clicked) {
				this.clicked = false
				this[symbols.emit]('dblclick', event)
			} else {
				this.clicked = true
				window.setTimeout(() => { // eslint-disable-line no-undef
					if (this.clicked) {
						this.clicked = false
						this[symbols.emit]('click', event)
					}
				}, 300)
			}
		}
	}

	render () {
		var itemData = null
		var children = null
		const key = this[symbols.self].properties.key
		const disabled = this[symbols.self].properties.attributes.disabled ? {disabled: true} : {}

		const itemIcon = this[symbols.self].properties.icon
			? (<span className={'icon ' + this[symbols.self].properties.icon}></span>)
			: null

		// If a value was not supplied as a property, use the first child
		if (this[symbols.self].properties.value) {
			children = this[symbols.self].children
			itemData = (
				<span>
					{ itemIcon }
					{ this[symbols.self].properties.value || '' }
				</span>
			)
		} else if (this[symbols.self].children.length) {
			children = this[symbols.self].children.slice(1)
			itemData = (
				<span>
					{ itemIcon }
					{ this[symbols.self].children[0] }
				</span>
			)
		} else {
			return (<div/>)
		}

		const attributes = {
			key,
			disabled
		}

		if (children.length) {
			const className = this[symbols.getClassName](
				'list-nested-item',
				this[symbols.self].properties.collapsed ? 'collapsed' : 'expanded',
				this[symbols.self].properties.selected ? 'selected' : null
			)

			return (
				<li { ...attributes } className={ className }>
					<div className="list-item" onClick={this.onClick}>
						{ itemData }
					</div>
					<ul className="list-tree">
						{ children }
					</ul>
				</li>
			)
		} else {
			const className = this[symbols.getClassName](
				'list-item',
				this[symbols.self].properties.selected ? 'selected' : null
			)

			return (
				<li { ...attributes } className={ className } onClick={ this.onClick } >
					{ itemData }
				</li>
			)
		}
	}
}
