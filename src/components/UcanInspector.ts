import { defineCustomElement } from 'vue'

import css from '../.generated/css'
import Component from './UcanInspector.vue'

export const UcanInspectorElement = defineCustomElement(Component, {
  shadowRoot: true,
  styles: [css],
})

const DEFAULT_TAG = 'ucan-inspector'

export function registerUcanInspector(tag = DEFAULT_TAG): void {
  if (typeof window === 'undefined')
    return
  if (!customElements.get(tag))
    customElements.define(tag, UcanInspectorElement)
}

registerUcanInspector()
