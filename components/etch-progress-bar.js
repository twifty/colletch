/** @babel */
/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from './etch-component'
import symbols from './symbols'

function toNumber(num, def = 0) {
	num = parseFloat(num)
	return !Number.isNaN(num) && Number.isFinite(num) ? num : def
}

export default class EtchProgressBar extends EtchComponent
{
	[symbols.getDefaultProperties] () {
		return {
			total: 0,
			complete: 0,
			// label: ''
		}
	}

	render () {
		const total = toNumber(this[symbols.self].properties.total, 0)
		const width = Math.max(0, Math.min(total, toNumber(this[symbols.self].properties.complete, 0)))
		const percent = (total ? Math.floor((width / total) * 100) : 0)
		const label = typeof this[symbols.self].properties.label === 'string' ? this[symbols.self].properties.label : (percent + '%')

		return (
			<div dataset={ {width, total, percent} } className={ this[symbols.getClassName]("etch-progress-bar")} >
				<div className="complete" style={ {width: percent + '%'} }></div>
				<span className="label">{ label }</span>
			</div>
		)
	}
}
