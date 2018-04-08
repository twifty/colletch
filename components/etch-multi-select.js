/** @babel */
/** @jsx etch.dom */
/* global window Symbol */

import etch from 'etch'

import EtchComponent from './etch-component'
import symbols from './symbols'
import {innerText} from './utils'

const renderItems = Symbol()
const renderHeader = Symbol()
const renderOptions = Symbol()

export default class EtchMultiSelect extends EtchComponent
{
	disable (disable) {
		return this[symbols.scheduleUpdate](() => {
			if (disable) {
				this.element.setAttribute('disabled', true)
				this.refs.selectList.setAttribute('disabled', true)
			} else {
				this.element.removeAttribute('disabled')
				this.refs.selectList.removeAttribute('disabled')
			}
		})
	}

	getSelected () {
		return Object.keys(this.itemSelections)
	}

	toggleItem (value) {
		this[symbols.scheduleUpdate](() => {
			const attributes = this.itemAttributes[value]
			const element = this.refs[value]

			if (attributes.selected) {
				attributes.selected = false
				delete this.itemSelections[value]
				element.classList.remove('active')
			} else {
				attributes.selected = true
				this.itemSelections[value] = true
				element.classList.add('active')
			}

			this.refs.header.innerText = this[renderHeader]()

			this.changeHandler(this.getSelected())
		})
	}

	toggleAllItems (selectAll) {
		this[symbols.scheduleUpdate](() => {
			for (const value of Object.keys(this.itemAttributes)) {
				const attributes = this.itemAttributes[value]
				const element = this.refs[value]

				if (selectAll) {
					attributes.selected = true
					this.itemSelections[value] = true
					element.classList.add('active')
				} else {
					attributes.selected = false
					delete this.itemSelections[value]
					element.classList.remove('active')
				}

				this.refs.header.innerText = this[renderHeader]()

				this.changeHandler(this.getSelected())
			}
		})
	}

	render () {
		function disableClick (event) {
			event.preventDefault();
			event.target.blur();
			window.focus();
		}

		const children = this[renderItems]()
		const header = this[renderHeader]()
		const options = this[renderOptions]()

		return (
			<div className="etch-multi-select">
				<select ref="selectList" onMouseDown={ disableClick } className="etch-multi-select-header form-control">
					<option ref="header">{ header }</option>
					{ options }
				</select>
				<div className="select-list popover-list">
					<ol ref="content" className="list-group mark-active">
						<li
							onClick={ this.toggleAllItems.bind(this, true) }
							ref="selectAll"
						>
							{ this[symbols.self].properties.selectAllText }
						</li>
						<li
							onClick={ this.toggleAllItems.bind(this, false) }
							ref="selectNone"
						>
							{ this[symbols.self].properties.selectNoneText }
						</li>
						{ children }
					</ol>
				</div>
			</div>
		)
	}

	[symbols.initialize] (props) {
		this.itemAttributes = {}
		this.itemSelections = {}
		this.changeHandler = props.onDidSelectionChange || (() => {})
	}

	[symbols.getDefaultProperties] () {
		return {
			selectNoneText: '--- None  ---',
			selectAllText:  '---  All  ---',
			selectSomeText: '--- Multi ---'
		}
	}

	[renderOptions] () {
		const options = []

		for (const key of Object.keys(this.itemAttributes)) {
			const value = this.itemAttributes[key].value

			options.push(
				<option key={ key }>{ value }</option>
			)
		}

		options.push(
			<option key="all">{ this[symbols.self].properties.selectAllText }</option>
		)
		options.push(
			<option key="some">{ this[symbols.self].properties.selectSomeText }</option>
		)
		options.push(
			<option key="none">{ this[symbols.self].properties.selectNoneText }</option>
		)
		return options
	}

	[renderItems] () {
		let items = []

		this.itemAttributes = {}
		this.itemSelections = {}

		for (const index in this[symbols.self].children) {
			const child = this[symbols.self].children[index]

			let {key, value} = child.props || {}

			if (undefined === value) {
				value = innerText(child)
			}

			if (undefined === key) {
				key = value
			}

			if (undefined === key || key in this.itemAttributes) {
				throw new Error("Selectable items must have a unique 'key' or 'value' property")
			}

			this.itemAttributes[key] = {
				ref: key,
				value: value
			}

			let className = ''

			if (child.props.selected) {
				this.itemAttributes[key].selected = true
				this.itemSelections[key] = true
				className = 'active'
			}

			delete child.props.selected

			items.push(
				<li
					ref={ key }
					key={ key }
					onClick={ this.toggleItem.bind(this, key) }
					className={ className }
				>
					{ child }
				</li>
			)
		}

		// for (const key of Object.keys(this.itemAttributes)) {
		// 	if (!(key in attributes)) {
		// 		delete this.itemAttributes[key]
		// 		delete this.itemSelections[key]
		// 	}
		// }
		//
		// Object.assign(this.itemAttributes, attributes)
		// Object.assign(this.itemSelections, selections)

		return items
	}

	[renderHeader] () {
		const selected = this.getSelected()
		const props = this[symbols.self].properties
		let text = ''

		if (0 === selected.length) {
			text = props.selectNoneText
		} else if (1 === selected.length) {
			text = selected[0]
		} else if (this[symbols.self].children.length === selected.length) {
			text = props.selectAllText
		} else if (typeof props.selectSomeText === 'string') {
			text = props.selectSomeText
		} else {
			text = props.selectSomeText(selected)
		}

		return text
	}
}
