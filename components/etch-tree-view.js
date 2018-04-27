/** @babel */
/** @jsx etch.dom */

import etch from 'etch'

import EtchComponent from './etch-component'
import EtchTreeNode from './etch-tree-node'
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

export default class EtchTreeView extends EtchComponent
{
    constructor (props, children, options) {
        super(props, children, options)

        this[symbols.self].childNodes = buildHierarchy(children, this)

        this[symbols.addHoverListener](this.element, 'Control', ({hovering}) => {
            if (hovering) {
                this.element.classList.add('is-selecting')
            } else {
                this.element.classList.remove('is-selecting')
            }
        })
    }

    update (props, children) {
        return super.update(props, children).then(() => {
            this[symbols.self].childNodes = buildHierarchy(children, this)
        })
    }

    getChildNodes () {
        return this[symbols.self].childNodes
    }

    getParentNode () {
        return null
    }

    render () {
        const classNames = [
            'etch-tree list-tree'
        ]

        if (this[symbols.self].children.length) {
            classNames.push('has-collapsable-children')
        }

        return (
            <ul className={ this[symbols.getClassName](classNames) }
                style={ this[symbols.getStyle]() }
            >
                { this[symbols.self].children }
            </ul>
        )
    }

    setActiveNode (node = null) {
        this.clearActiveNode()

        if (node) {
            this[symbols.self].activeNode = node
            node.element.classList.add('active')
        }
    }

    clearActiveNode (node = null) {
        if (!node) {
            node = this[symbols.self].activeNode
        }

        if (node && node === this[symbols.self].activeNode) {
            node.element.classList.remove('active')
            this[symbols.self].activeNode = null
        }
    }
}
