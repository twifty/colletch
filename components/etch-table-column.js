/** @babel */
/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from './etch-component'
import EtchTableCell from './etch-table-cell'
import symbols from './symbols'
import {splitStrings} from './utils'

export default class EtchTableColumn extends EtchComponent
{
    getFields () {
        let props = this[symbols.self].properties
        let result = {}

        if (props[':fieldData'] && props.field) {
            let remap = null

            if (typeof props.field === 'function') {
                return props.field(props[':fieldData'])
            }

            for (const field of splitStrings(props.field)) {
                if (field.endsWith(':')) {
                    const mapped = field.slice(0, -1)
                    if (remap) {
                        result[mapped] = result[remap]
                        delete result[remap]
                    } else if (typeof props[':fieldData'][mapped] === 'function') {
                        result[mapped] = props[':fieldData'][mapped]()
                    } else {
                        result[mapped] = props[':fieldData'][mapped]
                    }
                    remap = mapped
                } else if (remap) {
                    result[field] = result[remap]
                    delete result[remap]
                    remap = null
                } else if (!(field in props[':fieldData'])) {
                    throw new Error(`Field name '${field}' not found!`)
                } else if (typeof props[':fieldData'][field] === 'function') {
                    result[field] = props[':fieldData'][field]()
                } else {
                    result[field] = props[':fieldData'][field]
                }
            }
        }

        for (const key of Object.keys(result)) {
            if (undefined === result[key]) {
                throw new Error(`Failed to reolve field '${key}'`)
            }
        }

        return result
    }

    bindEvents () {
        const props = this[symbols.self].properties
        const events = {}

        if (props.bind) {
            const context = props[':context']

            for (const name of Object.keys(props.bind)) {
                events[name] = props.bind[name].bind(context, props[':fieldData'])
            }
        }

        return events
    }

    renderCell () {
        const children = this[symbols.self].children
        let cell

        if (!children.length || children[0].text) {
            cell = <EtchTableCell/>
        } else {
            cell = children[0]
        }

        const fields = this.getFields()
        const names = Object.keys(fields)

        if (!cell.props) {
            cell.props = {}
        }

        cell.props[':fieldNames'] = names
        cell.props[':fieldData'] = this[symbols.self].properties[':fieldData']

        for (const name of names) {
            cell.props[name] = fields[name]
        }

        return cell
    }

    render () {
        const cell = this.renderCell()
        const events = this.bindEvents()

        return (
            <td className={this[symbols.getClassName]('etch-table-cell')} on={events}>
                { cell }
            </td>
        )
    }
}
