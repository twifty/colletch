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

export default class EtchSelect extends EtchComponent
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
		return this.currentSelection
	}

	selectItem (key) {
		this[symbols.scheduleUpdate](() => {
			if (key in this.keyValueMap) {
				if (null !== this.currentSelection) {
					const element = this.refs[this.currentSelection]

					element.classList.remove('active')
				}

				this.currentSelection = key

				const element = this.refs[key]

				element.classList.add('active')

				this.refs.header.innerText = this.keyValueMap[this.currentSelection]

				this.changeHandler(key)
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
			<div className="etch-select">
				<select ref="selectList" onMouseDown={ disableClick } className="etch-select-header form-control">
					<option ref="header">{ header }</option>
					{ options }
				</select>
				<div className="select-list popover-list">
					<ol ref="content" className="list-group mark-active">
						{ children }
					</ol>
				</div>
			</div>
		)
	}
	
	[symbols.initialize] (props) {
		this.keyValueMap = {}
		this.currentSelection = null
		this.changeHandler = props.onDidSelectionChange || (() => {})
	}

	[symbols.getDefaultProperties] () {
		return {
			getItemText: (item) => item.innerText,
			selectNoneText: '--- None ---',
		}
	}

	[renderOptions] () {
		const options = []

		for (const key of Object.keys(this.keyValueMap)) {
			const value = this.keyValueMap[key]

			options.push(
				<option key={ key }>{ value }</option>
			)
		}

		return options
	}

	[renderItems] () {
		let items = []

		this.keyValueMap = {}

		for (const index in this[symbols.self].children) {
			const child = this[symbols.self].children[index]
			let {key, value} = child.props || {}

			if (undefined === value) {
				value = innerText(child)
			}

			if (undefined === key) {
				key = value
			}

			if (undefined === key || key in this.keyValueMap) {
				throw new Error("Selectable items must have a unique 'key' or 'value' property")
			}

			this.keyValueMap[key] = value

			if (child.props.selected) {
				this.currentSelection = key
				delete child.props.selected
			}

			items.push(
				<li
					onClick={ this.selectItem.bind(this, key) }
					key={ key }
					ref={ key }
				>
					{ child }
				</li>
			)
		}

		if (!(this.currentSelection in this.keyValueMap)) {
			this.currentSelection = items.length && items[0].props.key
		}

		if (null !== this.currentSelection) {
			items.some((item) => {
				if (item.props.key === this.currentSelection) {
					item.props.className = 'active'
					return true
				}
			})
		}

		return items
	}

	[renderHeader] () {
		if (null === this.currentSelection) {
			return this[symbols.self].properties.selectNoneText
		}

		return this.keyValueMap[this.currentSelection]
	}
}
