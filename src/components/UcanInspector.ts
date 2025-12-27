import { defineCustomElement } from 'vue'

import css from '../.generated/css'
import Component from './UcanInspector.vue'

/**
 * Custom element definition for the inspector.
 *
 * @remarks
 * Uses shadow DOM + bundled CSS.
 */
export const UcanInspectorElement = defineCustomElement(Component, {
  shadowRoot: true,
  styles: [css],
})

const DEFAULT_TAG = 'ucan-inspector'

/**
 * Register the inspector as a custom element.
 *
 * @param tag - Custom element tag name to register.
 * @remarks
 * Safe to call multiple times and safe in non-browser environments.
 */
export function defineUcanInspector(tag = DEFAULT_TAG): void {
  if (typeof window === 'undefined')
    return
  if (!customElements.get(tag))
    customElements.define(tag, UcanInspectorElement)
}
